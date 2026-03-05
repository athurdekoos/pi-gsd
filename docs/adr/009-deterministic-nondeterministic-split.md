# ADR-009: Deterministic/Non-Deterministic Split

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

Some operations are deterministic (file I/O, git, config parsing) and some are non-deterministic (planning, code generation, verification).

## Decision

Deterministic operations go in `gsd-tools.cjs` (Node.js CLI). Non-deterministic operations go in markdown workflows/agents (LLM execution).

## Rationale (inferred)

1. **Reliability** — File I/O, git commits, config parsing should not depend on LLM reasoning
2. **Testability** — CLI commands can be unit-tested; LLM behavior cannot
3. **Token efficiency** — CLI commands don't consume LLM tokens for mechanical operations
4. **Reproducibility** — `gsd-tools commit` always does the same thing; LLM planning varies

## Consequences

- Clear boundary: CLI handles data, LLM handles reasoning
- Workflows call CLI for side effects, LLM for decisions
- 80+ CLI commands vs 30+ workflow files vs 11 agents
- CLI outputs JSON for LLM to parse — structured handoff

## Evidence

- `gsd-tools.cjs` — 80+ deterministic commands
- Workflows consistently use `node gsd-tools.cjs` for file operations
- Agents use Read/Write/Bash tools for LLM-directed work
- Init commands assemble context (deterministic) that workflows act on (non-deterministic)
