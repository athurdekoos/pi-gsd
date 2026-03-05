# pi-gsd Runtime Test Suite

## What This Is

An automated runtime test suite for pi-gsd that validates the extension works correctly with a real Pi coding agent runtime. Tests verify that extension hooks fire correctly, commands register properly, and the orchestrator/subagent architecture maintains context isolation and file-based state durability over long runs. Built for developers maintaining pi-gsd who need regression detection when changing extension hooks, command registration, or workflow orchestration.

## Core Value

Catch breakage in the Pi ↔ GSD extension contract before it reaches users.

## Requirements

### Validated

- ✓ RPC harness utility (`tests/harness/pi-rpc.ts`) with `checkPrerequisites`, `createTempWorkspace`, `spawnPiRpc`, `promptAndWait` — existing
- ✓ Subscription wiring tests (WIRE-01–08): package manifest validation, event subscription discovery, command registration — existing
- ✓ Runtime hook tests (HOOK-01–04): `session_start` setStatus, `tool_call` GSD_HOME rewriting, `before_agent_start` prompt injection — existing
- ✓ Context isolation tests (ISOL-01–04): subagent output isolation, agent definitions, 10-turn state durability, gsd-tools determinism — existing
- ✓ `run-all.ts` updated with 3 Runtime category suites — existing
- ✓ Zero external test dependencies (tsx + node:assert only) — existing
- ✓ No modifications to extension source for test observability — existing
- ✓ All tests use temp directories, no real repo mutation — existing
- ✓ Runtime tests FAIL (not skip) when prerequisites missing — existing
- ✓ Deterministic signals only: file existence, JSON events, tool execution — existing

### Active

(None — v1 scope shipped and validated)

### Out of Scope

- Mocking the Pi runtime — design decision: real Pi RPC is the observation mechanism
- Testing LLM text content — non-deterministic, unreliable for CI
- Modifications to pi-gsd extension source for testability — Pi RPC events are sufficient
- External test dependencies (jest, mocha, vitest) — existing stack is tsx + node:assert
- Separate `--e2e` gating for runtime tests — runtime tests are mandatory in the default suite

## Context

- pi-gsd is a Pi coding agent extension implementing the GSD (Get Shit Done) spec-driven development system
- Extension hooks: `before_agent_start` (prompt injection), `tool_call` (path rewriting), `session_start` (status display)
- Test suite extends the existing 15-suite test infrastructure (custom runner, `testSync`/`testAsync` pattern)
- Pi `--mode rpc` provides JSONL event stream on stdout — the sole observation mechanism for runtime tests
- Model: `anthropic/claude-sonnet-4-20250514` with thinking off for runtime test speed
- 300 total tests across 18 suites, ~90 seconds full run

## Constraints

- **Stack**: tsx + node:assert only — matches existing test conventions, zero new dependencies
- **Observability**: No extension source modifications — Pi RPC events are the contract boundary
- **Isolation**: All runtime tests use temp directories via `createTempWorkspace()`
- **Determinism**: Never assert on LLM-generated text content — only structural signals (files, JSON, tool calls)
- **Prerequisites**: Runtime tests fail hard (not skip) if Pi binary, Anthropic auth, or extension source missing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Real Pi runtime (not mocked) for runtime tests | Tests must validate the actual extension contract, not a simulation | ✓ Good — catches real integration bugs |
| Pi `--mode rpc` as observation mechanism | JSONL events on stdout provide structured, deterministic signals | ✓ Good — clean separation of concerns |
| Runtime tests mandatory (no `--e2e` gating) | These tests guard the core extension contract — skipping defeats the purpose | ✓ Good — 300/300 passing in default suite |
| `anthropic/claude-sonnet-4-20250514` with thinking off | Speed over depth — runtime tests need fast turnaround | ✓ Good — full suite ~90s |
| Fail (not skip) on missing prerequisites | Silent skips hide broken CI environments | ✓ Good — fails loud and clear |
| Custom runner (no jest/mocha) | Matches existing 15-suite infrastructure exactly | ✓ Good — zero learning curve for contributors |

---
*Last updated: 2026-03-05 after initialization*
