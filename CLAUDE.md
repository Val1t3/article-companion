# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. These bias toward caution over speed — for trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Project Overview

**article-companion** is a **Claude Code plugin** for writing high-quality Medium-style articles. It is made only of Markdown agent and skill definitions: no runtime code, no external API keys.

A `write-article` skill orchestrates a **simple, linear pipeline of 5 specialized subagents** run in a fixed order:

- **deep-search**: finds the 15 most relevant sources for the topic (`WebSearch` + ranking).
- **architect**: designs a logical article structure sized to the requested length, enforcing the Medium title and structure rules (charged title, hook intro, conclusion+CTA last, scannable one-idea sections).
- **dispatch**: maps the source substance into each section (content, not writing style); also ensures each concept has a concrete example and flags concepts needing an analogy.
- **writer**: writes one section into human-sounding prose enforcing the Medium tone/voice, analogy-first explanation, flow, and formatting rules; applies hook rules to the first section and conclusion/CTA rules to the last.
- **diagrammer**: optionally adds one Mermaid diagram per section as an in-article visual to explain a hard concept or the section's logic; skips sections where a diagram adds nothing.

The Medium writing-rule set (title/hook, structure/flow, tone/voice, explanations/analogies, visuals/formatting, conclusion/CTA) is embedded directly in each agent's system prompt (`agents/*.md`).

## Tech Stack

- **Format**: Claude Code plugin (`.claude-plugin/plugin.json`, `agents/`, `skills/`)
- **Models**: Claude, selected per agent via the `model` frontmatter (`sonnet` / `opus`)
- **Web search**: Claude Code built-in `WebSearch` / `WebFetch`
- **Data exchange**: JSON and Markdown files in a per-run directory (`output/<slug>/`)

## Architecture & Key Files

Subagents cannot spawn other subagents, so orchestration lives in the **skill** (which runs in the main conversation), not in an agent.

```
.claude-plugin/plugin.json       # plugin manifest
.claude-plugin/marketplace.json  # single-plugin marketplace (install from this repo)
agents/deep-search.md            # 15 best sources via WebSearch + ranking (sonnet)
agents/architect.md              # article structure sized to requested length (opus)
agents/dispatch.md               # maps source substance into each section, content not form (sonnet)
agents/writer.md                 # writes ONE section with humanization rules, English (opus)
agents/diagrammer.md             # optional Mermaid diagram per section (opus)
skills/write-article/SKILL.md    # orchestrator: reads brief, runs the 5 agents, assembles article.md
prompt.example.md                # brief template (copy to prompt.md)
output/<slug>/                   # brief.md, sources.json, structure.json, dispatch.json, sections/, diagrams.json, article.md
```

**Pipeline data flow:** deep-search writes `sources.json` -> architect writes `structure.json` -> dispatch writes `dispatch.json` (key points + source refs per section) -> writer (one agent per section, launched in parallel) writes `sections/<NN>-<id>.md` -> diagrammer writes `diagrams.json`. The skill then stitches title + sections + diagrams into `article.md`. The JSON shapes are specified in each agent's "Output" section; keep them in sync with the readers (downstream agents and the skill's assembly step) when changing one.

**Models:** `sonnet` for deep-search/dispatch (speed), `opus` for architect/writer/diagrammer (quality).

**Language:** the brief and the generated article are in **English**; agent prompts enforce English output.

**Run:** `/article-companion:write-article [brief]` (reads `prompt.md` when no brief is given).

### Key Patterns

**Agent contract** (every `agents/*.md`):

- Input: absolute paths to upstream files + an output path, passed by the skill
- Output: writes its result file, then replies with a one-line summary (used for progress reporting)
- Failure: the skill retries a failed step once, then stops and reports which step failed

**Sequential orchestration** (`skills/write-article/SKILL.md`):

- Calls the 5 agents in a fixed order, each reading the previous ones' files
- Intermediate files in the run dir double as the debug log
- No dynamic routing or supervisor: the pipeline is deterministic

## Guidelines

- Keep agents independent and single-purpose; one file per agent in `agents/`
- Agent names are namespaced by the plugin when invoked: `article-companion:<agent-name>`
- Give each agent only the tools it needs (`tools` frontmatter)
- Writing rules belong in the agent that applies them; do not duplicate them in the skill

## Maintaining This File

This CLAUDE.md should be updated whenever making significant changes to the project:

- **Architecture changes**: If adding/removing agents or changing the pipeline order, update "Architecture & Key Files", the data-flow description, the skill, and the README diagram
- **New features**: If adding new functionality (new agents, new skills, alternative outputs), document it in the appropriate section
- **File contract changes**: If an agent's output shape changes, update its readers and the README data-flow block
- **Setup changes**: If the run command or install steps change, update the "Run" line and the README
- **Model changes**: If an agent's `model` changes, update the "Models" note

Regular updates keep this guidance helpful for future Claude instances and reduce context-gathering overhead.

## Working with Linear

When you work on the implementation of a Linear issue, write the implementation plan in the content of the Linear issue using the Linear MCP.
