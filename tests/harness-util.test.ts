/**
 * Self-test for lifecycle helpers and diagnostic formatters
 * Validates env save/restore, temp dirs, and output formatting (HARN-06 through HARN-09)
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { saveEnv, restoreEnv, withTempDir } from "./harness/lifecycle.js";
import { formatFailure, formatSummary } from "./harness/diagnostic.js";

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

async function run() {
  // =========================================================================
  console.log("\nlifecycle — env save/restore:\n");
  // =========================================================================

  testSync("saves and restores GSD_HOME when set", () => {
    // Guard the outer env
    const outerSnap = saveEnv();
    try {
      process.env.GSD_HOME = "/original";
      const snap = saveEnv();
      process.env.GSD_HOME = "/modified";
      assert.strictEqual(process.env.GSD_HOME, "/modified", "should be modified before restore");
      restoreEnv(snap);
      assert.strictEqual(process.env.GSD_HOME, "/original", "should be restored to /original");
    } finally {
      restoreEnv(outerSnap);
    }
  });

  testSync("saves and restores when GSD_HOME is undefined", () => {
    const outerSnap = saveEnv();
    try {
      delete process.env.GSD_HOME;
      const snap = saveEnv();
      process.env.GSD_HOME = "/temporary";
      assert.strictEqual(process.env.GSD_HOME, "/temporary", "should be set to /temporary");
      restoreEnv(snap);
      assert.strictEqual(process.env.GSD_HOME, undefined, "should be undefined after restore");
    } finally {
      restoreEnv(outerSnap);
    }
  });

  testSync("does not affect other env vars", () => {
    const outerSnap = saveEnv();
    try {
      process.env.OTHER_VAR_TEST = "keep";
      process.env.GSD_HOME = "/before";
      const snap = saveEnv();
      process.env.GSD_HOME = "/changed";
      restoreEnv(snap);
      assert.strictEqual(process.env.OTHER_VAR_TEST, "keep", "OTHER_VAR_TEST should be untouched");
    } finally {
      delete process.env.OTHER_VAR_TEST;
      restoreEnv(outerSnap);
    }
  });

  // =========================================================================
  console.log("\nlifecycle — withTempDir:\n");
  // =========================================================================

  await testAsync("creates temp directory and passes path to function", async () => {
    let existed = false;
    await withTempDir((dir) => {
      existed = fs.existsSync(dir);
    });
    assert.ok(existed, "temp directory should exist inside callback");
  });

  await testAsync("creates .planning/ subdirectory inside temp dir", async () => {
    let planningExisted = false;
    await withTempDir((dir) => {
      planningExisted = fs.existsSync(path.join(dir, ".planning"));
    });
    assert.ok(planningExisted, ".planning/ should exist inside temp dir");
  });

  await testAsync("cleans up temp directory after function completes", async () => {
    let capturedDir = "";
    await withTempDir((dir) => {
      capturedDir = dir;
    });
    assert.ok(capturedDir.length > 0, "should have captured dir path");
    assert.ok(!fs.existsSync(capturedDir), "temp directory should not exist after withTempDir returns");
  });

  await testAsync("cleans up even when function throws", async () => {
    let capturedDir = "";
    try {
      await withTempDir((dir) => {
        capturedDir = dir;
        throw new Error("intentional test error");
      });
    } catch {
      // expected
    }
    assert.ok(capturedDir.length > 0, "should have captured dir path");
    assert.ok(!fs.existsSync(capturedDir), "temp directory should be cleaned up even after error");
  });

  await testAsync("handles async functions", async () => {
    let capturedDir = "";
    let asyncCompleted = false;
    await withTempDir(async (dir) => {
      capturedDir = dir;
      await new Promise((r) => setTimeout(r, 10));
      asyncCompleted = true;
    });
    assert.ok(asyncCompleted, "async function should have completed");
    assert.ok(!fs.existsSync(capturedDir), "temp directory should be cleaned up after async function");
  });

  // =========================================================================
  console.log("\ndiagnostic — formatFailure:\n");
  // =========================================================================

  testSync("includes all required sections", () => {
    const result = formatFailure({
      file: "src/test.ts",
      expected: "value to be 42",
      actual: "value was 0",
      why: "calculation failed",
    });
    assert.ok(result.includes("FILE:"), "should contain FILE: label");
    assert.ok(result.includes("EXPECTED:"), "should contain EXPECTED: label");
    assert.ok(result.includes("ACTUAL:"), "should contain ACTUAL: label");
    assert.ok(result.includes("WHY:"), "should contain WHY: label");
  });

  testSync("includes file path in FILE section", () => {
    const result = formatFailure({
      file: "src/test.ts",
      expected: "x",
      actual: "y",
      why: "z",
    });
    assert.ok(result.includes("FILE: src/test.ts"), "should contain file path after FILE:");
  });

  testSync("includes EVIDENCE when provided", () => {
    const result = formatFailure({
      file: "src/test.ts",
      expected: "x",
      actual: "y",
      why: "z",
      evidence: "raw value: [1, 2, 3]",
    });
    assert.ok(result.includes("EVIDENCE:"), "should contain EVIDENCE: label");
    assert.ok(result.includes("raw value: [1, 2, 3]"), "should contain evidence content");
  });

  testSync("omits EVIDENCE when not provided", () => {
    const result = formatFailure({
      file: "src/test.ts",
      expected: "x",
      actual: "y",
      why: "z",
    });
    assert.ok(!result.includes("EVIDENCE:"), "should NOT contain EVIDENCE: when not provided");
  });

  testSync("produces plain text with no ANSI codes", () => {
    const result = formatFailure({
      file: "src/test.ts",
      expected: "x",
      actual: "y",
      why: "z",
      evidence: "data",
    });
    assert.ok(!/\x1b\[/.test(result), "should not contain ANSI escape codes");
  });

  testSync("includes actual values in sections", () => {
    const result = formatFailure({
      file: "extensions/gsd/path-resolver.ts",
      expected: "All paths rewritten",
      actual: "2 patterns unrewritten",
      why: "Regex missed $HOME variant",
    });
    assert.ok(result.includes("All paths rewritten"), "should contain expected value");
    assert.ok(result.includes("2 patterns unrewritten"), "should contain actual value");
    assert.ok(result.includes("Regex missed $HOME variant"), "should contain why value");
  });

  // =========================================================================
  console.log("\ndiagnostic — formatSummary:\n");
  // =========================================================================

  testSync("includes per-suite pass/fail counts", () => {
    const result = formatSummary({
      suites: [
        { name: "mock-api", passed: 10, failed: 2, duration: 50, failures: [] },
        { name: "lifecycle", passed: 5, failed: 0, duration: 30, failures: [] },
      ],
      totalDuration: 80,
    });
    assert.ok(result.includes("mock-api: 10 passed, 2 failed"), "should contain mock-api suite line");
    assert.ok(result.includes("lifecycle: 5 passed, 0 failed"), "should contain lifecycle suite line");
  });

  testSync("includes total counts", () => {
    const result = formatSummary({
      suites: [
        { name: "a", passed: 3, failed: 1, duration: 10, failures: [] },
        { name: "b", passed: 7, failed: 0, duration: 20, failures: [] },
      ],
      totalDuration: 30,
    });
    assert.ok(result.includes("Total: 10 passed, 1 failed"), "should contain total counts");
  });

  testSync("includes total duration", () => {
    const result = formatSummary({
      suites: [
        { name: "a", passed: 1, failed: 0, duration: 10, failures: [] },
      ],
      totalDuration: 150,
    });
    assert.ok(result.includes("150ms"), "should contain total duration in ms");
  });

  testSync("includes failure index when tests fail", () => {
    const result = formatSummary({
      suites: [
        {
          name: "mock-api",
          passed: 8,
          failed: 2,
          duration: 50,
          failures: [
            { test: "records command", reason: "handler was null" },
            { test: "fires event", reason: "returned undefined" },
          ],
        },
      ],
      totalDuration: 50,
    });
    assert.ok(result.includes("FAILURE INDEX:"), "should contain FAILURE INDEX:");
    assert.ok(result.includes("records command"), "should contain failed test name");
    assert.ok(result.includes("handler was null"), "should contain failure reason");
  });

  testSync("omits failure index when all pass", () => {
    const result = formatSummary({
      suites: [
        { name: "all-pass", passed: 5, failed: 0, duration: 10, failures: [] },
      ],
      totalDuration: 10,
    });
    assert.ok(!result.includes("FAILURE INDEX:"), "should NOT contain FAILURE INDEX: when all pass");
  });

  testSync("failure index includes suite name, test name, and reason", () => {
    const result = formatSummary({
      suites: [
        {
          name: "my-suite",
          passed: 0,
          failed: 1,
          duration: 5,
          failures: [
            { test: "test-name", reason: "expected 1, got 2" },
          ],
        },
      ],
      totalDuration: 5,
    });
    assert.ok(
      result.includes("  my-suite > test-name — expected 1, got 2"),
      `should match format "  suiteName > testName — reason", got:\n${result}`
    );
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
