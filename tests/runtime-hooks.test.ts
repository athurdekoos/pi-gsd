/**
 * Runtime Hooks Tests — validates that pi-gsd event hooks fire and produce
 * their intended side effects during a real Pi coding agent session.
 *
 * Uses Pi's RPC mode to spawn a real agent, send prompts, and observe
 * tool execution events and extension UI requests.
 *
 * Tests: HOOK-01 through HOOK-04
 * PREREQUISITE: Pi binary, Anthropic auth, GSD extension source.
 * These tests FAIL (not skip) if prerequisites are missing.
 *
 * Run: npx tsx tests/runtime-hooks.test.ts
 */

import assert from "node:assert";
import {
  checkPrerequisites,
  createTempWorkspace,
  spawnPiRpc,
  promptAndWait,
  TempWorkspace,
  PiRpcSession,
  RpcEvent,
} from "./harness/pi-rpc.js";

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
// Prerequisites — MUST fail if missing
// =========================================================================

console.log("\nRuntime prerequisites:\n");

try {
  checkPrerequisites();
  console.log("  ✓ All prerequisites met");
} catch (err: any) {
  console.log(`  ✗ ${err.message}`);
  console.log(`\n0 passed, 1 failed`);
  process.exit(1);
}

// =========================================================================
// Tests
// =========================================================================

async function runTests() {
  // -----------------------------------------------------------------------
  console.log("\nsession_start hook:\n");
  // -----------------------------------------------------------------------

  // HOOK-01: session_start fires setStatus when STATE.md exists
  await testAsync("HOOK-01: session_start fires setStatus('gsd', 'GSD ●') when .planning/STATE.md exists", async () => {
    const ws = createTempWorkspace({ withState: true });
    try {
      const session = spawnPiRpc({
        cwd: ws.dir,
        processTimeoutMs: 120_000,
        model: "anthropic/claude-sonnet-4-20250514",
      });

      try {
        const events = await promptAndWait(session, "Say only: pong", 60_000);

        // Check for setStatus extension UI request
        const statusEvents = session.extensionUiRequests().filter(
          (e) => e.method === "setStatus" && e.statusKey === "gsd"
        );
        assert.ok(statusEvents.length > 0,
          "Expected setStatus('gsd', ...) extension UI request but none found. " +
          `Total extension_ui_requests: ${session.extensionUiRequests().length}`);
        assert.strictEqual(statusEvents[0].statusText, "GSD ●",
          `Expected status text 'GSD ●', got '${statusEvents[0].statusText}'`);
      } finally {
        session.kill();
        await session.waitForExit();
      }
    } finally {
      ws.cleanup();
    }
  });

  // HOOK-02: session_start does NOT fire setStatus when no STATE.md
  await testAsync("HOOK-02: session_start does NOT fire setStatus when .planning/STATE.md absent", async () => {
    const ws = createTempWorkspace({ withPlanning: false });
    try {
      const session = spawnPiRpc({
        cwd: ws.dir,
        processTimeoutMs: 120_000,
        model: "anthropic/claude-sonnet-4-20250514",
      });

      try {
        await promptAndWait(session, "Say only: pong", 60_000);

        const statusEvents = session.extensionUiRequests().filter(
          (e) => e.method === "setStatus" && e.statusKey === "gsd"
        );
        assert.strictEqual(statusEvents.length, 0,
          `Expected NO setStatus('gsd', ...) but found ${statusEvents.length}: ` +
          JSON.stringify(statusEvents));
      } finally {
        session.kill();
        await session.waitForExit();
      }
    } finally {
      ws.cleanup();
    }
  });

  // -----------------------------------------------------------------------
  console.log("\ntool_call hook (GSD_HOME rewriting):\n");
  // -----------------------------------------------------------------------

  // HOOK-03: tool_call hook prepends GSD_HOME when bash references gsd-tools
  await testAsync("HOOK-03: tool_call hook causes gsd-tools.cjs to resolve correctly via $GSD_HOME", async () => {
    const ws = createTempWorkspace({ withPlanning: true });
    try {
      const session = spawnPiRpc({
        cwd: ws.dir,
        processTimeoutMs: 120_000,
        model: "anthropic/claude-sonnet-4-20250514",
      });

      try {
        // Ask the agent to run gsd-tools using $GSD_HOME
        // The tool_call hook should ensure GSD_HOME is set
        const events = await promptAndWait(
          session,
          'Use the bash tool to run exactly this command: node "$GSD_HOME/bin/gsd-tools.cjs" current-timestamp',
          90_000,
        );

        // Verify a bash tool was executed
        const toolStarts = session.toolStarts().filter(
          (e) => e.toolName === "bash"
        );
        assert.ok(toolStarts.length > 0,
          "Expected at least one bash tool execution");

        // Verify the tool execution succeeded (not an error)
        const toolEnds = session.toolEnds().filter(
          (e) => e.toolName === "bash"
        );
        assert.ok(toolEnds.length > 0, "Expected bash tool to complete");

        // At least one bash tool call should have succeeded (gsd-tools ran without error)
        const successfulEnds = toolEnds.filter(e => !e.isError);
        assert.ok(successfulEnds.length > 0,
          "Expected at least one successful bash tool execution. " +
          `All ends: ${JSON.stringify(toolEnds.map(e => ({ isError: e.isError, result: e.result })))}`);

        // Verify the result contains a timestamp (gsd-tools current-timestamp returns ISO date)
        const anyTimestamp = successfulEnds.some(e => {
          const text = JSON.stringify(e.result);
          return /\d{4}-\d{2}-\d{2}/.test(text);
        });
        assert.ok(anyTimestamp,
          "Expected gsd-tools current-timestamp to return a date. " +
          `Results: ${JSON.stringify(successfulEnds.map(e => e.result))}`);
      } finally {
        session.kill();
        await session.waitForExit();
      }
    } finally {
      ws.cleanup();
    }
  });

  // -----------------------------------------------------------------------
  console.log("\nbefore_agent_start hook (system prompt injection):\n");
  // -----------------------------------------------------------------------

  // HOOK-04: before_agent_start injects GSD context, agent can use gsd-tools
  await testAsync("HOOK-04: before_agent_start injects GSD context — agent knows gsd-tools path", async () => {
    const ws = createTempWorkspace({ withPlanning: true });
    try {
      const session = spawnPiRpc({
        cwd: ws.dir,
        processTimeoutMs: 120_000,
        model: "anthropic/claude-sonnet-4-20250514",
      });

      try {
        // The before_agent_start hook injects GSD system prompt that tells the agent
        // about gsd-tools.cjs location. Ask the agent to use it — if the prompt was
        // injected, the agent knows the path.
        const events = await promptAndWait(
          session,
          'Run the gsd-tools CLI to get the current timestamp. Use the gsd-tools.cjs path from your system prompt context.',
          90_000,
        );

        // Verify gsd-tools was called
        const toolStarts = session.toolStarts().filter(
          (e) => e.toolName === "bash"
        );
        assert.ok(toolStarts.length > 0,
          "Expected agent to execute a bash tool");

        // Check that at least one bash call references gsd-tools
        const gsdToolsCalls = toolStarts.filter(e =>
          e.args?.command?.includes("gsd-tools")
        );
        assert.ok(gsdToolsCalls.length > 0,
          "Expected agent to call gsd-tools.cjs (system prompt should have told it the path). " +
          `Bash commands seen: ${JSON.stringify(toolStarts.map(e => e.args?.command))}`);
      } finally {
        session.kill();
        await session.waitForExit();
      }
    } finally {
      ws.cleanup();
    }
  });
}

runTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}).catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
