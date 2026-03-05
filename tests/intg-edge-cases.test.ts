/**
 * Integration tests for idempotency and error handling edge cases
 * Tests: double-loading, missing gsd/, missing gsd-tools.cjs, missing commands/gsd/
 * Requirements: INTG-29, INTG-30, INTG-31, INTG-32
 *
 * CRITICAL: These tests temporarily rename real directories.
 * Every rename is in a try/finally block. Tests run sequentially.
 * DO NOT run in parallel with other tests that depend on gsd/ or commands/gsd/.
 *
 * Run: npx tsx tests/intg-edge-cases.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import extensionFactory from "../extensions/gsd/index.js";
import { MockExtensionAPI } from "./harness/mock-api.js";
import { saveEnv, restoreEnv } from "./harness/lifecycle.js";

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

const envSnap = saveEnv();

async function runTests() {
  // =========================================================================
  console.log("\nDouble loading — idempotency:\n");
  // =========================================================================

  // INTG-29
  testSync("loading extension twice produces duplicate handler registrations", () => {
    const api = new MockExtensionAPI();

    // First load
    extensionFactory(api as any);
    assert.strictEqual(api.commands.size, 32, `First load: expected 32 commands, got ${api.commands.size}`);

    // Second load — same API instance
    extensionFactory(api as any);

    // Commands Map uses set() — same keys overwritten, size stays 32
    assert.strictEqual(
      api.commands.size,
      32,
      `After double load: expected 32 commands (Map dedup), got ${api.commands.size}`
    );

    // Event subscriptions accumulate — handlers array appended
    assert.strictEqual(
      api.subscriptions.get("before_agent_start")!.length,
      2,
      `Expected 2 before_agent_start handlers after double load, got ${api.subscriptions.get("before_agent_start")!.length}`
    );
    assert.strictEqual(
      api.subscriptions.get("tool_call")!.length,
      2,
      `Expected 2 tool_call handlers after double load, got ${api.subscriptions.get("tool_call")!.length}`
    );
    assert.strictEqual(
      api.subscriptions.get("session_start")!.length,
      2,
      `Expected 2 session_start handlers after double load, got ${api.subscriptions.get("session_start")!.length}`
    );
  });

  // =========================================================================
  console.log("\nMissing gsd/ directory:\n");
  // =========================================================================

  // INTG-30
  await testAsync("extension with missing gsd/ directory logs error and returns without crashing", async () => {
    const snap = saveEnv();
    let stderrOutput = "";
    const origWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      stderrOutput += chunk.toString();
      return true;
    }) as any;

    // Rename gsd/ temporarily
    fs.renameSync("gsd", "gsd.bak");
    try {
      const freshApi = new MockExtensionAPI();
      extensionFactory(freshApi as any);

      assert.strictEqual(
        freshApi.commands.size,
        0,
        `Expected 0 commands with missing gsd/, got ${freshApi.commands.size}`
      );
      assert.strictEqual(
        freshApi.subscriptions.size,
        0,
        `Expected 0 subscriptions with missing gsd/, got ${freshApi.subscriptions.size}`
      );
      assert.ok(
        stderrOutput.includes("[pi-gsd]"),
        `Expected '[pi-gsd]' in stderr, got: ${stderrOutput}`
      );
    } finally {
      fs.renameSync("gsd.bak", "gsd");
      process.stderr.write = origWrite;
      restoreEnv(snap);
    }
  });

  // =========================================================================
  console.log("\nMissing gsd/bin/gsd-tools.cjs:\n");
  // =========================================================================

  // INTG-31
  await testAsync("extension with missing gsd/bin/gsd-tools.cjs logs error and returns without crashing", async () => {
    const snap = saveEnv();
    let stderrOutput = "";
    const origWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      stderrOutput += chunk.toString();
      return true;
    }) as any;

    fs.renameSync("gsd/bin/gsd-tools.cjs", "gsd/bin/gsd-tools.cjs.bak");
    try {
      const freshApi = new MockExtensionAPI();
      extensionFactory(freshApi as any);

      assert.strictEqual(
        freshApi.commands.size,
        0,
        `Expected 0 commands with missing gsd-tools.cjs, got ${freshApi.commands.size}`
      );
      assert.strictEqual(
        freshApi.subscriptions.size,
        0,
        `Expected 0 subscriptions with missing gsd-tools.cjs, got ${freshApi.subscriptions.size}`
      );
      assert.ok(
        stderrOutput.includes("[pi-gsd]"),
        `Expected '[pi-gsd]' in stderr, got: ${stderrOutput}`
      );
    } finally {
      fs.renameSync("gsd/bin/gsd-tools.cjs.bak", "gsd/bin/gsd-tools.cjs");
      process.stderr.write = origWrite;
      restoreEnv(snap);
    }
  });

  // =========================================================================
  console.log("\nMissing commands/gsd/ directory:\n");
  // =========================================================================

  // INTG-32
  await testAsync("extension with missing commands/gsd/ registers only bare /gsd", async () => {
    const snap = saveEnv();

    fs.renameSync("commands/gsd", "commands/gsd.bak");
    try {
      const freshApi = new MockExtensionAPI();
      extensionFactory(freshApi as any);

      // registerGsdCommands returns 0, but bare /gsd is registered separately
      assert.strictEqual(
        freshApi.commands.size,
        1,
        `Expected 1 command (bare /gsd) with missing commands/gsd/, got ${freshApi.commands.size}`
      );
      assert.ok(
        freshApi.commands.has("gsd"),
        "Should have bare 'gsd' command even with missing commands/gsd/"
      );

      // Event handlers still registered
      assert.strictEqual(
        freshApi.subscriptions.size,
        3,
        `Expected 3 event subscriptions even with missing commands/gsd/, got ${freshApi.subscriptions.size}`
      );
    } finally {
      fs.renameSync("commands/gsd.bak", "commands/gsd");
      restoreEnv(snap);
    }
  });

  // =========================================================================
  // Safety: verify critical directories exist after all tests
  // =========================================================================
  if (!fs.existsSync("gsd")) {
    console.error("CRITICAL: gsd/ directory missing after tests — restoring from gsd.bak");
    if (fs.existsSync("gsd.bak")) fs.renameSync("gsd.bak", "gsd");
  }
  if (!fs.existsSync("gsd/bin/gsd-tools.cjs")) {
    console.error("CRITICAL: gsd/bin/gsd-tools.cjs missing — restoring from .bak");
    if (fs.existsSync("gsd/bin/gsd-tools.cjs.bak")) fs.renameSync("gsd/bin/gsd-tools.cjs.bak", "gsd/bin/gsd-tools.cjs");
  }
  if (!fs.existsSync("commands/gsd")) {
    console.error("CRITICAL: commands/gsd/ missing after tests — restoring from commands/gsd.bak");
    if (fs.existsSync("commands/gsd.bak")) fs.renameSync("commands/gsd.bak", "commands/gsd");
  }

  // --- Cleanup ---
  restoreEnv(envSnap);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
