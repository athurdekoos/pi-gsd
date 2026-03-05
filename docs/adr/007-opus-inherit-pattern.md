# ADR-007: Return "inherit" Instead of "opus" for Model Resolution

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

GSD agents need specific model tiers (opus, sonnet, haiku). When resolving which model a subagent should use, the system could pass the literal string "opus" or something else.

## Decision

When an agent's profile resolves to "opus", return `"inherit"` instead. This causes the subagent to use whatever opus-tier model the user's Pi session has configured.

## Rationale (inferred)

1. **Version flexibility** — Organizations may block older opus versions while allowing newer ones. Passing `"inherit"` avoids hardcoding a specific version.
2. **No silent fallback** — If `"opus"` is passed but the specific version is unavailable, Pi might silently fall back to Sonnet. `"inherit"` uses the session's active model configuration.
3. **User control** — Users may have intentionally selected a specific opus variant via Pi's model settings.

## Consequences

- Subagents using `"inherit"` run with whatever model the user/session has configured
- The model used may vary between sessions
- For non-opus tiers (sonnet, haiku), literal strings are passed

## Evidence

```javascript
// gsd/bin/lib/core.cjs:resolveModelInternal()
const resolved = agentModels[profile] || agentModels['balanced'] || 'sonnet';
return resolved === 'opus' ? 'inherit' : resolved;
```

- `gsd/references/model-profiles.md` — "Why `inherit` instead of passing `opus` directly?" section
