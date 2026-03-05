/**
 * Integration tests for TUI interactions and formatted output integrity
 * Tests: session_start status, error notifications, Unicode preservation, markdown tables
 * Requirements: INTG-20, INTG-21, INTG-22, INTG-23, INTG-24, INTG-25, INTG-26, INTG-27, INTG-28
 *
 * Run: npx tsx tests/intg-tui-output.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import extensionFactory from "../extensions/gsd/index.js";
import { MockExtensionAPI } from "./harness/mock-api.js";
import { createMockContext, createMockCommandContext } from "./harness/mock-context.js";
import { saveEnv, restoreEnv, withTempDir } from "./harness/lifecycle.js";
import { GsdPathResolver } from "../extensions/gsd/path-resolver.js";

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
const resolver = new GsdPathResolver();

async function runTests() {
  // =========================================================================
  console.log("\nsession_start — status indicator:\n");
  // =========================================================================

  // INTG-20
  await testAsync("calls setStatus('gsd', 'GSD ●') when .planning/STATE.md exists", async () => {
    await withTempDir(async (dir) => {
      // withTempDir creates .planning/ — add STATE.md
      fs.writeFileSync(
        path.join(dir, ".planning", "STATE.md"),
        "# State\nstatus: planning"
      );
      const ctx = createMockContext({ cwd: dir });
      await api.fireEvent("session_start", {}, ctx);
      assert.strictEqual(
        ctx.ui.statusCalls.length,
        1,
        `Expected 1 setStatus call, got ${ctx.ui.statusCalls.length}`
      );
      assert.strictEqual(ctx.ui.statusCalls[0].key, "gsd", "Status key should be 'gsd'");
      assert.strictEqual(ctx.ui.statusCalls[0].text, "GSD ●", "Status text should be 'GSD ●'");
    });
  });

  // INTG-21
  await testAsync("does NOT call setStatus when .planning/STATE.md absent", async () => {
    await withTempDir(async (dir) => {
      // withTempDir creates .planning/ but NO STATE.md
      const ctx = createMockContext({ cwd: dir });
      await api.fireEvent("session_start", {}, ctx);
      assert.strictEqual(
        ctx.ui.statusCalls.length,
        0,
        `Expected 0 setStatus calls when STATE.md absent, got ${ctx.ui.statusCalls.length}`
      );
    });
  });

  await testAsync("does NOT call setStatus when .planning/ itself is absent", async () => {
    const dirNoPlanning = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-no-plan-"));
    try {
      const ctx = createMockContext({ cwd: dirNoPlanning });
      await api.fireEvent("session_start", {}, ctx);
      assert.strictEqual(
        ctx.ui.statusCalls.length,
        0,
        "Should not call setStatus when .planning/ absent"
      );
    } finally {
      fs.rmSync(dirNoPlanning, { recursive: true, force: true });
    }
  });

  // =========================================================================
  console.log("\nCommand handler — error notifications:\n");
  // =========================================================================

  // INTG-22
  await testAsync("notifies error when .md file is unreadable", async () => {
    // Find a command to test with
    const cmdNames = [...api.commands.keys()].filter((k) => k.startsWith("gsd:")).sort();
    const testCmdName = cmdNames[0]; // First alphabetically
    const slug = testCmdName.replace("gsd:", "");
    const filePath = path.join(process.cwd(), "commands", "gsd", `${slug}.md`);

    // Temporarily make unreadable
    const origMode = fs.statSync(filePath).mode;
    fs.chmodSync(filePath, 0o000);
    try {
      const cmd = api.commands.get(testCmdName)!;
      const ctx = createMockCommandContext();
      await cmd.handler("", ctx);
      assert.ok(
        ctx.ui.notifyCalls.length >= 1,
        `Expected error notification, got ${ctx.ui.notifyCalls.length} notify calls`
      );
      assert.strictEqual(
        ctx.ui.notifyCalls[0].type,
        "error",
        `Expected notify type 'error', got '${ctx.ui.notifyCalls[0].type}'`
      );
    } finally {
      fs.chmodSync(filePath, origMode);
    }
  });

  // INTG-23
  await testAsync("notifies error when body is empty after parsing", async () => {
    const tempFile = path.join(process.cwd(), "commands", "gsd", "_test-empty.md");
    fs.writeFileSync(tempFile, "---\nname: test-empty\ndescription: test empty\n---\n");

    try {
      // Load extension on a fresh API to pick up the new file
      const freshApi = new MockExtensionAPI();
      extensionFactory(freshApi as any);

      const cmd = freshApi.commands.get("gsd:_test-empty");
      assert.ok(cmd, "Should register the _test-empty command");

      const ctx = createMockCommandContext();
      await cmd.handler("", ctx);
      assert.ok(
        ctx.ui.notifyCalls.length >= 1,
        `Expected error notification for empty body, got ${ctx.ui.notifyCalls.length} notify calls`
      );
      assert.strictEqual(
        ctx.ui.notifyCalls[0].type,
        "error",
        `Expected notify type 'error', got '${ctx.ui.notifyCalls[0].type}'`
      );
    } finally {
      fs.unlinkSync(tempFile);
    }
  });

  // INTG-24
  await testAsync("error notification includes the problematic file path", async () => {
    // Reuse the chmod approach from INTG-22
    const cmdNames = [...api.commands.keys()].filter((k) => k.startsWith("gsd:")).sort();
    const testCmdName = cmdNames[0];
    const slug = testCmdName.replace("gsd:", "");
    const filePath = path.join(process.cwd(), "commands", "gsd", `${slug}.md`);

    const origMode = fs.statSync(filePath).mode;
    fs.chmodSync(filePath, 0o000);
    try {
      const cmd = api.commands.get(testCmdName)!;
      const ctx = createMockCommandContext();
      await cmd.handler("", ctx);
      assert.ok(ctx.ui.notifyCalls.length >= 1, "Should have notify call");
      assert.ok(
        ctx.ui.notifyCalls[0].message.includes(filePath) ||
          ctx.ui.notifyCalls[0].message.includes(slug),
        `Error message should include file path or name, got: ${ctx.ui.notifyCalls[0].message}`
      );
    } finally {
      fs.chmodSync(filePath, origMode);
    }
  });

  // =========================================================================
  console.log("\nFormatted output — Unicode preservation:\n");
  // =========================================================================

  // INTG-25
  testSync("preserves Unicode box-drawing characters after transformation", () => {
    const input = "━━━ $GSD_HOME/workflows/test.md ━━━\n╔══╗\n║hi║\n╚══╝\n─── done ───";
    const result = resolver.transform(input, "");
    assert.ok(result.includes("━━━"), "Should preserve ━ (heavy horizontal)");
    assert.ok(result.includes("╔"), "Should preserve ╔ (double top-left)");
    assert.ok(result.includes("╗"), "Should preserve ╗ (double top-right)");
    assert.ok(result.includes("╚"), "Should preserve ╚ (double bottom-left)");
    assert.ok(result.includes("║"), "Should preserve ║ (double vertical)");
    assert.ok(result.includes("───"), "Should preserve ─ (light horizontal)");
    // Also verify path was rewritten
    assert.ok(!result.includes("$GSD_HOME/"), "Should rewrite $GSD_HOME path");
  });

  // INTG-26
  testSync("preserves status symbols after transformation", () => {
    const input = "Status: ✓ done, ✗ failed, ◆ active, ○ pending, ⚡ auto, ⚠ warn, 🎉 celebrate\n$GSD_HOME/test";
    const result = resolver.transform(input, "");
    assert.ok(result.includes("✓"), "Should preserve ✓");
    assert.ok(result.includes("✗"), "Should preserve ✗");
    assert.ok(result.includes("◆"), "Should preserve ◆");
    assert.ok(result.includes("○"), "Should preserve ○");
    assert.ok(result.includes("⚡"), "Should preserve ⚡");
    assert.ok(result.includes("⚠"), "Should preserve ⚠");
    assert.ok(result.includes("🎉"), "Should preserve 🎉");
    assert.ok(!result.includes("$GSD_HOME/"), "Should rewrite path");
  });

  // INTG-27
  testSync("preserves markdown table formatting after transformation", () => {
    const input = "| Col1 | Col2 | Col3 |\n|------|------|------|\n| $GSD_HOME/a | val | ok |\n| x | y | z |";
    const result = resolver.transform(input, "");
    assert.ok(result.includes("|"), "Should preserve pipe characters");
    assert.ok(result.includes("|------|"), "Should preserve table separator");
    assert.ok(result.includes("| val | ok |"), "Should preserve table cell content");
    assert.ok(!result.includes("$GSD_HOME/"), "Should rewrite path in table cell");
  });

  // INTG-28
  testSync("path rewriting does not corrupt adjacent Unicode characters", () => {
    const input = "━━━ $GSD_HOME/bin ━━━";
    const result = resolver.transform(input, "");
    // Verify the ━ on both sides are intact
    assert.ok(result.startsWith("━━━ "), "Leading ━━━ should be intact");
    assert.ok(result.endsWith(" ━━━"), "Trailing ━━━ should be intact");
    assert.ok(!result.includes("$GSD_HOME/"), "Path should be rewritten");

    const input2 = "✓ ~/.claude/get-shit-done/done ✓";
    const result2 = resolver.transform(input2, "");
    assert.ok(result2.startsWith("✓ "), "Leading ✓ should be intact");
    assert.ok(result2.endsWith(" ✓"), "Trailing ✓ should be intact");
    assert.ok(!result2.includes("~/.claude/get-shit-done/"), "Path should be rewritten");
  });

  // --- Cleanup ---
  restoreEnv(envSnap);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
