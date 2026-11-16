# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code **plugin** (no runtime, no build, no tests, no dependencies) that writes sourced, Medium-style articles from a one-line brief. The whole product is Markdown prompt files: editing behavior means editing those prompts.

- `.claude-plugin/plugin.json` / `marketplace.json`: plugin manifest and marketplace entry.
- `skills/write-article/SKILL.md`: the orchestrator (`/article-companion:write-article`).
- `agents/*.md`: the five subagents (frontmatter sets `tools` and `model`; body is the prompt).
- `skills/humanizer/SKILL.md`: a standalone skill that rewrites AI-sounding prose (26 patterns, strongest first). Adapted from the MIT-licensed [blader/humanizer](https://github.com/blader/humanizer) and modified for this project; keep the attribution in `skills/humanizer/README.md`. It is not part of the write-article pipeline.

## Running / testing

There are no build, lint or test commands. To try a change, load the plugin from the working tree:

```
claude --plugin-dir /path/to/article-companion
/article-companion:write-article <brief>
```

Without an argument the skill reads `prompt.md` in the current directory (gitignored). Each run writes to `output/<timestamp>/` (gitignored); inspect the intermediate files there to debug which agent misbehaved.

## Architecture

A fixed, linear pipeline of subagents, orchestrated by the skill, which must not do the agents' work itself. Agents communicate only through JSON/Markdown files in the run dir (absolute paths passed by the skill):

```
deep-search → sources.json    (sonnet, WebSearch, keeps 15 best sources)
architect   → structure.json  (opus, title + sections + word budget)
dispatch    → dispatch.json   (sonnet, key points/source refs per section)
writer      → sections/NN-id.md  (opus, one agent per section, run in parallel)
diagrammer  → diagrams.json   (opus, optional Mermaid per section)
skill       → article.md      (assembled verbatim, diagrams validated)
```

Things that span multiple files:
- The JSON schemas of `sources.json`, `structure.json`, `dispatch.json`, `diagrams.json` are defined implicitly by the producing agent's prompt and consumed by later agents and by the assembly step in SKILL.md. Changing a field means updating the producer, every consumer, and the data-flow section of README.md.
- Writer agents receive a position (`first`/`middle`/`last`); hook rules apply to the first section and conclusion/CTA rules to the last. The section heading is added by the skill at assembly, so writers output the body only.
- Title, structure and voice rules live in `architect.md` and `writer.md` respectively; Mermaid keyword whitelist lives in SKILL.md's assembly step.
- The skill's `allowed-tools` is restricted (Read, Write, `date`, `mkdir`); agents are referenced by the namespaced name `article-companion:<agent>`.

## Notes

- README.md documents install, usage and the agent table; keep it in sync when adding or changing agents.
- README references `prompt.example.md` (brief template), which is currently deleted in the working tree.
