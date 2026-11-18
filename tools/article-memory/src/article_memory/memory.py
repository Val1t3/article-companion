"""Operations on an article memory folder (see templates/MEMORY.md)."""

from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from importlib import resources
from pathlib import Path

from pydantic import BaseModel, ValidationError

from .models import (
    REVIEWERS,
    Claims,
    Decision,
    Facts,
    HistoryEntry,
    Review,
    Sources,
    State,
    Status,
)

SUBDIRS = ("research", "drafts", "reviews", "final")
VOICE_FILES = ("voice-profile.md", "tweet-corpus.jsonl", "ATTRIBUTION.md", "LICENSE")
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
MAX_SLUG_WORDS = 6


class ArticleMemoryError(Exception):
    """A user-facing error: the message is printed as is."""


def now() -> datetime:
    return datetime.now().astimezone().replace(microsecond=0)


def template(name: str) -> str:
    return (
        resources.files("article_memory")
        .joinpath("templates", name)
        .read_text(encoding="utf-8")
    )


def write_text(path: Path, text: str) -> None:
    """Write atomically, so a crash never leaves a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def write_model(path: Path, model: BaseModel) -> None:
    write_text(path, model.model_dump_json(indent=2) + "\n")


# brief.md


@dataclass
class Brief:
    context: str
    audience: str = "curious non-expert"
    length: int = 1200
    angle: str = "to be derived from the research"
    include: list[str] = field(default_factory=list)
    avoid: list[str] = field(default_factory=list)
    language: str = "English"

    def render(self) -> str:
        def items(values: list[str]) -> str:
            return "; ".join(values) if values else "nothing specific"

        return (
            "# Brief\n\n"
            f"{self.context.strip()}\n\n"
            "## Parameters\n\n"
            f"- Audience: {self.audience}\n"
            f"- Length: {self.length} words\n"
            f"- Angle: {self.angle}\n"
            f"- Must include: {items(self.include)}\n"
            f"- Must avoid: {items(self.avoid)}\n"
            f"- Language: {self.language}\n"
        )


# Article folder


class Article:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.state_path = self.root / "state.json"

    @classmethod
    def open(cls, path: str | Path) -> Article:
        article = cls(Path(path))
        if not article.state_path.is_file():
            raise ArticleMemoryError(
                f"not an article memory (no state.json): {article.root}"
            )
        return article

    # state

    def load_state(self) -> State:
        try:
            return State.model_validate_json(
                self.state_path.read_text(encoding="utf-8")
            )
        except ValidationError as e:
            raise ArticleMemoryError(f"state.json is invalid:\n{e}") from e

    def save_state(self, state: State) -> None:
        state.updatedAt = now()
        write_model(self.state_path, state)

    def log(self, step: str, result: str, status: Status | None = None) -> State:
        state = self.load_state()
        if status is not None:
            state.status = status
        state.history.append(
            HistoryEntry(
                at=now(),
                step=step,
                draft=state.draft,
                researchRound=state.researchRound,
                result=result,
            )
        )
        self.save_state(state)
        return state

    # paths

    def draft_dir(self, n: int) -> Path:
        return self.root / "drafts" / f"v{n}"

    def review_dir(self, n: int) -> Path:
        return self.root / "reviews" / f"v{n}"

    # transitions

    def next_round(self) -> State:
        state = self.load_state()
        state.researchRound += 1
        state.status = "research"
        self.save_state(state)
        return state

    def next_draft(self) -> State:
        state = self.load_state()
        if state.researchRound == 0:
            raise ArticleMemoryError(
                "cannot start a draft before the first research round"
            )
        if state.draft >= state.maxDrafts:
            raise ArticleMemoryError(f"draft cap reached ({state.maxDrafts})")
        state.draft += 1
        self.draft_dir(state.draft).mkdir(parents=True, exist_ok=False)
        self.review_dir(state.draft).mkdir(parents=True, exist_ok=False)
        state.status = "writing"
        self.save_state(state)
        return state

    def finalize(self, n: int) -> Path:
        source = self.draft_dir(n) / "article.md"
        if not source.is_file():
            raise ArticleMemoryError(f"no draft to finalize: {source}")
        decision = self.review_dir(n) / "decision.json"
        if (
            not decision.is_file()
            or Decision.model_validate_json(decision.read_text()).decision != "accept"
        ):
            raise ArticleMemoryError(
                f"draft {n} has not been accepted (reviews/v{n}/decision.json)"
            )
        target = self.root / "final" / "article.md"
        target.parent.mkdir(exist_ok=True)
        shutil.copyfile(source, target)
        self.log("finalize", f"draft {n} copied to final/article.md", status="done")
        return target

    # summary

    def summary(self) -> dict:
        state = self.load_state()
        n = state.draft
        info: dict = {
            "articleDir": str(self.root),
            "slug": state.slug,
            "status": state.status,
            "draft": n,
            "researchRound": state.researchRound,
            "maxDrafts": state.maxDrafts,
            "lastStep": state.history[-1].model_dump(mode="json")
            if state.history
            else None,
        }
        if n:
            info["draftFiles"] = sorted(
                p.name for p in self.draft_dir(n).glob("*") if p.is_file()
            )
            info["reviewFiles"] = sorted(
                p.name for p in self.review_dir(n).glob("*.json")
            )
            decision = self.review_dir(n) / "decision.json"
            if decision.is_file():
                info["decision"] = json.loads(decision.read_text(encoding="utf-8")).get(
                    "decision"
                )
        return info

    # validation

    def validate(self, draft: int | None = None) -> list[dict]:
        """Validate every memory file that exists. Returns a list of {file, error}."""
        errors: list[dict] = []

        def check(
            rel: str, model: type[BaseModel], required: bool = False
        ) -> BaseModel | None:
            path = self.root / rel
            if not path.is_file():
                if required:
                    errors.append({"file": rel, "error": "missing"})
                return None
            try:
                return model.model_validate_json(path.read_text(encoding="utf-8"))
            except ValidationError as e:
                errors.append({"file": rel, "error": _format(e)})
                return None

        for rel in ("MEMORY.md", "STYLE.md", "brief.md"):
            if not (self.root / rel).is_file():
                errors.append({"file": rel, "error": "missing"})
        state = check("state.json", State, required=True)
        sources = check("research/sources.json", Sources)
        facts = check("research/facts.json", Facts)

        if isinstance(sources, Sources) and isinstance(facts, Facts):
            ids = {s.id for s in sources.sources}
            for f in facts.facts:
                if f.sourceId not in ids:
                    errors.append(
                        {
                            "file": "research/facts.json",
                            "error": f"{f.id}: unknown sourceId {f.sourceId}",
                        }
                    )
            for r in facts.rejected:
                if r.sourceId not in ids:
                    errors.append(
                        {
                            "file": "research/facts.json",
                            "error": f"rejected: unknown sourceId {r.sourceId}",
                        }
                    )

        if draft is not None:
            drafts = [draft]
        elif isinstance(state, State):
            drafts = list(range(1, state.draft + 1))
        else:
            drafts = []
        fact_ids = {f.id for f in facts.facts} if isinstance(facts, Facts) else None

        for n in drafts:
            d, r = f"drafts/v{n}", f"reviews/v{n}"
            if (self.root / d).is_dir() and any((self.root / d).iterdir()):
                if not (self.root / d / "article.md").is_file():
                    errors.append({"file": f"{d}/article.md", "error": "missing"})
                claims = check(f"{d}/claims.json", Claims, required=True)
                if isinstance(claims, Claims):
                    if claims.draft != n:
                        errors.append(
                            {
                                "file": f"{d}/claims.json",
                                "error": f"draft is {claims.draft}, expected {n}",
                            }
                        )
                    if fact_ids is not None:
                        for c in claims.claims:
                            unknown = [i for i in c.factIds if i not in fact_ids]
                            if unknown:
                                errors.append(
                                    {
                                        "file": f"{d}/claims.json",
                                        "error": f"unknown fact ids {unknown} for: {c.excerpt[:60]}",
                                    }
                                )
                if n >= 2 and not (self.root / d / "changelog.md").is_file():
                    errors.append({"file": f"{d}/changelog.md", "error": "missing"})
            for name in REVIEWERS:
                review = check(f"{r}/{name}.json", Review)
                if isinstance(review, Review) and (
                    review.reviewer != name or review.draft != n
                ):
                    errors.append(
                        {
                            "file": f"{r}/{name}.json",
                            "error": f"reviewer/draft mismatch ({review.reviewer}, {review.draft})",
                        }
                    )
            decision = check(f"{r}/decision.json", Decision)
            if isinstance(decision, Decision) and decision.draft != n:
                errors.append(
                    {
                        "file": f"{r}/decision.json",
                        "error": f"draft is {decision.draft}, expected {n}",
                    }
                )
        return errors


def _format(e: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(p) for p in err['loc']) or '<root>'}: {err['msg']}"
        for err in e.errors()
    )


def init_article(base: Path, slug: str, brief: Brief, max_drafts: int = 3) -> Article:
    if not SLUG_RE.match(slug):
        raise ArticleMemoryError(
            f"invalid slug {slug!r}: lowercase letters, digits and single hyphens only"
        )
    if len(slug.split("-")) > MAX_SLUG_WORDS:
        raise ArticleMemoryError(
            f"invalid slug {slug!r}: at most {MAX_SLUG_WORDS} words"
        )
    if not brief.context.strip():
        raise ArticleMemoryError("the article context is empty")

    base.mkdir(parents=True, exist_ok=True)
    final_slug, i = slug, 1
    while True:
        try:
            (base / final_slug).mkdir()
            break
        except FileExistsError:
            i += 1
            final_slug = f"{slug}-{i}"

    article = Article(base / final_slug)
    for sub in SUBDIRS:
        (article.root / sub).mkdir()
    write_text(article.root / "MEMORY.md", template("MEMORY.md"))
    write_text(article.root / "STYLE.md", template("STYLE.md"))
    (article.root / "voice").mkdir()
    for name in VOICE_FILES:
        write_text(article.root / "voice" / name, template(f"voice/{name}"))
    write_text(article.root / "brief.md", brief.render())
    t = now()
    state = State(
        slug=final_slug,
        createdAt=t,
        updatedAt=t,
        status="research",
        draft=0,
        researchRound=0,
        maxDrafts=max_drafts,
        history=[],
    )
    write_model(article.state_path, state)
    article.log("init", f"article memory created at {article.root}")
    return article
