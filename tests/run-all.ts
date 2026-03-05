/**
 * Unified test runner — orchestrates all 17 test suites and produces a single
 * Claude AI-readable summary report via formatSummary().
 *
 * Usage:
 *   npx tsx tests/run-all.ts          # Run all suites except E2E
 *   npx tsx tests/run-all.ts --e2e    # Run all suites including E2E
 *
 * Output: Plain text summary with per-suite pass/fail counts and failure index.
 * Exit code: 0 if all pass, 1 if any fail.
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatSummary, SuiteResult, TestFailure, SummaryInput } from "./harness/diagnostic.js";

// Project root — one level up from tests/
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Suite definitions — explicit list (NOT glob discovery)
// ---------------------------------------------------------------------------

interface SuiteDef {
  file: string;
  category: string;
}

const SUITES: SuiteDef[] = [
  // Harness
  { file: "harness-mock.test.ts", category: "Harness" },
  { file: "harness-util.test.ts", category: "Harness" },
  // Unit
  { file: "unit-path-rewrite.test.ts", category: "Unit" },
  { file: "unit-exec-context.test.ts", category: "Unit" },
  { file: "unit-frontmatter.test.ts", category: "Unit" },
  // Integration
  { file: "intg-loading.test.ts", category: "Integration" },
  { file: "intg-commands.test.ts", category: "Integration" },
  { file: "intg-events.test.ts", category: "Integration" },
  { file: "intg-tui-output.test.ts", category: "Integration" },
  { file: "intg-edge-cases.test.ts", category: "Integration" },
  // Parity
  { file: "parity-files.test.ts", category: "Parity" },
  { file: "parity-agents.test.ts", category: "Parity" },
  // Wiring
  { file: "wiring-agents.test.ts", category: "Wiring" },
  { file: "wiring-models.test.ts", category: "Wiring" },
  { file: "wiring-templates.test.ts", category: "Wiring" },
  // Compliance
  { file: "compliance.test.ts", category: "Compliance" },
  // E2E (conditional)
  { file: "e2e-smoke.test.ts", category: "E2E" },
  { file: "e2e-subagent.test.ts", category: "E2E" },
  // Runtime (real Pi process — mandatory, not gated)
  { file: "runtime-wiring.test.ts", category: "Runtime" },
  { file: "runtime-hooks.test.ts", category: "Runtime" },
  { file: "runtime-isolation.test.ts", category: "Runtime" },
  // Legacy
  { file: "path-resolver.test.ts", category: "Legacy" },
  { file: "command-loading.test.ts", category: "Legacy" },
];

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

/**
 * Parse child process stdout into a SuiteResult.
 * Handles three output format variants:
 *   - "{N} passed, {N} failed"
 *   - "{N} tests: {N} passed, {N} failed"
 *   - "Results: {N} passed, {N} failed out of {N} tests"
 */
function parseSuiteOutput(
  file: string,
  stdout: string,
  exitCode: number,
  duration: number,
): SuiteResult {
  const name = file.replace(".test.ts", "");

  // Universal regex — captures all three format variants
  const countMatch = stdout.match(/(\d+)\s+passed,\s+(\d+)\s+failed/);
  const passed = countMatch ? parseInt(countMatch[1], 10) : 0;
  const failed = countMatch ? parseInt(countMatch[2], 10) : (exitCode !== 0 ? 1 : 0);

  // Extract failure lines: "  ✗ test name" followed by "    reason"
  const failures: TestFailure[] = [];
  const lines = stdout.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const failMatch = lines[i].match(/^\s+✗\s+(.+)$/);
    if (failMatch) {
      const reason = i + 1 < lines.length ? lines[i + 1].trim() : "unknown";
      failures.push({ test: failMatch[1], reason });
    }
  }

  return { name, passed, failed, duration, failures };
}

// ---------------------------------------------------------------------------
// Suite runner
// ---------------------------------------------------------------------------

/**
 * Run a single test suite as a child process and return parsed results.
 * execSync throws on non-zero exit — we catch and extract stdout/status.
 */
function runSuite(file: string, args: string[] = []): SuiteResult {
  const cmd = `npx tsx tests/${file}` + (args.length ? " " + args.join(" ") : "");
  const start = Date.now();

  try {
    const stdout = execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const duration = Date.now() - start;
    return parseSuiteOutput(file, stdout, 0, duration);
  } catch (err: any) {
    const duration = Date.now() - start;
    const stdout: string = err.stdout || "";
    const stderr: string = err.stderr || "";
    const exitCode: number = err.status ?? 1;

    // If no stdout at all, the suite crashed entirely
    if (!stdout && !stderr) {
      return {
        name: file.replace(".test.ts", ""),
        passed: 0,
        failed: 1,
        duration,
        failures: [{ test: file, reason: "Suite crashed — no output" }],
      };
    }

    // If no stdout but stderr has content, suite crashed with an error
    if (!stdout && stderr) {
      const reason = stderr.split("\n").filter(Boolean).slice(0, 3).join(" | ");
      return {
        name: file.replace(".test.ts", ""),
        passed: 0,
        failed: 1,
        duration,
        failures: [{ test: file, reason: reason || "Suite crashed" }],
      };
    }

    return parseSuiteOutput(file, stdout, exitCode, duration);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const e2eEnabled = process.argv.includes("--e2e");
const suites: SuiteResult[] = [];
let hasFailures = false;
const totalStart = Date.now();

console.log("Running pi-gsd test suites...\n");

for (const suite of SUITES) {
  // E2E gating
  if (suite.category === "E2E" && !e2eEnabled) {
    console.log(`Skipping ${suite.file} (--e2e not set)`);
    continue;
  }

  console.log(`Running ${suite.file}...`);
  const args = suite.category === "E2E" && e2eEnabled ? ["--e2e"] : [];
  const result = runSuite(suite.file, args);
  suites.push(result);

  // Inline status
  if (result.failed > 0) {
    console.log(`  ✗ ${result.name} (${result.failed} failed)\n`);
    hasFailures = true;
  } else {
    console.log(`  ✓ ${result.name}\n`);
  }
}

// Final summary via formatSummary
const totalDuration = Date.now() - totalStart;
const summaryInput: SummaryInput = { suites, totalDuration };
console.log("");
console.log(formatSummary(summaryInput));

process.exit(hasFailures ? 1 : 0);
