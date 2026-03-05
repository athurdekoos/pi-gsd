/**
 * Integration tests for command handler execution and transformation
 * Tests: sendUserMessage, hot-reload, path rewriting, argument injection, execution_context
 * Requirements: INTG-06, INTG-07, INTG-08, INTG-09, INTG-10
 *
 * Run: npx tsx tests/intg-commands.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import extensionFactory from "../extensions/gsd/index.js";
import { MockExtensionAPI } from "./harness/mock-api.js";
import { createMockCommandContext } from "./harness/mock-context.js";
import { saveEnv, restoreEnv } from "./harness/lifecycle.js";

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
  console.log("\nCommand handler — sendUserMessage:\n");
  // =========================================================================

  // INTG-06
  await testAsync("invoking handler calls sendUserMessage with transformed content", async () => {
    const cmd = api.commands.get("gsd:help");
    assert.ok(cmd, "gsd:help command should exist");
    const ctx = createMockCommandContext();
    api.messages.length = 0;
    await cmd.handler("", ctx);
    assert.strictEqual(
      api.messages.length,
      1,
      `Expected exactly 1 message, got ${api.messages.length}`
    );
    assert.ok(typeof api.messages[0].content === "string", "Content should be a string");
    assert.ok(api.messages[0].content.length > 0, "Content should be non-empty");
  });

  await testAsync("handler sends content without frontmatter", async () => {
    // The last message from the previous test
    const content = api.messages[0].content;
    assert.ok(
      !content.startsWith("---"),
      "Content should not start with frontmatter delimiter"
    );
  });

  // =========================================================================
  console.log("\nCommand handler — hot-reload:\n");
  // =========================================================================

  // INTG-07
  await testAsync("handler re-reads .md file at invocation time", async () => {
    const cmd = api.commands.get("gsd:help");
    assert.ok(cmd, "gsd:help command should exist");
    const ctx = createMockCommandContext();

    // First invocation
    api.messages.length = 0;
    await cmd.handler("", ctx);
    const firstContent = api.messages[0].content;

    // Second invocation — should re-read file and produce same content
    api.messages.length = 0;
    await cmd.handler("", ctx);
    const secondContent = api.messages[0].content;

    assert.strictEqual(
      firstContent,
      secondContent,
      "Two invocations should produce identical content (re-read same file)"
    );
  });

  // =========================================================================
  console.log("\nCommand handler — path rewriting:\n");
  // =========================================================================

  // INTG-08
  await testAsync("transformed output has no remaining ~/.claude/get-shit-done/ patterns", async () => {
    const cmd = api.commands.get("gsd:plan-phase");
    assert.ok(cmd, "gsd:plan-phase command should exist");
    const ctx = createMockCommandContext();
    api.messages.length = 0;
    await cmd.handler("1", ctx);

    assert.ok(api.messages.length > 0, "Should have sent a message");
    const content = api.messages[0].content;

    assert.ok(
      !content.includes("~/.claude/get-shit-done/"),
      "Should not contain ~/.claude/get-shit-done/ pattern"
    );
    assert.ok(
      !content.includes("$HOME/.claude/get-shit-done/"),
      "Should not contain $HOME/.claude/get-shit-done/ pattern"
    );
    assert.ok(
      !content.includes("@~/.claude/get-shit-done/"),
      "Should not contain @~/.claude/get-shit-done/ pattern"
    );
    assert.ok(
      content.includes(gsdHome),
      `Should contain resolved gsdHome path '${gsdHome}'`
    );
  });

  // =========================================================================
  console.log("\nCommand handler — argument injection:\n");
  // =========================================================================

  // INTG-09
  await testAsync("transformed output has $ARGUMENTS replaced with provided args", async () => {
    const cmd = api.commands.get("gsd:plan-phase");
    assert.ok(cmd, "gsd:plan-phase command should exist");
    const ctx = createMockCommandContext();
    api.messages.length = 0;
    await cmd.handler("3 --skip-research", ctx);

    const content = api.messages[0].content;
    assert.ok(
      !content.includes("$ARGUMENTS"),
      "Should not contain $ARGUMENTS placeholder"
    );
    assert.ok(
      content.includes("3 --skip-research"),
      "Should contain the provided arguments"
    );
  });

  await testAsync("empty args replaces $ARGUMENTS with empty string", async () => {
    const cmd = api.commands.get("gsd:plan-phase");
    assert.ok(cmd, "gsd:plan-phase command should exist");
    const ctx = createMockCommandContext();
    api.messages.length = 0;
    await cmd.handler("", ctx);

    const content = api.messages[0].content;
    assert.ok(
      !content.includes("$ARGUMENTS"),
      "Should not contain $ARGUMENTS even with empty args"
    );
  });

  // =========================================================================
  console.log("\nCommand handler — execution context transformation:\n");
  // =========================================================================

  // INTG-10
  await testAsync("execution_context blocks contain Read instructions", async () => {
    const cmd = api.commands.get("gsd:plan-phase");
    assert.ok(cmd, "gsd:plan-phase command should exist");
    const ctx = createMockCommandContext();
    api.messages.length = 0;
    await cmd.handler("1", ctx);

    const content = api.messages[0].content;

    // The execution_context block should be preserved
    assert.ok(
      content.includes("<execution_context>"),
      "Should preserve execution_context block"
    );

    // After transformation, @-includes become "Read these files" instructions
    assert.ok(
      content.includes("Read"),
      "Should contain Read instructions in execution_context"
    );

    // The @-prefixed file includes should be converted to bullet list paths
    // Original: @~/.claude/get-shit-done/workflows/plan-phase.md
    // After rewrite + context transform: - /path/to/gsd/workflows/plan-phase.md
    assert.ok(
      content.includes(gsdHome + "/workflows/plan-phase.md") ||
        content.includes(gsdHome + "/references/"),
      "Should contain resolved file paths in execution_context"
    );
  });

  // =========================================================================
  console.log("\nBare /gsd command:\n");
  // =========================================================================

  await testAsync("bare /gsd command sends help content", async () => {
    const cmd = api.commands.get("gsd");
    assert.ok(cmd, "bare 'gsd' command should exist");
    const ctx = createMockCommandContext();
    api.messages.length = 0;
    await cmd.handler("", ctx);

    assert.ok(api.messages.length > 0, "Should send a message");
    const content = api.messages[0].content;
    assert.ok(content.length > 0, "Should send non-empty content");
  });

  // --- Cleanup ---
  restoreEnv(envSnap);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
