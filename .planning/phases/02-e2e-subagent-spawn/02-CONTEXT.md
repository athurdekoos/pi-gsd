# Phase 2: E2e Subagent Spawn - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the full subagent pipeline works end-to-end: Pi loads `gsd-research-synthesizer`, spawns it via the subagent tool, agent reads 4 input research files from the workspace, and writes a `SUMMARY.md` artifact. This is a single canary test — not all 11 agents.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All three gray areas were delegated to Claude's judgment. Decisions below are grounded in project constraints ("RPC tests burn API tokens — keep to minimum") and established codebase patterns.

**Input fixture content:**
- Minimal stubs, 5–15 lines each — just enough structure for the synthesizer to work with
- Each of the 4 research files (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md) gets a unique planted sentinel string (e.g., `SENTINEL_STACK_7x9k2`) that's unlikely to be hallucinated
- Sentinels should appear in recognizable context (e.g., a "Recommended stack: SENTINEL_STACK_7x9k2") so the LLM treats them as real content to synthesize, not noise to discard
- Minimal content keeps token cost low and test execution fast — this tests wiring, not synthesis quality

**"Recognizable content" criteria (E2E-04):**
- Primary assertion: at least 2 of 4 sentinel strings appear in SUMMARY.md (threshold, not all-or-nothing — synthesis is inherently lossy)
- Secondary assertions: SUMMARY.md is non-empty, exceeds a minimum length (e.g., 200 chars), and contains at least one markdown heading (`#`)
- Do NOT assert on specific section names or exact phrasing — LLM output varies
- The combination of sentinel presence + structural checks gives high confidence the agent actually read inputs and produced meaningful output

**Nondeterminism strategy:**
- Loose assertions only — no retry logic (retries double token cost for marginal reliability gain)
- All assertions designed to tolerate LLM variation: presence checks (not exact match), minimum thresholds (not exact counts), structural indicators (not specific content)
- If a sentinel threshold of 2/4 proves too strict in practice, it can be lowered to 1/4 — but start at 2/4
- Accept that this test may occasionally flake (~5% is acceptable for an e2e LLM test) — the value is catching wiring breakage, not guaranteeing deterministic output
- Use `thinking: off` and a fast model to reduce cost and variation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/harness/pi-rpc.ts`: Full RPC session management — `spawnPiRpc()`, `promptAndWait()`, `createTempWorkspace()`, `extractAssistantText()`. This is the primary harness for e2e tests.
- `createTempWorkspace({ withPlanning: true })`: Creates isolated temp dir with `.planning/` — exactly what's needed for seeding research files
- `tests/harness/diagnostic.ts`: `formatFailure()` for verbose error output matching Phase 1 convention
- `tests/harness/lifecycle.ts`: `withTempDir`, `saveEnv`, `restoreEnv` for test isolation

### Established Patterns
- E2E tests gated behind `--e2e` flag (see `e2e-smoke.test.ts` and `run-all.ts` lines 161–176)
- RPC tests use `spawnPiRpc({ cwd: workspace.dir, ... })` with the GSD extension auto-loaded
- `promptAndWait()` sends a message and waits for `agent_end` event — default 120s timeout
- Self-contained suites with `passed`/`failed` counters and `testAsync` wrappers
- Prerequisite checks via `checkPrerequisites()` from pi-rpc.ts (Pi binary, auth, extension source)

### Integration Points
- `tests/run-all.ts` SUITES array: new test file registered under `"E2E"` category with `--e2e` gating
- `agents/gsd-research-synthesizer.md`: the agent definition that Pi loads when subagent is invoked
- Workspace needs `.planning/research/` directory seeded with 4 input files
- Agent writes output to `.planning/research/SUMMARY.md` within the workspace

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established test conventions.

Key reference points:
- `runtime-isolation.test.ts` demonstrates real Pi RPC sessions writing/reading files in temp workspaces — closest existing pattern to what Phase 2 needs
- `e2e-smoke.test.ts` shows the simpler `execSync` approach, but Phase 2 needs the richer RPC harness for subagent invocation
- The prompt to Pi should instruct it to spawn the synthesizer agent — the test verifies Pi can resolve the agent name and the agent can do its job

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-e2e-subagent-spawn*
*Context gathered: 2026-03-05*
