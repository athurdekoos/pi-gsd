# ADR-002: Markdown as Code for Workflows and Agents

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

GSD needs to define orchestration logic (workflows) and specialized roles (agents) that an LLM will follow. Options: TypeScript/JavaScript code, JSON configuration, or markdown-as-code.

## Decision

Define workflows (`gsd/workflows/*.md`) and agents (`agents/*.md`) as structured markdown files that the LLM reads and follows as instructions.

## Rationale (inferred)

1. **LLM-native format** — LLMs are trained on markdown. Structured markdown with XML-like tags (`<step>`, `<role>`) is naturally understandable by the LLM without parsing or compilation.
2. **Non-engineer accessibility** — Workflow logic can be read, understood, and modified by anyone who can read English. No programming knowledge required.
3. **Hot-reload** — Markdown files can be edited and take effect on next invocation. No compilation, no restart.
4. **Prompt engineering** — Workflows ARE prompts. Writing them as markdown allows direct prompt engineering without a code-to-prompt translation layer.

## Consequences

**Positive:**
- Workflows are readable by anyone
- Changes take effect immediately
- Natural LLM consumption
- Version control shows clear diffs of behavior changes

**Negative:**
- No type safety or static analysis for workflows
- LLM may deviate from instructions (non-deterministic execution)
- No automated testing of workflow logic
- Workflow syntax errors are silent (LLM interprets them as-is)

## Evidence

- 30+ workflow files in `gsd/workflows/`
- 11 agent definitions in `agents/`
- `extensions/gsd/commands.ts` — sends workflow content as user message via `pi.sendUserMessage()`
- No workflow compiler or interpreter in the codebase
