# ADR-011: Commands Delivered as User Messages

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

When a user types `/gsd:plan-phase 3`, the extension needs to trigger the workflow. Options: execute workflow logic in TypeScript, or deliver the workflow instructions to the LLM.

## Decision

Command handlers transform the workflow markdown and send it as a user message via `pi.sendUserMessage()`. The LLM then reads the instructions and follows them.

## Rationale (inferred)

1. **LLM as orchestrator** — The workflow IS a prompt. The LLM reads it and decides what to do, using its reasoning ability.
2. **No workflow engine needed** — No state machine, no step executor, no conditional logic in TypeScript.
3. **Flexibility** — The LLM can adapt to unexpected situations (errors, user questions) without hardcoded error handling.
4. **Minimal extension code** — 3 TypeScript files vs a full workflow engine.

## Consequences

- Command handler is ~10 lines of code (read file, transform, send)
- Workflow execution is non-deterministic (LLM may deviate)
- No programmatic error handling for workflow steps
- No workflow state tracking (beyond what the LLM writes to STATE.md)
- Token cost: workflow instructions consume LLM context

## Evidence

```typescript
// extensions/gsd/commands.ts
const transformed = resolver.transform(body, args?.trim() ?? "");
pi.sendUserMessage(transformed);
```

- No workflow executor/interpreter in the codebase
- All orchestration logic lives in markdown workflows, not TypeScript
