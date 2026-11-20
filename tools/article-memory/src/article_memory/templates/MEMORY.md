# Article memory

This folder is the **memory of one article**. Every agent that works on the article reads and writes here, and nowhere else. It records the whole history of the article: the brief, the research, every draft, every review and every decision. Anyone (human or agent) must be able to understand where the article stands by reading this folder alone.

The `orchestrator` agent creates the folder (with the `article-memory` tool) and passes its **absolute path** to every agent as the **article dir**. All paths below are relative to it.

## Rules for every agent

1. **Read this file first**, then only the files your task needs.
2. **Write only the files you own** (see the table). Never edit or delete a file owned by another agent, and never rewrite a past version: versions are append-only history.
3. **Follow the formats exactly.** JSON must be valid (no comments, no trailing commas). Downstream agents parse these files, and the orchestrator validates each one against these formats after every step: an invalid file is sent back to its owner.
4. **Never invent information.** Every fact in this folder traces back to a source in `research/sources.json` that was actually read. If something is not in the research, it does not exist for the article.
5. When you finish, reply to the orchestrator with **one line** summarizing what you wrote.

## Layout

| Path | Owner | Content |
|---|---|---|
| `MEMORY.md` | orchestrator | This file (format reference). |
| `STYLE.md` | orchestrator | Editorial rules: title, structure, voice, formatting. Read by the writer and the reviewers. |
| `voice/` | orchestrator, via `article-memory` | Voice references for the writer: `voice-profile.md` and `tweet-corpus.jsonl` (Meng To's X writing, MIT, see `voice/ATTRIBUTION.md`). Read-only. |
| `state.json` | orchestrator, via `article-memory` | Current status, iteration counters, step history. Never edited by hand. |
| `brief.md` | orchestrator | What the user wants: subject, audience, length, angle. |
| `research/sources.json` | deep-search | Sources found on the web, all rounds. |
| `research/facts.json` | fact-extractor | Verified, atomic facts extracted from the sources, all rounds. |
| `drafts/vN/article.md` | writer | Draft number N of the full article. |
| `drafts/vN/claims.json` | writer | Map from every factual claim of draft N to the facts that support it. |
| `drafts/vN/changelog.md` | writer | For N ≥ 2: how the reviews of draft N-1 were addressed. |
| `reviews/vN/<reviewer>.json` | each reviewer | One review of draft N (`fact-checker.json`, `editor.json`, `style-reviewer.json`). |
| `reviews/vN/decision.json` | orchestrator | What the orchestrator decided after reading the reviews of draft N. |
| `final/article.md` | orchestrator, via `article-memory` | The accepted draft, copied verbatim. |

`N` starts at 1 and increases by one for each new draft. `reviews/vN/` always reviews `drafts/vN/`.

## Formats

### `state.json`

```json
{
  "slug": "event-driven-vs-request-response",
  "createdAt": "2026-11-18T14:22:00+01:00",
  "updatedAt": "2026-11-18T14:40:12+01:00",
  "status": "research",
  "draft": 1,
  "researchRound": 1,
  "maxDrafts": 3,
  "history": [
    { "at": "2026-11-18T14:25:03+01:00", "step": "deep-search", "draft": 0, "researchRound": 1, "result": "5 queries, 41 candidates, 15 sources kept" }
  ]
}
```

- `status`: `brief` | `research` | `writing` | `review` | `done` | `needs-attention` | `failed`.
- `draft`: number of the latest draft written (0 before the first one).
- `researchRound`: number of the latest research round (0 before the first one).
- `history`: append-only, one entry per agent run or decision, oldest first. `result` is the agent's one-line reply or the decision.

### `brief.md`

```markdown
# Brief

<the user's own words, verbatim>

## Parameters

- Audience: <who reads it; "curious non-expert" if unspecified>
- Length: <target word count; 700 if unspecified; never above the hard maximum of 800>
- Angle: <the point of view to defend, if given; otherwise "to be derived from the research">
- Must include: <items, or "nothing specific">
- Must avoid: <items, or "nothing specific">
- Language: English (always, whatever the language of the context above)
```

### `research/sources.json`

```json
{
  "rounds": [
    {
      "round": 1,
      "reason": "initial research",
      "queries": ["query 1", "query 2"],
      "candidateCount": 34
    }
  ],
  "sources": [
    {
      "id": 1,
      "round": 1,
      "title": "Source title",
      "url": "https://exact.url/from/search",
      "publisher": "Site or organization name",
      "published": "2025-03-14",
      "snippet": "Why this source is relevant, in one or two sentences.",
      "relevance": 0.92
    }
  ]
}
```

- `id` is a 1-based integer, unique and **stable forever**: a later round appends new sources with new ids and never renumbers or removes old ones.
- `url` is exactly the URL returned by the search. `published` is `null` when unknown.
- `relevance` is a number between 0 and 1. `reason` explains why the round was run (for rounds ≥ 2: the gaps it targets).

### `research/facts.json`

```json
{
  "facts": [
    {
      "id": "F1",
      "round": 1,
      "sourceId": 3,
      "claim": "One atomic factual statement, in plain English.",
      "quote": "The exact excerpt of the source page that supports the claim.",
      "kind": "statistic",
      "topic": "short-tag"
    }
  ],
  "rejected": [
    { "sourceId": 7, "reason": "Page could not be fetched (403)." }
  ],
  "gaps": ["Something the brief needs that no source supports."]
}
```

- `id` is `F` + an integer, unique and stable forever (later rounds append).
- `quote` is copied character for character from the page as it was fetched. A fact without a verbatim quote from a page that was actually read is not a fact.
- `kind`: `statistic` | `definition` | `event` | `example` | `expert-opinion` | `quote`.
- `rejected` lists sources that produced no fact and why. `gaps` holds the needs of the latest round that remain unsupported (it is rewritten each round).

### `drafts/vN/article.md`

The full article in Markdown: `# Title` on the first line, then `## Section heading` blocks. Factual claims link inline to the URL of their source (`[text](https://exact.url)`). The article is published as an X Article. No front matter, no comments, no fact ids in the prose.

### `drafts/vN/claims.json`

```json
{
  "draft": 1,
  "claims": [
    { "excerpt": "The sentence or clause, exactly as it appears in the draft.", "factIds": ["F3", "F8"] }
  ],
  "missingFacts": ["A fact the writer needed and did not find in facts.json."]
}
```

- Every sentence of the draft that states a fact (number, date, event, name, study result, quote, attribution) has an entry. Opinions, analogies and the author's reasoning do not.
- `missingFacts` lists what the writer had to leave out for lack of a verified fact. It may be empty.

### `drafts/vN/changelog.md`

A short bullet list, one bullet per review issue of draft N-1: the issue id, then what changed (or why it was not applied).

### `reviews/vN/<reviewer>.json`

```json
{
  "reviewer": "fact-checker",
  "draft": 1,
  "score": 7,
  "verdict": "revise",
  "summary": "Two or three sentences on the overall quality for this criterion.",
  "issues": [
    {
      "id": "FC1",
      "severity": "blocker",
      "route": "writing",
      "location": "## Section heading, or an exact excerpt of the draft",
      "problem": "What is wrong, concretely.",
      "suggestion": "What to do about it.",
      "researchNeed": null
    }
  ]
}
```

- `score`: integer from 0 to 10 on the reviewer's criterion. `verdict`: `pass` | `revise`. A reviewer must answer `revise` if it reports any `blocker` or `major` issue.
- Issue `id`: reviewer prefix (`FC` fact-checker, `ED` editor, `ST` style-reviewer) + an integer.
- `severity`: `blocker` (cannot ship) | `major` (clearly hurts the article) | `minor` (polish).
- `route`: `writing` if the writer can fix it with the existing facts; `research` if fixing it needs new verified facts. When `route` is `research`, `researchNeed` states the missing information as a search goal; otherwise it is `null`.

### `reviews/vN/decision.json`

```json
{
  "draft": 1,
  "decision": "rewrite",
  "reasons": ["FC1: unsupported statistic in the hook", "ED2: section 3 repeats section 2"],
  "researchNeeds": [],
  "decidedAt": "2026-11-18T14:52:40+01:00"
}
```

- `decision`: `accept` | `rewrite` (next draft from the same research) | `research` (new research round, then next draft) | `stop` (draft cap reached without acceptance).
