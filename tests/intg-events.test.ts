/**
 * Integration tests for event handlers: before_agent_start, tool_call, session_start
 * Tests: system prompt injection, bash command interception, GSD_HOME export prepending
 * Requirements: INTG-11, INTG-12, INTG-13, INTG-14, INTG-15, INTG-16, INTG-17, INTG-18, INTG-19
 *
 * Run: npx tsx tests/intg-events.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import extensionFactory from "../extensions/gsd/index.js";
import { MockExtensionAPI } from "./harness/mock-api.js";
import { createMockContext } from "./harness/mock-context.js";
import { saveEnv, restoreEnv, withTempDir } from "./harness/lifecycle.js";

let passed = 0;
let failed = 0;

function testSync(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

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

// --- Setup ---
const envSnap = saveEnv();
const api = new MockExtensionAPI();
extensionFactory(api as any);
const gsdHome = process.env.GSD_HOME!;

async function runTests() {
  // =========================================================================
  console.log("\nbefore_agent_start — system prompt injection:\n");
  // =========================================================================

  // INTG-11
  await testAsync("returns systemPrompt with GSD context when .planning/ exists", async () => {
    await withTempDir(async (dir) => {
      const ctx = createMockContext({ cwd: dir });
      const result = await api.fireEvent("before_agent_start", { systemPrompt: "base prompt" }, ctx);
      assert.ok(result !== undefined, "Should return an object when .planning/ exists");
      assert.ok(typeof result.systemPrompt === "string", "Should return systemPrompt string");
      assert.ok(
        result.systemPrompt.startsWith("base prompt"),
        "Should preserve original system prompt"
      );
      assert.ok(result.systemPrompt.includes("GSD"), "Should include GSD context in addendum");
    });
  });

  // INTG-12
  await testAsync("returns undefined when .planning/ does not exist", async () => {
    const dirNoPlanning = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-no-plan-"));
    // Remove .planning/ — mkdtempSync doesn't create it, so it's already absent
    try {
      const ctx = createMockContext({ cwd: dirNoPlanning });
      const result = await api.fireEvent("before_agent_start", { systemPrompt: "base" }, ctx);
      assert.strictEqual(result, undefined, "Should return undefined when .planning/ absent");
    } finally {
      fs.rmSync(dirNoPlanning, { recursive: true, force: true });
    }
  });

  // INTG-13
  await testAsync("system prompt contains correct gsdHome path", async () => {
    await withTempDir(async (dir) => {
      const ctx = createMockContext({ cwd: dir });
      const result = await api.fireEvent("before_agent_start", { systemPrompt: "" }, ctx);
      assert.ok(result?.systemPrompt, "Should return systemPrompt");
      assert.ok(
        result.systemPrompt.includes(gsdHome),
        `System prompt should contain gsdHome path '${gsdHome}', but it doesn't`
      );
    });
  });

  // INTG-14
  await testAsync("system prompt contains tool name mapping section", async () => {
    await withTempDir(async (dir) => {
      const ctx = createMockContext({ cwd: dir });
      const result = await api.fireEvent("before_agent_start", { systemPrompt: "" }, ctx);
      assert.ok(result?.systemPrompt, "Should return systemPrompt");
      assert.ok(
        result.systemPrompt.includes("Tool Name Mapping"),
        "Should contain 'Tool Name Mapping' section"
      );
      assert.ok(
        result.systemPrompt.includes("subagent"),
        "Should contain Task→subagent mapping"
      );
      assert.ok(
        result.systemPrompt.includes("gsd-tools.cjs"),
        "Should contain gsd-tools.cjs usage example"
      );
    });
  });

  // =========================================================================
  console.log("\ntool_call — bash command interception:\n");
  // =========================================================================

  // INTG-15
  await testAsync("prepends export GSD_HOME for commands referencing GSD_HOME", async () => {
    const event = { toolName: "bash", input: { command: "echo $GSD_HOME/bin" } };
    await api.fireEvent("tool_call", event);
    assert.ok(
      event.input.command.startsWith("export GSD_HOME="),
      `Should prepend export, got: ${event.input.command.substring(0, 60)}`
    );
    assert.ok(
      event.input.command.includes(gsdHome),
      "Should include correct gsdHome path in export"
    );
  });

  // INTG-16
  await testAsync("prepends export GSD_HOME for commands referencing gsd-tools", async () => {
    const event = { toolName: "bash", input: { command: "node gsd-tools.cjs init" } };
    await api.fireEvent("tool_call", event);
    assert.ok(
      event.input.command.startsWith("export GSD_HOME="),
      `Should prepend export for gsd-tools reference, got: ${event.input.command.substring(0, 60)}`
    );
  });

  // INTG-17
  await testAsync("does NOT modify bash commands without GSD references", async () => {
    const event = { toolName: "bash", input: { command: "ls -la && echo hello" } };
    const original = event.input.command;
    await api.fireEvent("tool_call", event);
    assert.strictEqual(
      event.input.command,
      original,
      `Should not modify non-GSD command, got: ${event.input.command}`
    );
  });

  // INTG-18
  await testAsync("does NOT double-prepend when export GSD_HOME already present", async () => {
    const event = {
      toolName: "bash",
      input: { command: 'export GSD_HOME="/existing"\nnode gsd-tools.cjs' },
    };
    await api.fireEvent("tool_call", event);
    const exportCount = (event.input.command.match(/export GSD_HOME=/g) || []).length;
    assert.strictEqual(
      exportCount,
      1,
      `Should have exactly 1 'export GSD_HOME=', got ${exportCount}`
    );
  });

  await testAsync("does NOT prepend when GSD_HOME= (without export) already present", async () => {
    const event = {
      toolName: "bash",
      input: { command: 'GSD_HOME="/x" node gsd-tools.cjs' },
    };
    await api.fireEvent("tool_call", event);
    assert.ok(
      !event.input.command.startsWith("export GSD_HOME="),
      `Should not prepend when GSD_HOME= already present, got: ${event.input.command.substring(0, 60)}`
    );
  });

  // INTG-19
  await testAsync("ignores non-bash tool calls", async () => {
    const event = { toolName: "read", input: { path: "/some/GSD_HOME/file" } };
    const originalInput = JSON.stringify(event.input);
    await api.fireEvent("tool_call", event);
    assert.strictEqual(
      JSON.stringify(event.input),
      originalInput,
      "Should not modify non-bash tool input"
    );
  });

  await testAsync("ignores tool calls with no input.command", async () => {
    const event = { toolName: "bash", input: {} as any };
    // Should not throw
    await api.fireEvent("tool_call", event);
    assert.ok(true, "Should handle missing command without error");
  });

  // --- Cleanup ---
  restoreEnv(envSnap);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
