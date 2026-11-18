# article-companion

A Claude Code plugin that helps you write high-quality, sourced, human-sounding articles from a one-line brief.

---


## How it works

The `orchestrator` agent is the plugin's main agent. It never writes or researches itself: it runs specialized agents, reads their outputs and decides what happens next. It works autonomously: you give it the full context of the article up front, and it does not ask you anything during the run.

```
brief ──► research ──► writing ──► review ──► decision ──► final
             ▲            ▲                      │
             │            └──── rewrite ◄────────┤
             └───────────────── research ◄───────┘
```

1. **Brief.** The orchestrator turns your context into `brief.md`, using defaults for what you did not specify. Without a researchable subject, it stops and tells you what is missing.
2. **Research.** `deep-search` finds sources, `fact-extractor` reads them and keeps only facts backed by a verbatim quote. Inventing information is forbidden: the writer may only use these verified facts.
3. **Writing.** `writer` produces a full draft and maps every factual claim to the facts that support it.
4. **Review.** `fact-checker`, `editor` and `style-reviewer` score the draft in parallel, each on its own criterion. Every issue says whether it can be fixed by rewriting or needs more research.
5. **Decision.** The orchestrator accepts the draft, sends it back to the writer, or starts a new research round targeting the gaps. After 3 drafts it stops and reports what is left.

### Article memory

Each article gets its own folder, `articles/<slug>/`, which holds its whole history. Agents communicate only through these files, and every agent reads the folder's `MEMORY.md` (the format spec) first.

```
articles/<slug>/
  MEMORY.md              # layout + format of every file
  STYLE.md               # editorial rules
  voice/                 # X voice references for the writer (read-only)
  state.json             # status, counters, step history (lets you resume)
  brief.md               # subject, audience, length, angle
  research/sources.json  # sources, all rounds            (deep-search)
  research/facts.json    # quoted, verified facts          (fact-extractor)
  drafts/vN/article.md   # draft N                         (writer)
  drafts/vN/claims.json  # claim -> fact ids               (writer)
  drafts/vN/changelog.md # how reviews were addressed      (writer, N >= 2)
  reviews/vN/*.json      # one review per reviewer + the orchestrator's decision.json
  final/article.md       # the accepted draft
```

The folder is created and maintained by the `article-memory` CLI (Python, managed with uv), which the orchestrator calls through Bash: `init`, `status`, `next-round`, `next-draft`, `log`, `validate` (checks every file against its format, plus fact → source and claim → fact references) and `finalize`. Agents never edit `state.json` by hand.

To resume an interrupted article, start the orchestrator with the folder path as its context.

### Agents in detail

| Agent | Model | Role |
|---|---|---|
| **orchestrator** | `opus` | Main agent. Builds the brief, creates the article memory, runs the research → writing → review loop, decides, and publishes `final/article.md`. Manages the memory folder with `article-memory`. |
| **deep-search** | `sonnet` | Writes up to 5 search queries per round, runs them with `WebSearch`, deduplicates, keeps the best sources (15 in round 1, 8 in later rounds targeting gaps). |
| **fact-extractor** | `sonnet` | Fetches each source and records atomic facts, each with a verbatim quote from the page. Rejects sources it cannot read and lists the remaining gaps. |
| **writer** | `opus` | Writes or revises the full draft of an X Article (title, hook, sections, conclusion + CTA) from the verified facts only, following `STYLE.md`, in a spoken, builder-minded voice modeled on Meng To's X writing (`voice/`). |
| **fact-checker** | `opus` | Checks every factual statement of the draft against the facts: support, exact numbers, attribution, links. |
| **editor** | `opus` | Judges fit with the brief, argument, title, structure, length, and whether the research is deep enough. |
| **style-reviewer** | `opus` | Judges voice, flow and formatting against `STYLE.md`, and flags AI-writing patterns using the humanizer catalogue. |

### Skills in detail

| Skill | Role |
|---|---|
| **humanizer** | Rewrites AI-sounding text so it reads like a person wrote it, without changing what it says. It looks for 26 patterns of AI writing (not-X-but-Y contrasts, one-line closers, forced triads, inflated claims, stock AI words, bold as decoration, etc.). Loaded by `style-reviewer` as a pattern catalogue; also usable on its own. Adapted from the open-source [blader/humanizer](https://github.com/blader/humanizer) skill (MIT) and modified for this project. See [skills/humanizer/README.md](skills/humanizer/README.md). |

---

## Project structure

```
.claude-plugin/
  plugin.json                     # plugin manifest
  marketplace.json                # lets you install the plugin from this repo
agents/
  orchestrator.md                 # main agent: workflow and decisions
  deep-search.md                  # sources via WebSearch
  fact-extractor.md               # verified, quoted facts
  writer.md                       # full draft / revision
  fact-checker.md                 # review: accuracy
  editor.md                       # review: brief, argument, structure
  style-reviewer.md               # review: voice, flow, AI patterns
skills/
  humanizer/SKILL.md              # removes AI writing patterns (adapted from blader/humanizer, MIT)
bin/
  article-memory                  # shim on the plugin PATH: runs the CLI with uv
tools/article-memory/             # uv project (Python >= 3.11, pydantic)
  src/article_memory/cli.py       # commands
  src/article_memory/memory.py    # folder operations + validation
  src/article_memory/models.py    # pydantic models of every memory file
  src/article_memory/templates/   # MEMORY.md (memory spec) and STYLE.md (editorial rules)
  src/article_memory/templates/voice/  # writer's X voice: voice-profile.md + tweet-corpus.jsonl (from MengTo/Skills, MIT)
articles/                         # generated article memories (gitignored)
```

---

## Setup

### Prerequisites

- [Claude Code](https://claude.com/claude-code) with access to the `WebSearch` tool.
- [uv](https://docs.astral.sh/uv/): runs the `article-memory` tool (it installs Python and the dependencies on first use).

No API key is needed.

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

The orchestrator must run as the session's **main agent** (only the main agent can launch subagents), so start Claude Code with `--agent` and give it the full context of the article:

```
claude --agent article-companion:orchestrator "Write a 2000-word article for senior engineers about the trade-offs of event-driven architecture vs. request-response in distributed systems. Angle: request-response is underrated."
```

Add `-p` to run it headless. The more context you give (subject, audience, length, angle, things to include or avoid), the less the orchestrator has to assume. To resume an article:

```
claude --agent article-companion:orchestrator "articles/<slug>"
```

