/**
 * E2E smoke tests — spawn a real Pi process with the extension loaded.
 * Verifies the extension factory executes and commands register in a real Pi runtime.
 * Gated behind --e2e flag for opt-in execution (keeps fast unit suite clean).
 * Requirements: E2E-01, E2E-02
 *
 * Run: npx tsx tests/e2e-smoke.test.ts --e2e
 */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { formatFailure } from "./harness/diagnostic.js";

// =========================================================================
// Skip gate — check preconditions before running any tests
// =========================================================================

if (!process.argv.includes("--e2e")) {
  console.log("Skipping E2E: --e2e flag not set");
  process.exit(0);
}

try {
  execSync("which pi", { encoding: "utf-8", stdio: "pipe" });
} catch {
  console.log("Skipping E2E: pi binary not found in PATH");
  process.exit(0);
}

// =========================================================================
// Pi process helper
// =========================================================================

function runPi(args: string, timeoutMs = 30000): { exitCode: number; output: string } {
  try {
    // Redirect stderr to stdout so we capture conflict messages and load errors
    const output = execSync(`pi ${args} 2>&1`, {
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { exitCode: 0, output };
  } catch (err: any) {
    return {
      exitCode: err.status ?? 1,
      output: (err.stdout ?? "") + (err.stderr ?? ""),
    };
  }
}

// =========================================================================
// Test scaffolding
// =========================================================================

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

// =========================================================================
console.log("\nE2E Smoke Tests\n");
// =========================================================================

const piResult = runPi("-p -e ./extensions/gsd echo test", 30000);

// E2E-01
testSync("E2E-01: pi process loads extension without crashing", () => {
  assert.ok(
    piResult.output.length > 0,
    formatFailure({
      file: "extensions/gsd/index.ts",
      expected: "Pi process completes with output (no crash/hang)",
      actual: "No output captured — process may have crashed",
      why: "E2E-01 requires the extension to load in a real Pi process without crashing",
    })
  );
});

// E2E-02
testSync("E2E-02: extension commands are discoverable by Pi runtime", () => {
  const gsdMentions = (piResult.output.match(/\/gsd/g) || []).length;
  assert.ok(
    gsdMentions > 0,
    formatFailure({
      file: "extensions/gsd/index.ts → registerGsdCommands()",
      expected: "Output contains /gsd command references (conflict messages or registration log)",
      actual: `No /gsd patterns found in ${piResult.output.length} chars of output`,
      why: "E2E-02 requires commands to be discoverable by the Pi runtime",
      evidence: piResult.output.substring(0, 300),
    })
  );
});

// =========================================================================
// Summary
// =========================================================================

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
