# ADR-008: Graceful Extension Degradation

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

Pi extensions should not crash the host runtime if they fail to initialize.

## Decision

If critical resources are missing (`gsd/` directory, `gsd-tools.cjs`), write to stderr and `return` silently. Do not throw.

## Rationale (inferred)

1. **Host stability** — A broken extension should not prevent Pi from functioning
2. **Diagnostic visibility** — stderr messages inform the user without crashing
3. **Pi extension contract** — Extensions that throw during initialization may cause undefined behavior

## Evidence

```typescript
// extensions/gsd/index.ts
if (!fs.existsSync(resolver.gsdHome)) {
  process.stderr.write("[pi-gsd] gsd/ directory not found at " + resolver.gsdHome + "\n");
  return;  // No throw
}
```

Similarly for event handlers — they check preconditions (`.planning/` exists) before acting.
