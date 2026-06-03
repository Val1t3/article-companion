# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**article-companion** is a hierarchical multi-agent system for writing high-quality articles. The architecture consists of:

- **Supervisor Agent**: An intelligent routing agent that orchestrates the workflow, delegates tasks to specialized sub-agents, and synthesizes their outputs.
- **Specialized Sub-agents**: Domain-specific agents that handle distinct article-writing responsibilities (e.g., research, outlining, drafting, editing, fact-checking).
- **Coordination Layer**: Manages inter-agent communication, context passing, and execution flow.

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Bun (package manager, runtime, and test runner)
- **API**: Claude API (Anthropic SDK)

## Architecture & Key Files

### Key Patterns

**Agent Interface**: All agents implement a common contract:
- Input: Task description + context
- Output: Structured result with content + metadata
- Error handling: Graceful fallbacks and error reporting

**Supervisor Coordination**:
- Routes tasks to appropriate agents based on article requirements
- Maintains shared context across agents
- Handles inter-agent dependencies and sequencing
- Synthesizes outputs into final article

## Guidelines

### Code Organization
- Keep agents independent and single-purpose
- Use TypeScript interfaces to define agent contracts
- Centralize shared types in `src/types/`
- Use environment variables (via `.env.local`) for configuration, never hardcode secrets

### Agent Development
- Each agent should validate its input and return structured output
- Include clear logging at key execution points
- Handle API rate limits and transient failures gracefully
- Document the specific role and expected input/output for each agent

### Performance Considerations
- Leverage prompt caching to reduce API costs and latency for repeated contexts
- Consider parallel execution of independent agents
- Profile API calls and token usage to optimize prompt design

## Maintaining This File

This CLAUDE.md should be updated whenever making significant changes to the project:

- **Architecture changes**: If refactoring the detection pipeline or adding new processing steps, update the "Architecture Notes" section
- **New features**: If adding new functionality (e.g., multi-model support, different input sources, tracking across frames), document in the appropriate section
- **Dependency updates**: Keep the Dependencies section in sync with `pyproject.toml` if major packages are added/removed
- **Setup changes**: If development setup or installation process changes, update "Setup & Environment" and "Running the Application"
- **Model changes**: If new models are added or the selection strategy changes, update "Model Files"

Regular updates keep this guidance helpful for future Claude instances and reduce context-gathering overhead.
