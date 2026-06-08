---
description: Handle a Linear issue end-to-end — plan, validate, write to Linear, branch, and implement
argument-hint: Linear issue ID or URL (e.g. ATC-12 or https://linear.app/...)
---

# Linear Handler

You are helping a developer plan and implement a Linear issue. Follow this process strictly, in order.

Issue reference: $ARGUMENTS

---

## Phase 1: Fetch the Issue

1. Use the Linear MCP to fetch the issue identified by $ARGUMENTS.
   - If no argument is provided, ask the user for the issue ID before proceeding.
   - Extract: title, description, acceptance criteria, linked issues, and any existing comments.

---

## Phase 2: Codebase Exploration

**Goal**: Understand the parts of the codebase affected by this issue before designing anything.

1. Read CLAUDE.md to understand the project architecture, conventions, and constraints.
2. Launch 2 parallel Explore agents to locate relevant code:
   - Agent 1: "Find files and symbols most relevant to implementing [issue title]. List the 5-10 key files with a one-line reason each."
   - Agent 2: "Find existing patterns in the codebase similar to what [issue title] requires. List the 5-10 key files with a one-line reason each."
3. Read all files identified by the agents to build detailed context.

---

## Phase 3: Implementation Plan

**Goal**: Draft a concrete, step-by-step implementation plan.

The plan must include:

- **Objective**: one sentence restating what the issue asks for
- **Approach**: the chosen technical approach and why
- **Steps**: an ordered, numbered checklist of concrete actions (file changes, new files, deletions, config changes, etc.)
- **Out of scope**: anything explicitly excluded
- **Open questions** (if any): unresolved ambiguities that need user input

Present the plan clearly in Markdown. Do NOT start implementing yet.

---

## Phase 4: User Validation

**CRITICAL — do not skip.**

Ask the user:

> "Does this plan look good? Any changes before I write it to Linear and start implementing?"

Wait for explicit approval. If the user requests changes, revise the plan and ask again. Repeat until the user approves.

---

## Phase 5: Write Plan

Once the user has approved the plan:

1. Present the final approved plan in a Markdown code block so the user can copy it.
2. Ask the user to paste it into the Linear issue themselves (as the issue description or as a comment titled "## Implementation Plan").
3. Wait for the user to confirm they have updated the issue before proceeding.

---

## Phase 6: Branch Setup

**Do not start before the user has confirmed Phase 5 is complete.**

1. Check the current branch with `git branch --show-current`.
2. Derive the expected branch name from the issue: Linear uses the format `<username>/<issue-id>-<slugified-title>` (e.g. `val1t3/atc-12-add-diagrammer-agent`). Accept any branch whose name contains the issue ID (case-insensitive) as a match.
3. **If already on the correct branch**: proceed to Phase 7.
4. **If the branch exists locally or remotely but is not checked out**: switch to it with `git checkout <branch>`.
5. **If no matching branch exists**: create one from `main` with `git checkout main && git pull && git checkout -b <branch-name>`, using the Linear-style naming convention above.
6. Confirm the active branch to the user before proceeding.

---

## Phase 7: Implementation

1. Implement the plan step by step, following the checklist from Phase 3.
2. Follow all conventions in CLAUDE.md strictly.
3. After each significant step, briefly note what was done and what is next.
4. When all steps are done, summarize: files changed, decisions made, and any suggested follow-ups.
