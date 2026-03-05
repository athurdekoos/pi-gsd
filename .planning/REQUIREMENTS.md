# Requirements — pi-gsd Runtime Test Suite

## v1 Requirements

### Test Infrastructure

- [x] **INFRA-01**: RPC harness utility provides `checkPrerequisites()` that fails hard when Pi binary, Anthropic auth, or extension source missing
- [x] **INFRA-02**: RPC harness provides `createTempWorkspace()` that scaffolds isolated `.planning/` directory in temp dir
- [x] **INFRA-03**: RPC harness provides `spawnPiRpc()` that launches Pi in `--mode rpc` with GSD extension loaded via `-e`
- [x] **INFRA-04**: RPC harness provides `promptAndWait()` that sends a prompt and collects JSONL events until agent turn completes
- [x] **INFRA-05**: RPC session exposes structured event accessors: `toolStarts()`, `toolEnds()`, `extensionUiRequests()`, `extensionErrors()`
- [x] **INFRA-06**: `run-all.ts` includes 3 Runtime category suites in the default (non-`--e2e`) run

### Subscription Wiring

- [x] **WIRE-01**: Validate `package.json` has name `pi-gsd`
- [x] **WIRE-02**: Validate `package.json` `pi.extensions` includes extension entry point
- [x] **WIRE-03**: Validate `package.json` `pi.agents` includes agents directory
- [x] **WIRE-04**: Extension subscribes to `before_agent_start` event
- [x] **WIRE-05**: Extension subscribes to `tool_call` event
- [x] **WIRE-06**: Extension subscribes to `session_start` event
- [x] **WIRE-07**: Extension registers bare `/gsd` command
- [x] **WIRE-08**: Extension registers `/gsd:*` commands matching commands directory

### Runtime Hooks

- [x] **HOOK-01**: `session_start` fires `setStatus('gsd', 'GSD ●')` when `.planning/STATE.md` exists
- [x] **HOOK-02**: `session_start` does NOT fire `setStatus` when `.planning/STATE.md` absent
- [x] **HOOK-03**: `tool_call` hook causes `gsd-tools.cjs` to resolve correctly via `$GSD_HOME`
- [x] **HOOK-04**: `before_agent_start` injects GSD context — agent knows gsd-tools path

### Context Isolation & Durability

- [x] **ISOL-01**: Subagent writes to a distinct output path — orchestrator session doesn't write the same file
- [x] **ISOL-02**: All expected subagent roles have agent definition files
- [x] **ISOL-03**: `.planning/` state files survive 10+ turns of tool calls without corruption
- [x] **ISOL-04**: `gsd-tools` CLI operations are deterministic — same input always produces same output

### Cross-Cutting

- [x] **XCUT-01**: Zero external test dependencies — only `tsx` + `node:assert`
- [x] **XCUT-02**: No modifications to extension source code for test observability
- [x] **XCUT-03**: All tests use temp directories — no real repo state mutation
- [x] **XCUT-04**: Runtime tests FAIL (not skip) when prerequisites missing
- [x] **XCUT-05**: Assertions use deterministic signals only — file existence, JSON events, tool execution — never LLM text content

## v2 Requirements (Deferred)

(None identified — v1 scope is complete)

## Out of Scope

- **Mock Pi runtime** — design decision: real Pi RPC is the observation mechanism; mocks can't validate the actual extension contract
- **LLM text content assertions** — non-deterministic; flaky by nature
- **Extension source modifications for testability** — Pi RPC events provide sufficient observability
- **External test frameworks (jest, mocha, vitest)** — existing custom runner matches project conventions
- **Separate `--e2e` gating** — runtime tests are part of the core contract, not optional

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01–06 | 1 | ✓ Validated |
| WIRE-01–08 | 2 | ✓ Validated |
| HOOK-01–04 | 3 | ✓ Validated |
| ISOL-01–04 | 4 | ✓ Validated |
| XCUT-01–05 | 1–4 | ✓ Validated |
