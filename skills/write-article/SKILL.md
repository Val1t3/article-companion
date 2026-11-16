---
name: write-article
description: Write a sourced, human-sounding Medium-style article from a one-line brief by running the article-companion pipeline (deep-search -> architect -> dispatch -> writer -> diagrammer). Use when the user asks to write, draft or generate an article or blog post on a topic.
argument-hint: "[article brief] (defaults to prompt.md)"
allowed-tools: Read, Write, Bash(date:*), Bash(mkdir:*)
---

# Write an article

You orchestrate a fixed, linear pipeline of 5 specialized subagents. There is no dynamic routing: run them in this exact order, each one consuming the files produced by the previous ones. Do not do their work yourself.

Brief: $ARGUMENTS

## 1. Read the brief

- If a brief is given above, use it.
- Otherwise read `prompt.md` in the current directory (ignore HTML comments). If it is missing or empty, stop and ask the user for a brief.
- The brief is in English. It may specify length, audience, tone, things to include or avoid.

## 2. Prepare the run directory

Get a slug with `date +%Y-%m-%d_%H-%M-%S` and create `output/<slug>/sections/`. Call `output/<slug>` the **run dir**. Write the brief to `<run dir>/brief.md`.

Always pass **absolute paths** to the subagents.

## 3. Run the pipeline

Report one short progress line to the user after each step (use the one-line reply of each agent).

1. **DeepSearch** — launch the `article-companion:deep-search` agent with the brief and the output path `<run dir>/sources.json`.
   If it reports that no source was found, stop and tell the user.
2. **Architect** — launch `article-companion:architect` with the brief, `<run dir>/sources.json`, and the output path `<run dir>/structure.json`.
3. **Dispatch** — launch `article-companion:dispatch` with `<run dir>/sources.json`, `<run dir>/structure.json`, and the output path `<run dir>/dispatch.json`.
4. **Writer** — read `structure.json`. For **each** section, launch one `article-companion:writer` agent with: the paths to `structure.json`, `dispatch.json` and `sources.json`; the section id; its position (`first` for the first section, `last` for the last one, `middle` otherwise); and the output path `<run dir>/sections/<NN>-<id>.md`, where `NN` is the 2-digit 1-based index. Sections are independent: launch all writer agents in parallel, in a single message.
5. **Diagrammer** — launch `article-companion:diagrammer` with `<run dir>/structure.json`, `<run dir>/sections/`, and the output path `<run dir>/diagrams.json`.

If an agent fails or its output file is missing or not valid JSON, retry it once; if it fails again, stop and report which step failed and why.

## 4. Assemble the article

Read `structure.json`, every section file, and `diagrams.json`, then write `<run dir>/article.md` exactly in this layout:

````markdown
# <title>

## <section 1 heading>

<section 1 body>

```mermaid
<mermaid source, only if this section's diagram has include: true>
```

*<caption, only if non-empty>*

## <section 2 heading>

...
````

- Sections in `structure.json` order, separated by a blank line.
- Copy section bodies verbatim. Do not rewrite, trim or "improve" them.
- Skip a diagram if its `mermaid` is empty or does not start with a known Mermaid keyword (`flowchart`, `graph`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `stateDiagram-v2`, `erDiagram`, `journey`, `gantt`, `pie`, `mindmap`, `timeline`, `quadrantChart`). Strip any stray ```` ``` ```` fence the agent may have left in the source.

## 5. Report

Tell the user:
- the article title and the path to `article.md`;
- per step: sources kept, number of sections and target words, key points dispatched, sections written, diagrams added;
- that every intermediate file (`sources.json`, `structure.json`, `dispatch.json`, `sections/`, `diagrams.json`) is in the run dir for debugging.
