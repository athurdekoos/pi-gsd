# ADR-006: Hot-Reload Commands via Re-Read at Invocation

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

Command definitions are markdown files. Should they be read once at startup or on every invocation?

## Decision

Read command `.md` files at registration time for description (autocomplete), but re-read the body at invocation time.

## Rationale (inferred)

1. **Rapid iteration** — Edit a workflow, run `/reload`, invoke the command — changes take effect immediately
2. **No compilation** — No build step between editing and testing
3. **Development experience** — Essential for workflow development where you're iterating on LLM instructions

## Consequences

- Every command invocation reads from disk (minor I/O cost)
- File system errors at invocation time must be handled gracefully
- Description in autocomplete may be stale until Pi restarts

## Evidence

```typescript
// extensions/gsd/commands.ts, handler function
handler: async (args: string, ctx: any) => {
  // Re-read at invocation time so edits take effect without restart
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch { ... }
```
