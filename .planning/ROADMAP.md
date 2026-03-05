# Roadmap: pi-gsd Runtime Test Suite

## Overview

Four-phase build from test infrastructure through wiring validation, hook verification, and isolation/durability testing. Each phase layers on the previous — infrastructure first, then deterministic wiring checks, then real Pi runtime hook tests, then the hardest problems: context isolation and long-run durability. All phases shipped and validated with 300/300 tests passing.

## Phases

- [x] **Phase 1: Test Infrastructure** — RPC harness and runner integration
- [x] **Phase 2: Subscription Wiring** — Extension discovery, event subscriptions, command registration
- [x] **Phase 3: Runtime Hooks** — Hook firing with real Pi sessions via RPC
- [x] **Phase 4: Context Isolation & Durability** — Subagent isolation, state durability, determinism

## Phase Details

### Phase 1: Test Infrastructure
**Goal**: Build the RPC harness utility and integrate runtime suites into the test runner
**Depends on**: Nothing (foundation)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, XCUT-01, XCUT-02, XCUT-03
**Success Criteria** (what must be TRUE):
  1. `checkPrerequisites()` throws with actionable message when Pi binary missing
  2. `checkPrerequisites()` throws when ANTHROPIC_API_KEY not set
  3. `createTempWorkspace()` returns isolated temp dir with `.planning/` scaffolded
  4. `spawnPiRpc()` launches Pi child process with GSD extension and returns session handle
  5. `promptAndWait()` sends prompt and collects events until agent turn completes
  6. `run-all.ts` discovers and runs 3 Runtime suites in default mode
**Plans**: 2 plans

Plans:
- [x] 01-01: Build Pi RPC harness utility (pi-rpc.ts)
- [x] 01-02: Integrate runtime suites into run-all.ts

### Phase 2: Subscription Wiring
**Goal**: Validate extension wires up correctly — package manifest, events, commands
**Depends on**: Phase 1
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05, WIRE-06, WIRE-07, WIRE-08
**Success Criteria** (what must be TRUE):
  1. Package manifest declares correct name, extension entry, and agents directory
  2. Extension subscribes to all 3 lifecycle events (before_agent_start, tool_call, session_start)
  3. Extension registers bare /gsd and all /gsd:* commands matching files in commands directory
  4. All 8 WIRE tests pass deterministically
**Plans**: 1 plan

Plans:
- [x] 02-01: Implement subscription wiring tests (WIRE-01 through WIRE-08)

### Phase 3: Runtime Hooks
**Goal**: Verify hooks produce real side effects during actual Pi sessions
**Depends on**: Phase 1 (RPC harness), Phase 2 (wiring confirmed)
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-04, XCUT-04, XCUT-05
**Success Criteria** (what must be TRUE):
  1. session_start fires setStatus when STATE.md present, skips when absent
  2. tool_call hook enables gsd-tools.cjs resolution via $GSD_HOME
  3. before_agent_start injects GSD context that agent can act on
  4. Tests fail (not skip) when prerequisites missing
  5. All assertions use deterministic signals only
**Plans**: 1 plan

Plans:
- [x] 03-01: Implement runtime hook tests (HOOK-01 through HOOK-04)

### Phase 4: Context Isolation & Durability
**Goal**: Prove orchestrator/subagent isolation and file-based state survives long runs
**Depends on**: Phase 1 (RPC harness), Phase 3 (hooks working)
**Requirements**: ISOL-01, ISOL-02, ISOL-03, ISOL-04
**Success Criteria** (what must be TRUE):
  1. Subagent output is isolated from orchestrator session
  2. All expected agent definition files exist
  3. .planning/ state files survive 10+ turns without corruption
  4. gsd-tools CLI operations produce identical results across repeated runs
**Plans**: 1 plan

Plans:
- [x] 04-01: Implement isolation and durability tests (ISOL-01 through ISOL-04)

## Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| INFRA-01–06 | 1 |
| WIRE-01–08 | 2 |
| HOOK-01–04 | 3 |
| ISOL-01–04 | 4 |
| XCUT-01–03 | 1 |
| XCUT-04–05 | 3 |

**Coverage**: 27/27 requirements mapped (100%)
