# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code **plugin** that writes sourced, Medium-style articles from a one-line brief. Behavior lives in Markdown prompt files (agents); the article memory folder is managed by a small Python CLI, `article-memory`, run with uv.

- `.claude-plugin/plugin.json` / `marketplace.json`: plugin manifest and marketplace entry.
- `agents/orchestrator.md`: the main agent (workflow, decisions). It manages the memory folder only through `article-memory`.
- `tools/article-memory/`: uv project (Python >= 3.11, pydantic). `models.py` = pydantic models of every memory file; `memory.py` = init/transitions/validation; `cli.py` = commands (each prints one JSON object). `templates/MEMORY.md` is the agent-facing memory spec, `templates/STYLE.md` the editorial rules; both are copied into each article folder by `init`.
- `bin/article-memory`: shim (`uv run --frozen --project tools/article-memory`). Claude Code puts a plugin's `bin/` on the Bash tool's PATH.
- `agents/*.md`: the orchestrator and six subagents (frontmatter sets `tools` and `model`; body is the prompt).
- `skills/humanizer/SKILL.md`: a standalone skill that rewrites AI-sounding prose (26 patterns, strongest first). Adapted from the MIT-licensed [blader/humanizer](https://github.com/blader/humanizer) and modified for this project; keep the attribution in `skills/humanizer/README.md`. Not run by the pipeline, but `style-reviewer` loads it with the `Skill` tool as a pattern catalogue.

## Running / testing

The CLI can be run directly: `bin/article-memory --help` (after changing dependencies, run `uv lock` in `tools/article-memory/`; the shim uses `--frozen`). There are no tests yet. To try the whole plugin, load it from the working tree:

```
claude --plugin-dir /path/to/article-companion
claude --plugin-dir /path/to/article-companion --agent article-companion:orchestrator "<full article context>"
```

The orchestrator never talks to the user: everything comes from its initial prompt, and its final reply is the report. Each article gets a memory folder `articles/<slug>/` (gitignored); inspect `state.json` `history`, the drafts and the reviews there to debug which agent misbehaved. Passing that folder path as the prompt resumes the article.

## Architecture

The orchestrator is an agent that must run as the session's main agent (`--agent`), since subagents cannot launch subagents; it stops with an explanation if the `Agent` tool is missing. It runs agents and decides, but must not do their work. Agents communicate only through the **article memory** `articles/<slug>/`; `article-memory init` writes `MEMORY.md` and `STYLE.md` there, and every agent reads `MEMORY.md` first. Agents get the absolute article dir plus a round or draft number, and find their inputs themselves.

```
research: deep-search     → research/sources.json   (sonnet, appends per round, stable ids)
          fact-extractor  → research/facts.json     (sonnet, WebFetch, facts with verbatim quotes)
writing:  writer          → drafts/vN/{article.md, claims.json, changelog.md}   (opus)
review:   fact-checker    → reviews/vN/fact-checker.json    (opus)   ┐
          editor          → reviews/vN/editor.json          (opus)   ├ in parallel
          style-reviewer  → reviews/vN/style-reviewer.json  (opus)   ┘
decide:   orchestrator    → reviews/vN/decision.json  accept | rewrite | research | stop
final:    orchestrator    → final/article.md (verbatim copy of the accepted draft)
```

Loop: `research` → research round then new draft; `rewrite` → new draft; max 3 drafts (`maxDrafts` in `state.json`). Accept = all verdicts `pass` (no blocker/major, scores ≥ 7). Each review issue carries a `route` (`writing`|`research`) and a `researchNeed`, which drive the decision.

Things that span multiple files:
- File formats are defined twice, on purpose: `templates/MEMORY.md` (read by agents) and `models.py` (used by `validate`). Changing a field means updating both, the producing agent, every consumer (agents and the orchestrator's decide step), and the README memory section.
- Editorial rules live only in `templates/STYLE.md`; agents cite them by section and rule number (e.g. "Formatting, rule 2"), so renumbering affects reviews.
- No-invention rule: the writer may only use `facts.json`; `claims.json` maps each factual sentence to fact ids so the fact-checker can verify it. Keep this chain intact when editing any of these agents.
- The orchestrator has `Agent, Read, Write, Bash` (its prompt limits Bash to `article-memory`; it never edits `state.json` by hand); agents are referenced by the namespaced name `article-companion:<agent>`.
- Articles are published as X Articles. The writer models its voice on `templates/voice/` (`voice-profile.md` + `tweet-corpus.jsonl`, copied unmodified from the MIT-licensed [MengTo/Skills](https://github.com/MengTo/Skills/tree/main/agent-skills/codex/write-like-meng-on-x); keep `ATTRIBUTION.md` and `LICENSE` next to them). `article-memory init` copies them into `<article dir>/voice/`. The writer's voice rules refine STYLE.md and must never contradict it, since reviewers only judge against STYLE.md.

## Notes

- README.md documents install, usage, the workflow, the memory layout and the agent table; keep it in sync when adding or changing agents.
