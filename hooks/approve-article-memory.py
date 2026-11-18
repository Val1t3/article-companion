#!/usr/bin/env python3
"""PreToolUse hook: pre-approve the tool calls the article-companion pipeline needs.

Approves, and nothing else:
- Write/Edit of a file under research/, drafts/ or reviews/ of an article memory folder
  (a folder `articles/<slug>/` holding MEMORY.md and a state.json whose slug matches);
- a Bash command that is a single `article-memory` invocation (no shell operators or
  expansions), optionally fed by one quoted heredoc (used by `article-memory init`).

Anything else gets no decision, so the normal permission flow applies (prompt, or deny
in headless mode). Deny rules in the user's settings still take precedence.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import sys

WRITABLE_SUBDIRS = {"research", "drafts", "reviews"}
SHELL_PUNCTUATION = ";&|<>()"
HEREDOC = re.compile(r"<<-?\s*'([A-Za-z_][A-Za-z0-9_]*)'\s*$")


def article_dir_of(path: str) -> str | None:
    """Return the article dir if `path` lies in one of its writable subfolders."""
    current = os.path.dirname(path)
    while True:
        parent = os.path.dirname(current)
        if parent == current:
            return None
        if os.path.basename(parent) == "articles" and _is_article(current):
            rel = os.path.relpath(path, current).split(os.sep)
            if len(rel) >= 2 and rel[0] in WRITABLE_SUBDIRS and ".." not in rel:
                return current
            return None
        current = parent


def _is_article(folder: str) -> bool:
    try:
        with open(os.path.join(folder, "state.json"), encoding="utf-8") as f:
            state = json.load(f)
    except (OSError, ValueError):
        return False
    return (
        isinstance(state, dict)
        and state.get("slug") == os.path.basename(folder)
        and os.path.isfile(os.path.join(folder, "MEMORY.md"))
    )


def safe_cli_line(line: str) -> bool:
    """True if `line` is one plain `article-memory` command: no expansion, no operator."""
    if "$" in line or "`" in line or "\\" in line:
        return False
    try:
        lexer = shlex.shlex(line, posix=True, punctuation_chars=SHELL_PUNCTUATION)
        lexer.whitespace_split = True
        tokens = list(lexer)
    except ValueError:
        return False
    if not tokens or tokens[0] != "article-memory":
        return False
    return not any(t and all(c in SHELL_PUNCTUATION for c in t) for t in tokens)


def safe_cli_command(command: str) -> bool:
    lines = command.strip().split("\n")
    if len(lines) == 1:
        return safe_cli_line(lines[0])
    # One quoted heredoc: `article-memory ... <<'EOF'`, body, `EOF`. A quoted heredoc
    # body is passed verbatim (no expansion), so only the first line is checked.
    match = HEREDOC.search(lines[0])
    if not match or lines[-1].strip() != match.group(1):
        return False
    if any(line.strip() == match.group(1) for line in lines[1:-1]):
        return False
    return safe_cli_line(lines[0][: match.start()])


def decide(event: dict) -> str | None:
    tool = event.get("tool_name")
    args = event.get("tool_input") or {}
    if tool in ("Write", "Edit"):
        path = args.get("file_path")
        if not isinstance(path, str) or not os.path.isabs(path):
            return None
        real = os.path.realpath(path)
        if real != os.path.normpath(path):
            return None  # symlink somewhere on the way: let the user decide
        if article_dir_of(real):
            return "article-companion: write inside an article memory folder"
    elif tool == "Bash":
        command = args.get("command")
        if isinstance(command, str) and safe_cli_command(command):
            return "article-companion: article-memory command"
    return None


def main() -> None:
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return
    reason = decide(event)
    if reason:
        json.dump(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow",
                    "permissionDecisionReason": reason,
                }
            },
            sys.stdout,
        )


if __name__ == "__main__":
    main()
