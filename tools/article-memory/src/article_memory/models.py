"""Pydantic models of the article memory files.

They mirror the formats documented in ``templates/MEMORY.md``: keep both in sync.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Status = Literal["brief", "research", "writing", "review", "done", "needs-attention", "failed"]
Severity = Literal["blocker", "major", "minor"]
Route = Literal["writing", "research"]
ReviewerName = Literal["fact-checker", "editor", "style-reviewer"]
DecisionKind = Literal["accept", "rewrite", "research", "stop"]
FactKind = Literal["statistic", "definition", "event", "example", "expert-opinion", "quote"]

REVIEWERS: tuple[ReviewerName, ...] = ("fact-checker", "editor", "style-reviewer")
ISSUE_PREFIX: dict[str, str] = {"fact-checker": "FC", "editor": "ED", "style-reviewer": "ST"}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _unique(values: list, what: str) -> None:
    seen = set()
    for value in values:
        if value in seen:
            raise ValueError(f"duplicate {what}: {value}")
        seen.add(value)


# state.json


class HistoryEntry(Strict):
    at: datetime
    step: str = Field(min_length=1)
    draft: int = Field(ge=0)
    researchRound: int = Field(ge=0)
    result: str


class State(Strict):
    slug: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    createdAt: datetime
    updatedAt: datetime
    status: Status
    draft: int = Field(ge=0)
    researchRound: int = Field(ge=0)
    maxDrafts: int = Field(ge=1)
    history: list[HistoryEntry]


# research/sources.json


class ResearchRound(Strict):
    round: int = Field(ge=1)
    reason: str = Field(min_length=1)
    queries: list[str]
    candidateCount: int = Field(ge=0)


class Source(Strict):
    id: int = Field(ge=1)
    round: int = Field(ge=1)
    title: str
    url: str = Field(pattern=r"^https?://")
    publisher: str
    published: date | None
    snippet: str
    relevance: float = Field(ge=0, le=1)


class Sources(Strict):
    rounds: list[ResearchRound]
    sources: list[Source]

    @model_validator(mode="after")
    def _check(self) -> Sources:
        _unique([r.round for r in self.rounds], "round")
        _unique([s.id for s in self.sources], "source id")
        _unique([s.url for s in self.sources], "source url")
        known = {r.round for r in self.rounds}
        for s in self.sources:
            if s.round not in known:
                raise ValueError(f"source {s.id} belongs to unknown round {s.round}")
        return self


# research/facts.json


class Fact(Strict):
    id: str = Field(pattern=r"^F[1-9][0-9]*$")
    round: int = Field(ge=1)
    sourceId: int = Field(ge=1)
    claim: str = Field(min_length=1)
    quote: str = Field(min_length=1)
    kind: FactKind
    topic: str


class Rejected(Strict):
    sourceId: int = Field(ge=1)
    reason: str = Field(min_length=1)


class Facts(Strict):
    facts: list[Fact]
    rejected: list[Rejected]
    gaps: list[str]

    @model_validator(mode="after")
    def _check(self) -> Facts:
        _unique([f.id for f in self.facts], "fact id")
        return self


# drafts/vN/claims.json


class Claim(Strict):
    excerpt: str = Field(min_length=1)
    factIds: list[str] = Field(min_length=1)

    @field_validator("factIds")
    @classmethod
    def _ids(cls, ids: list[str]) -> list[str]:
        for fid in ids:
            if not fid.startswith("F") or not fid[1:].isdigit():
                raise ValueError(f"invalid fact id: {fid}")
        return ids


class Claims(Strict):
    draft: int = Field(ge=1)
    claims: list[Claim]
    missingFacts: list[str]


# reviews/vN/<reviewer>.json


class Issue(Strict):
    id: str
    severity: Severity
    route: Route
    location: str = Field(min_length=1)
    problem: str = Field(min_length=1)
    suggestion: str
    researchNeed: str | None

    @model_validator(mode="after")
    def _route(self) -> Issue:
        if self.route == "research" and not self.researchNeed:
            raise ValueError(f"issue {self.id}: route 'research' needs a researchNeed")
        if self.route == "writing" and self.researchNeed is not None:
            raise ValueError(f"issue {self.id}: route 'writing' must have researchNeed null")
        return self


class Review(Strict):
    reviewer: ReviewerName
    draft: int = Field(ge=1)
    score: int = Field(ge=0, le=10)
    verdict: Literal["pass", "revise"]
    summary: str
    issues: list[Issue]

    @model_validator(mode="after")
    def _check(self) -> Review:
        prefix = ISSUE_PREFIX[self.reviewer]
        _unique([i.id for i in self.issues], "issue id")
        for issue in self.issues:
            if not (issue.id.startswith(prefix) and issue.id[len(prefix):].isdigit()):
                raise ValueError(f"issue id {issue.id} must look like {prefix}1, {prefix}2, ...")
        serious = [i.id for i in self.issues if i.severity in ("blocker", "major")]
        if serious and self.verdict == "pass":
            raise ValueError(f"verdict 'pass' with blocker/major issues: {', '.join(serious)}")
        return self


# reviews/vN/decision.json


class Decision(Strict):
    draft: int = Field(ge=1)
    decision: DecisionKind
    reasons: list[str]
    researchNeeds: list[str]
    decidedAt: datetime

    @model_validator(mode="after")
    def _check(self) -> Decision:
        if self.decision == "research" and not self.researchNeeds:
            raise ValueError("decision 'research' needs at least one researchNeed")
        return self
