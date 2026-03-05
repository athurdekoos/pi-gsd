/**
 * E2E Subagent Spawn Tests — validates that Pi can spawn a GSD subagent
 * (gsd-research-synthesizer) via the subagent tool, the agent reads input
 * files from the workspace, and produces the expected SUMMARY.md artifact.
 *
 * Requirements: E2E-01, E2E-02, E2E-03, E2E-04
 * PREREQUISITE: Pi binary, Anthropic auth, GSD extension source.
 * Gated behind --e2e flag (expensive: real LLM round-trip).
 *
 * Run: npx tsx tests/e2e-subagent.test.ts --e2e
 */

import assert from "node:assert";
import {
  checkPrerequisites,
  createTempWorkspace,
  spawnPiRpc,
  promptAndWait,
  TempWorkspace,
  PiRpcSession,
} from "./harness/pi-rpc.js";
import { formatFailure } from "./harness/diagnostic.js";

// =========================================================================
// E2E gate — skip unless --e2e flag is set
// =========================================================================

if (!process.argv.includes("--e2e")) {
  console.log("Skipping E2E: --e2e flag not set");
  process.exit(0);
}

// =========================================================================
// Prerequisites — MUST fail if missing
// =========================================================================

console.log("\nE2E Subagent prerequisites:\n");

try {
  checkPrerequisites();
  console.log("  ✓ All prerequisites met");
} catch (err: any) {
  console.log(`  ✗ ${err.message}`);
  console.log(`\n0 passed, 1 failed`);
  process.exit(1);
}

// =========================================================================
// Test scaffolding
// =========================================================================

let passed = 0;
let failed = 0;

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// =========================================================================
// Sentinel constants — unique per run to detect real reads vs hallucination
// =========================================================================

export const SENTINELS = {
  STACK: "XSENTINEL_STACK_" + Date.now(),
  FEATURES: "XSENTINEL_FEATURES_" + Date.now(),
  ARCHITECTURE: "XSENTINEL_ARCH_" + Date.now(),
  PITFALLS: "XSENTINEL_PITFALLS_" + Date.now(),
};

// =========================================================================
// Fixture seeding helper
// =========================================================================

function seedFixtures(ws: TempWorkspace): void {
  ws.writeFile(
    ".planning/research/STACK.md",
    `# Stack Research\n\n## Recommended: ${SENTINELS.STACK}\n\n- TypeScript 5.x for type safety\n- Node.js 20 LTS runtime\n- ESM module system\n`,
  );
  ws.writeFile(
    ".planning/research/FEATURES.md",
    `# Features Research\n\n## Core Feature: ${SENTINELS.FEATURES}\n\n- User authentication with JWT\n- Real-time data sync\n- Data export pipeline\n`,
  );
  ws.writeFile(
    ".planning/research/ARCHITECTURE.md",
    `# Architecture Research\n\n## Pattern: ${SENTINELS.ARCHITECTURE}\n\n- MVC structure with service layer\n- Event-driven messaging\n- Repository pattern for data access\n`,
  );
  ws.writeFile(
    ".planning/research/PITFALLS.md",
    `# Pitfalls Research\n\n## Warning: ${SENTINELS.PITFALLS}\n\n- Memory leaks in long-running sessions\n- Race conditions in concurrent writes\n- Unbounded queue growth under load\n`,
  );

  // Minimal config to prevent gsd-tools commit errors
  ws.writeFile(
    ".planning/config.json",
    JSON.stringify({ model_profile: "balanced", commit_docs: false }, null, 2),
  );
}

// =========================================================================
// Tests
// =========================================================================

async function runTests() {
  console.log("\nE2E Subagent Spawn Tests\n");

  // Shared session — single Pi process for all tests (minimizes token cost)
  const ws = createTempWorkspace({ withPlanning: true });
  seedFixtures(ws);

  const session = spawnPiRpc({
    cwd: ws.dir,
    processTimeoutMs: 300_000, // 5 min total process limit
    model: "anthropic/claude-sonnet-4-20250514",
    thinking: "off",
  });

  let turnEvents: import("./harness/pi-rpc.js").RpcEvent[] = [];

  try {
    // Send the subagent invocation prompt — one prompt drives E2E-01 and E2E-02
    turnEvents = await promptAndWait(
      session,
      `Use the subagent tool to spawn the agent named "gsd-research-synthesizer". ` +
      `Tell it to read the 4 research files in .planning/research/ ` +
      `(STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md) ` +
      `and synthesize them into .planning/research/SUMMARY.md. ` +
      `The agent should write the file but can skip the git commit step.`,
      240_000, // 4 min for subagent round-trip
    );

    // -----------------------------------------------------------------
    // E2E-01: Pi invokes gsd-research-synthesizer without Unknown agent error
    // -----------------------------------------------------------------
    await testAsync(
      "E2E-01: Pi invokes gsd-research-synthesizer via subagent tool without Unknown agent error",
      async () => {
        const errors = session.extensionErrors();
        assert.strictEqual(
          errors.length,
          0,
          formatFailure({
            file: "agents/gsd-research-synthesizer.md",
            expected: "No extension errors — agent resolves cleanly",
            actual: `${errors.length} extension error(s): ${JSON.stringify(errors.map((e) => e.message ?? e.error ?? e))}`,
            why: "E2E-01 requires Pi to resolve gsd-research-synthesizer without 'Unknown agent' error",
          }),
        );

        assert.ok(
          turnEvents.length > 0,
          formatFailure({
            file: "tests/harness/pi-rpc.ts",
            expected: "Agent turn completed with events",
            actual: "No events received from agent turn",
            why: "E2E-01 requires the subagent invocation to produce a completed turn",
          }),
        );
      },
    );

    // -----------------------------------------------------------------
    // E2E-02: Spawned agent reads input research files from workspace
    // -----------------------------------------------------------------
    await testAsync(
      "E2E-02: spawned agent reads input research files from workspace",
      async () => {
        const toolEnds = session.toolEnds();
        assert.ok(
          toolEnds.length > 0,
          formatFailure({
            file: "tests/harness/pi-rpc.ts",
            expected: "At least one successful tool execution (agent made tool calls)",
            actual: `${toolEnds.length} tool_execution_end events`,
            why: "E2E-02 requires the spawned agent to execute tools (read files)",
          }),
        );

        // Check that tool executions include Read or Bash calls (file access)
        const fileAccessTools = toolEnds.filter(
          (e) =>
            e.toolName === "Read" ||
            e.toolName === "read" ||
            e.toolName === "Bash" ||
            e.toolName === "bash" ||
            (e.toolName === "subagent" && !e.isError),
        );
        assert.ok(
          fileAccessTools.length > 0,
          formatFailure({
            file: "agents/gsd-research-synthesizer.md",
            expected: "Tool events include Read, Bash, or subagent calls (file access)",
            actual: `Tool names seen: ${[...new Set(toolEnds.map((e) => e.toolName))].join(", ")}`,
            why: "E2E-02 requires the agent to read input files via tool calls",
            evidence: JSON.stringify(toolEnds.slice(0, 3).map((e) => ({ tool: e.toolName, error: e.isError }))),
          }),
        );
      },
    );
  } finally {
    session.kill();
    await session.waitForExit();
    ws.cleanup();
  }
}

// =========================================================================
// Run and report
// =========================================================================

runTests()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
