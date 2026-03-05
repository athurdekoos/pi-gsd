# Phase 2: E2e Subagent Spawn - Research

**Researched:** 2026-03-05
**Domain:** Pi RPC subagent spawning, test workspace seeding, LLM output assertion
**Confidence:** HIGH

## Summary

Phase 2 tests the full subagent pipeline: Pi loads `gsd-research-synthesizer`, spawns it via the `subagent` tool, the agent reads 4 input files from the workspace, and writes `SUMMARY.md`. All infrastructure already exists — `pi-rpc.ts` provides `spawnPiRpc()`, `promptAndWait()`, and `createTempWorkspace()`. The closest existing pattern is `runtime-isolation.test.ts` which already does real Pi RPC sessions with file reads/writes in temp workspaces.

The main challenge is NOT infrastructure — it's designing the prompt that tells Pi to spawn the subagent, and crafting assertions that tolerate LLM nondeterminism while still catching wiring failures.

**Primary recommendation:** One test file (`e2e-subagent.test.ts`), `--e2e` gated, using the pi-rpc harness with planted sentinel strings in minimal fixture files. Split into sequential test functions covering E2E-01 through E2E-04, sharing a single Pi session to minimize token cost.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All areas delegated to Claude's discretion with these specific decisions:

**Input fixture content:**
- Minimal stubs, 5–15 lines each with unique planted sentinel strings
- Sentinels in recognizable context so LLM treats them as real content
- Minimal content keeps token cost low

**"Recognizable content" criteria (E2E-04):**
- At least 2 of 4 sentinels in SUMMARY.md (threshold, not all-or-nothing)
- Secondary: non-empty, 200+ chars, has markdown heading
- No exact-match assertions

**Nondeterminism strategy:**
- Loose assertions only, no retry logic
- ~5% flake rate acceptable
- Use `thinking: off` and fast model

### Claude's Discretion
All three gray areas were fully delegated.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| E2E-01 | Pi can invoke subagent tool targeting gsd-research-synthesizer without "Unknown agent" error | Pi resolves agents from `package.json` `pi.agents` → `agents/` dir. Agent name `gsd-research-synthesizer` must match frontmatter `name:` field. Invoked via prompt asking Pi to use the `subagent` tool. |
| E2E-02 | Spawned agent can read input files from workspace | `createTempWorkspace` sets cwd. Seed `.planning/research/` with 4 stub files. Agent's instructions say to `cat` or `Read` these files. |
| E2E-03 | Spawned agent writes SUMMARY.md to `.planning/research/SUMMARY.md` | Agent instructions specify this output path. Verify with `ws.exists()` after turn completes. |
| E2E-04 | SUMMARY.md is non-empty and contains recognizable content from input files | Planted sentinel strings in stubs. Assert ≥2 of 4 appear in output. Secondary: length ≥200 chars, has `#` heading. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tests/harness/pi-rpc.ts` | local | RPC session management | Already used by runtime-isolation.test.ts, proven pattern |
| `tests/harness/diagnostic.ts` | local | `formatFailure()` for verbose errors | Phase 1 convention, matches all other test suites |
| `tests/harness/lifecycle.ts` | local | `withTempDir`, env snapshots | Standard test isolation |
| `node:assert` | built-in | Assertions | Project convention — no third-party assertion libs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` | built-in | File existence/content checks post-test | Verify SUMMARY.md artifact |
| `node:path` | built-in | Path resolution | Resolve agent/extension paths |

### Alternatives Considered
None — all infrastructure is already built. No new dependencies needed.

## Architecture Patterns

### Single Test File Structure

One file: `tests/e2e-subagent.test.ts`

```
tests/
└── e2e-subagent.test.ts    # E2E-01 through E2E-04
```

**Why one file, not two:** The roadmap suggests 2 plans (02-01: workspace setup + spawning, 02-02: artifact verification). But these share a single Pi session — splitting into 2 files would mean 2 separate Pi processes (2× cost). Instead: one file with sequential test functions that share session state.

**Plan split:** Plan 1 writes the test file with workspace setup + agent spawning tests (E2E-01, E2E-02). Plan 2 adds artifact verification tests (E2E-03, E2E-04) and registers in run-all.ts.

### Session Reuse Pattern

```typescript
// Single session for all tests — avoids spawning multiple Pi processes
let session: PiRpcSession;
let ws: TempWorkspace;

// Setup once
ws = createTempWorkspace({ withPlanning: true });
seedResearchFixtures(ws);
session = spawnPiRpc({ cwd: ws.dir, ... });

// All E2E-01..04 tests use same session
// Teardown once at end
```

This mirrors how `runtime-isolation.test.ts` ISOL-03 uses a single session for 10+ turns.

### Prompt Design for Subagent Invocation

The prompt to Pi must trigger actual subagent spawning. Key insight: Pi's `subagent` tool is available when agents are registered. The prompt should:

```
Use the subagent tool to spawn the gsd-research-synthesizer agent.
Tell it to read the research files in .planning/research/ and write a SUMMARY.md.
```

Pi will resolve `gsd-research-synthesizer` from its registered agents (loaded from `agents/gsd-research-synthesizer.md` via `package.json` `pi.agents`).

**Critical:** The prompt must reference the agent by its exact `name:` from frontmatter: `gsd-research-synthesizer`.

### Fixture Design

Four minimal stub files in `.planning/research/`:

```typescript
const SENTINELS = {
  STACK: "XSENTINEL_STACK_" + Date.now(),
  FEATURES: "XSENTINEL_FEATURES_" + Date.now(),
  ARCHITECTURE: "XSENTINEL_ARCH_" + Date.now(),
  PITFALLS: "XSENTINEL_PITFALLS_" + Date.now(),
};

// Example stub:
ws.writeFile(".planning/research/STACK.md", `# Stack Research
## Recommended: ${SENTINELS.STACK}
- TypeScript 5.x for type safety
- Node.js 20 LTS runtime
`);
```

Sentinels use `XSENTINEL_` prefix (unlikely to be hallucinated) + timestamp for uniqueness.

### Assertion Strategy

```typescript
// E2E-01: No "Unknown agent" error in events
const errors = session.extensionErrors();
assert.strictEqual(errors.length, 0, ...);

// E2E-02: Tool execution events show file reads
const toolEnds = session.toolEnds();
// At least some tool calls succeeded

// E2E-03: File exists
assert.ok(ws.exists(".planning/research/SUMMARY.md"), ...);

// E2E-04: Content verification
const summary = ws.readFile(".planning/research/SUMMARY.md");
assert.ok(summary.length >= 200, ...);
const found = Object.values(SENTINELS).filter(s => summary.includes(s));
assert.ok(found.length >= 2, `Expected ≥2 sentinels in SUMMARY.md, found ${found.length}`);
```

### Anti-Patterns to Avoid
- **Multiple Pi sessions per test file** — expensive, doubles token cost
- **Exact string matching on LLM output** — will flake
- **Short timeouts** — subagent spawning involves multiple model calls; needs generous timeout
- **Testing agent quality** — out of scope; only test wiring works

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temp workspace | Custom mkdir/cleanup | `createTempWorkspace()` | Handles cleanup, `.planning/` scaffold, proven in runtime tests |
| RPC session | Raw child_process + JSONL parsing | `spawnPiRpc()` + `promptAndWait()` | Event collection, timeout handling, structured access |
| Error formatting | Console.log strings | `formatFailure()` | Matches Phase 1 diagnostic convention |
| Event filtering | Manual array iteration | `session.toolEnds()`, `session.extensionErrors()` | Built into pi-rpc harness |

## Common Pitfalls

### Pitfall 1: Subagent Timeout
**What goes wrong:** Subagent spawning involves Pi loading the agent, making an API call with the agent's system prompt, then the agent makes its own tool calls. This chain can take 60-120+ seconds.
**Why it happens:** Default `waitForTurn` timeout is 120s, which may be tight for a subagent round-trip.
**How to avoid:** Use 180-240s timeout for the subagent turn. Process timeout should be higher (300s).
**Warning signs:** Timeout error in `waitForTurn()` — check `processTimeoutMs` and turn timeout.

### Pitfall 2: Agent Writes to Wrong Directory
**What goes wrong:** The synthesizer agent may write SUMMARY.md relative to its own cwd or an unexpected path.
**Why it happens:** Agent instructions use `.planning/research/SUMMARY.md` but cwd must be the workspace root.
**How to avoid:** `spawnPiRpc({ cwd: ws.dir })` ensures the Pi process starts in the workspace. The subagent inherits this cwd.
**Warning signs:** `ws.exists()` returns false but the file exists elsewhere.

### Pitfall 3: Session Prompt Doesn't Trigger Subagent Tool
**What goes wrong:** Pi responds with text instead of using the subagent tool.
**Why it happens:** The prompt isn't specific enough, or Pi doesn't recognize the agent name.
**How to avoid:** Be explicit: "Use the subagent tool to spawn the agent named gsd-research-synthesizer." Check that `pi.agents` in package.json points to `agents/` directory.
**Warning signs:** No `tool_execution_start` events with `subagent` in tool name.

### Pitfall 4: Sentinel Strings Get Transformed
**What goes wrong:** LLM reformats, truncates, or partially quotes sentinel strings.
**Why it happens:** The synthesizer summarizes/paraphrases input content.
**How to avoid:** Use sentinels that look like real content (not random gibberish). Place them as "recommended tools" or "project names" — things the LLM is more likely to preserve verbatim. Threshold of 2/4 accounts for some loss.
**Warning signs:** 0 sentinels found despite SUMMARY.md being non-empty.

### Pitfall 5: Git Operations in Temp Workspace
**What goes wrong:** The synthesizer agent tries to commit (Step 7 in its instructions) but there's no git repo.
**Why it happens:** `createTempWorkspace()` doesn't init a git repo.
**How to avoid:** Either init a git repo in the workspace, or accept that the commit step will fail silently (the agent should still write the file first). The test only cares about the file, not the commit.
**Warning signs:** Agent errors about "not a git repository."

## Code Examples

### Workspace Setup with Fixtures

```typescript
import {
  checkPrerequisites,
  createTempWorkspace,
  spawnPiRpc,
  promptAndWait,
  TempWorkspace,
  PiRpcSession,
} from "./harness/pi-rpc.js";

const SENTINELS = {
  STACK: "XSENTINEL_STACK_" + Date.now(),
  FEATURES: "XSENTINEL_FEATURES_" + Date.now(),
  ARCHITECTURE: "XSENTINEL_ARCH_" + Date.now(),
  PITFALLS: "XSENTINEL_PITFALLS_" + Date.now(),
};

function seedFixtures(ws: TempWorkspace): void {
  ws.writeFile(".planning/research/STACK.md",
    `# Stack Research\n## Recommended: ${SENTINELS.STACK}\n- TypeScript 5.x\n- Node.js 20 LTS\n`);
  ws.writeFile(".planning/research/FEATURES.md",
    `# Features Research\n## Core Feature: ${SENTINELS.FEATURES}\n- User authentication\n- Data export\n`);
  ws.writeFile(".planning/research/ARCHITECTURE.md",
    `# Architecture Research\n## Pattern: ${SENTINELS.ARCHITECTURE}\n- MVC structure\n- Event-driven\n`);
  ws.writeFile(".planning/research/PITFALLS.md",
    `# Pitfalls Research\n## Warning: ${SENTINELS.PITFALLS}\n- Memory leaks in long sessions\n- Race conditions\n`);
}
```

### Session Spawn with Extension

```typescript
const session = spawnPiRpc({
  cwd: ws.dir,
  processTimeoutMs: 300_000,  // 5 min total
  model: "anthropic/claude-sonnet-4-20250514",
  thinking: "off",
});
```

### Subagent Prompt

```typescript
const events = await promptAndWait(
  session,
  `Use the subagent tool to spawn the agent named "gsd-research-synthesizer". ` +
  `Tell it to read the 4 research files in .planning/research/ ` +
  `(STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md) ` +
  `and synthesize them into .planning/research/SUMMARY.md. ` +
  `The agent should write the file but can skip the git commit step.`,
  240_000,  // 4 min for subagent round-trip
);
```

### run-all.ts Registration

```typescript
// In SUITES array, under E2E category:
{ file: "e2e-subagent.test.ts", category: "E2E" },
```

This gets `--e2e` gating automatically from the existing run-all.ts logic (lines 161-176).

## Open Questions

1. **Git repo in workspace**
   - What we know: `createTempWorkspace()` doesn't init git. The synthesizer agent tries to commit.
   - What's unclear: Whether agent failure on commit prevents SUMMARY.md write.
   - Recommendation: Init a bare git repo in workspace (`git init`) as part of setup. Low cost, prevents potential agent confusion. If commit fails, the file should already be written (agent's Step 6 writes, Step 7 commits).

2. **config.json in workspace**
   - What we know: `runtime-isolation.test.ts` seeds `.planning/config.json` in its workspaces.
   - What's unclear: Whether the synthesizer agent needs config.json to function (it calls `gsd-tools.cjs commit`).
   - Recommendation: Seed a minimal config.json with `commit_docs: false` to prevent commit attempts. Simpler than git init.

## Sources

### Primary (HIGH confidence)
- `tests/harness/pi-rpc.ts` — full source read, all APIs documented inline
- `tests/runtime-isolation.test.ts` — closest existing pattern, source read in full
- `agents/gsd-research-synthesizer.md` — agent instructions, full source read
- `tests/run-all.ts` — suite registration pattern, full source read
- `package.json` — `pi.agents` pointing to `agents/` directory

### Secondary (MEDIUM confidence)
- `tests/e2e-smoke.test.ts` — simpler e2e pattern (execSync, not RPC)
- `.planning/codebase/TESTING.md` — test convention documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all infrastructure exists and is proven
- Architecture: HIGH — closest pattern (runtime-isolation) is well understood
- Pitfalls: HIGH — derived from direct code analysis of the harness and agent

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable infrastructure, unlikely to change)
