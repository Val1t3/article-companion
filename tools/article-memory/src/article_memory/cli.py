"""Command line interface. Every command prints one JSON object on stdout."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import get_args

from .memory import Article, Brief, ArticleMemoryError, init_article
from .models import Status


def _out(data: dict) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False))


def cmd_init(a: argparse.Namespace) -> int:
    if a.context_file:
        context = sys.stdin.read() if a.context_file == "-" else Path(a.context_file).read_text(encoding="utf-8")
    else:
        context = a.context or ""
    brief = Brief(context=context, include=a.include, avoid=a.avoid)
    for key in ("audience", "length", "angle"):
        if getattr(a, key) is not None:
            setattr(brief, key, getattr(a, key))
    article = init_article(Path(a.root), a.slug, brief, max_drafts=a.max_drafts)
    _out({"articleDir": str(article.root), "slug": article.root.name})
    return 0


def cmd_status(a: argparse.Namespace) -> int:
    _out(Article.open(a.article_dir).summary())
    return 0


def cmd_log(a: argparse.Namespace) -> int:
    state = Article.open(a.article_dir).log(a.step, a.result, status=a.status)
    _out({"status": state.status, "draft": state.draft, "researchRound": state.researchRound, "entries": len(state.history)})
    return 0


def cmd_next_round(a: argparse.Namespace) -> int:
    state = Article.open(a.article_dir).next_round()
    _out({"researchRound": state.researchRound, "status": state.status})
    return 0


def cmd_next_draft(a: argparse.Namespace) -> int:
    article = Article.open(a.article_dir)
    state = article.next_draft()
    n = state.draft
    _out({"draft": n, "draftDir": str(article.draft_dir(n)), "reviewDir": str(article.review_dir(n)), "status": state.status})
    return 0


def cmd_validate(a: argparse.Namespace) -> int:
    errors = Article.open(a.article_dir).validate(draft=a.draft)
    _out({"ok": not errors, "errors": errors})
    return 0 if not errors else 1


def cmd_finalize(a: argparse.Namespace) -> int:
    target = Article.open(a.article_dir).finalize(a.draft)
    _out({"final": str(target), "status": "done"})
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="article-memory", description="Manage an article-companion article memory folder.")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("init", help="create a new article memory folder")
    s.add_argument("--slug", required=True, help="lowercase-hyphenated, at most 6 words; -2, -3... appended if taken")
    src = s.add_mutually_exclusive_group(required=True)
    src.add_argument("--context", help="the user's article context, verbatim")
    src.add_argument("--context-file", help="file holding the context ('-' for stdin)")
    s.add_argument("--audience")
    s.add_argument("--length", type=int, help="target word count")
    s.add_argument("--angle")
    s.add_argument("--include", action="append", default=[], help="must include (repeatable)")
    s.add_argument("--avoid", action="append", default=[], help="must avoid (repeatable)")
    s.add_argument("--root", default="articles", help="parent folder (default: ./articles)")
    s.add_argument("--max-drafts", type=int, default=3)
    s.set_defaults(func=cmd_init)

    s = sub.add_parser("status", help="summarize where an article stands")
    s.add_argument("article_dir")
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("log", help="append a history entry to state.json")
    s.add_argument("article_dir")
    s.add_argument("--step", required=True, help="agent or decision name")
    s.add_argument("--result", required=True, help="one-line result")
    s.add_argument("--status", choices=get_args(Status))
    s.set_defaults(func=cmd_log)

    s = sub.add_parser("next-round", help="start a new research round")
    s.add_argument("article_dir")
    s.set_defaults(func=cmd_next_round)

    s = sub.add_parser("next-draft", help="start a new draft: creates drafts/vN and reviews/vN")
    s.add_argument("article_dir")
    s.set_defaults(func=cmd_next_draft)

    s = sub.add_parser("validate", help="check every memory file against its format")
    s.add_argument("article_dir")
    s.add_argument("--draft", type=int, help="only check this draft (default: all)")
    s.set_defaults(func=cmd_validate)

    s = sub.add_parser("finalize", help="copy an accepted draft to final/article.md")
    s.add_argument("article_dir")
    s.add_argument("--draft", type=int, required=True)
    s.set_defaults(func=cmd_finalize)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except ArticleMemoryError as e:
        _out({"ok": False, "error": str(e)})
        return 1
