# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**article-companion** is a multi-agent system for writing high-quality articles. The current implementation is a **simple, linear pipeline of 5 specialized agents** run in a fixed order:

- **DeepSearch**: finds the 15 most relevant sources for the topic (Tavily web search + Gemini ranking).
- **Architect**: designs a logical article structure sized to the requested length.
- **Dispatch**: maps the source substance into each section (content, not writing style).
- **Writer**: rewrites each section into human-sounding prose following fixed style rules.
- **Diagrammer**: optionally adds one Mermaid diagram per section to explain a hard concept or the section's logic; skips sections where a diagram adds nothing.

The agents run sequentially, each consuming the previous one's structured output. Orchestration is a plain async function (`source/workflow.ts`), not a routing/supervisor agent, because the flow is deterministic and linear.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun (package manager, runtime, and test runner; loads `.env.local` natively)
- **LLM Framework**: LangChain — `@langchain/core` + `@langchain/google` (`ChatGoogle`)
- **Model Provider**: Google Gemini via `@langchain/google` (Google AI platform, `GOOGLE_API_KEY`)
- **Web search**: Tavily via `@langchain/tavily` (`TAVILY_API_KEY`)
- **Schema/validation**: `zod` v4 (structured outputs via `.withStructuredOutput`)

## Architecture & Key Files

The current implementation is a **simple linear pipeline of 5 agents**, orchestrated by a plain async function (not LangGraph) because the flow is deterministic and linear.

```
prompt.md                  # user brief (English: topic + optional length/tone/audience)
.env.local                 # GOOGLE_API_KEY, TAVILY_API_KEY (gitignored; see .env.example)
source/
  index.ts                 # entry point: read prompt.md -> run workflow -> write outputs
  workflow.ts              # sequential orchestrator (DeepSearch -> Architect -> Dispatch -> Writer -> Diagrammer)
  config/env.ts            # env validation (Bun loads .env.local natively)
  config/models.ts         # makeGoogleModel("flash"|"pro") factory over ChatGoogle
  types/index.ts           # shared interfaces (Source, ArticleStructure, DispatchedSection, WrittenSection, SectionDiagram, AgentResult<T>)
  agents/deepSearch.ts     # 15 best sources via Tavily search + Gemini ranking (flash)
  agents/architect.ts      # logical article structure sized to requested length (pro)
  agents/dispatch.ts       # maps source substance into each section, content not form (flash)
  agents/writer.ts         # rewrites each section with humanization rules, English (pro); also exports assembleArticle()
  agents/diagrammer.ts     # optional Mermaid diagram per section, explains hard concepts (pro)
  utils/io.ts              # read prompt.md, write output/article-<date>.md and logs-<date>.md
  utils/logger.ts          # accumulates AgentResult, renders the debug log
output/                    # article-<date>.md (final article) + logs-<date>.md (per-agent debug)
```

**Pipeline data flow:** DeepSearch returns `Source[]` -> Architect returns `ArticleStructure` -> Dispatch returns `DispatchedSection[]` (key points + source refs) -> Writer returns `WrittenSection[]` (per-section prose) -> Diagrammer returns `SectionDiagram[]` (optional Mermaid per section). The workflow then calls `assembleArticle()` (exported from `writer.ts`) to stitch sections + diagrams into the final Markdown. DeepSearch, Architect, Dispatch, and Diagrammer use `.withStructuredOutput(zodSchema)`; Writer returns prose.

**Models:** `gemini-2.5-flash` for search/dispatch (speed), `gemini-2.5-pro` for architect/writer/diagrammer (quality). Provider: `@langchain/google` (`ChatGoogle`, Google AI platform via `GOOGLE_API_KEY`).

**Language:** `prompt.md` and the generated article are in **English**; agent system prompts enforce English output.

**Run:** `bun run start`.

### Key Patterns

**Agent Interface**: All agents implement a common contract:

- Input: Task description + context
- Output: Structured result with content + metadata
- Error handling: Graceful fallbacks and error reporting

**Sequential orchestration** (`source/workflow.ts`):

- Calls the 5 agents in a fixed order, threading each one's structured output into the next
- Records every agent run in `WorkflowLogger`, rendered to `output/logs-<date>.md`
- No dynamic routing or supervisor: the pipeline is deterministic

**Gemini + zod structured output gotcha**:

- Gemini function-declaration schemas reject exclusive-bound keywords. Avoid `.positive()`, `.nonnegative()`, `.gt()`, `.lt()` in zod schemas (they emit `exclusiveMinimum`/`exclusiveMaximum`).
- Use inclusive bounds instead: `.min()` / `.max()` (emit `minimum` / `maximum`, which Gemini accepts).

## Guidelines

### Code Organization

- Keep agents independent and single-purpose
- Use TypeScript interfaces to define agent contracts
- Centralize shared types in `source/types/`
- Use environment variables (via `.env.local`) for configuration, never hardcode secrets

### Agent Development

- Each agent should validate its input and return structured output
- Include clear logging at key execution points
- Handle API rate limits and transient failures gracefully
- Document the specific role and expected input/output for each agent

### Performance Considerations

- Leverage prompt caching to reduce API costs and latency for repeated contexts
- The 5 agents are sequential by dependency, but Writer and Diagrammer both process sections one at a time — these per-section calls could be parallelized (independent per section)
- Profile API calls and token usage to optimize prompt design

## Maintaining This File

This CLAUDE.md should be updated whenever making significant changes to the project:

- **Architecture changes**: If adding/removing agents or changing the pipeline order, update "Architecture & Key Files" and the data-flow description
- **New features**: If adding new functionality (e.g., parallel section writing, new agents, alternative search providers), document it in the appropriate section
- **Dependency updates**: Keep the "Tech Stack" section in sync with `package.json` if major packages are added/removed
- **Setup changes**: If the run command or required env vars change, update the "Run" line and `.env.example`
- **Model changes**: If model tiers or the `makeGoogleModel` selection strategy change, update the "Models" note

Regular updates keep this guidance helpful for future Claude instances and reduce context-gathering overhead.

## Working with Linear

When you work on the implementation of a Linear issue, write the implementation plan in the content of the Linear issue using the Linear MCP.
