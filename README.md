# article-companion

A Claude Code plugin that helps you write high-quality, sourced, human-sounding articles from a one-line brief.

---


### Agents in detail

| Agent | Model | Role |
|---|---|---|
| **deep-search** | `sonnet` | Generates 5 search queries, runs them with `WebSearch` (up to 8 results each), deduplicates, then re-ranks to keep the 15 most relevant sources. |
| **architect** | `opus` | Designs the article structure: a compelling title (must contain a number, claim, or tension), a hook intro, body sections with standalone headings, and a conclusion with a CTA. Word budget is derived from the brief. |
| **dispatch** | `sonnet` | For each section, extracts the key points and substance from the sources. Produces bullet facts and source references, no prose yet. |
| **writer** | `opus` | Writes one section as final Markdown prose: analogy-first explanations, conversational tone, enforced Medium voice and formatting rules. Hook rules apply to the first section, conclusion/CTA rules to the last. |
| **diagrammer** | `opus` | Evaluates each section and, where a diagram genuinely helps, produces a Mermaid diagram with a caption. Sections where a visual adds nothing are skipped. |


### Skills in detail

| Skill | Role |
|---|---|
| **write-article** | The orchestrator (`/article-companion:write-article`). Runs the five agents in order, validates the Mermaid diagrams and assembles `article.md`. |
| **humanizer** | Rewrites AI-sounding text so it reads like a person wrote it, without changing what it says. It looks for 26 patterns of AI writing (not-X-but-Y contrasts, one-line closers, forced triads, inflated claims, stock AI words, bold as decoration, etc.). Adapted from the open-source [blader/humanizer](https://github.com/blader/humanizer) skill (MIT) and modified for this project. See [skills/humanizer/README.md](skills/humanizer/README.md). |

---

## Project structure

```
.claude-plugin/
  plugin.json              # plugin manifest
  marketplace.json         # lets you install the plugin from this repo
agents/
  deep-search.md           # 15 best sources via WebSearch + ranking
  architect.md             # article structure + title rules
  dispatch.md              # substance mapping per section
  writer.md                # prose generation for one section
  diagrammer.md            # optional Mermaid diagrams
skills/
  write-article/SKILL.md   # orchestrator: runs the 5 agents, assembles article.md
  humanizer/SKILL.md       # removes AI writing patterns (adapted from blader/humanizer, MIT)
prompt.example.md          # brief template
output/                    # generated runs (gitignored)
```

---

## Setup

### Prerequisites

- [Claude Code](https://claude.com/claude-code) with access to the `WebSearch` tool.

No API key or runtime is needed: everything runs inside Claude Code.

### Install

From Claude Code, add this repository as a marketplace and install the plugin:

```
/plugin marketplace add Val1t3/article-companion
/plugin install article-companion@article-companion
```

For local development, point the marketplace at your clone instead:

```
/plugin marketplace add /path/to/article-companion
```

Or load it for a single session: `claude --plugin-dir /path/to/article-companion`.

---

## Usage

```
/article-companion:write-article Write a 2000-word article for senior engineers about the trade-offs of event-driven architecture vs. request-response in distributed systems.
```

You can also just ask Claude to write an article: the skill triggers on its own.
