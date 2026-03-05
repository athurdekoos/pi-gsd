/**
 * Parity tests: agent path verification
 * Tests: PRTY-11, PRTY-12
 *
 * Verifies pi-gsd agent files are outcome-equivalent to upstream by:
 *   1. Transform-and-compare: apply path replacements to upstream, compare to pi-gsd (PRTY-11)
 *   2. Residual pattern scan: no .claude/get-shit-done paths remain in pi-gsd agents (PRTY-12)
 *
 * Run: npx tsx tests/parity-agents.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  resolveUpstream,
  cleanupUpstream,
} from "./helpers/upstream-resolver.ts";

const upstream = resolveUpstream();
const pigsdRoot = path.resolve(__dirname, "..");

process.on("exit", cleanupUpstream);

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

/**
 * Transform upstream agent content to match pi-gsd conventions.
 * Applies 3 path replacement rules in correct order:
 *   1. $HOME/.claude/get-shit-done/ → $GSD_HOME/
 *   2. @~/.claude/get-shit-done/   → @$GSD_HOME/  (MUST run before rule 3)
 *   3. ~/.claude/get-shit-done/    → $GSD_HOME/
 *
 * Order matters: rule 2 before rule 3 prevents @~ from being partially matched.
 */
function transformUpstreamAgent(content: string): string {
  return content
    .replace(/\$HOME\/\.claude\/get-shit-done\//g, "$GSD_HOME/")
    .replace(/@~\/\.claude\/get-shit-done\//g, "@$GSD_HOME/")
    .replace(/~\/\.claude\/get-shit-done\//g, "$GSD_HOME/");
}

/**
 * Find first differing line between two strings.
 * Returns { lineNum, upstreamLine, pigsdLine } or null if identical.
 */
function firstDiffLine(
  a: string,
  b: string
): { lineNum: number; aLine: string; bLine: string } | null {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const len = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < len; i++) {
    const aLine = aLines[i] ?? "<EOF>";
    const bLine = bLines[i] ?? "<EOF>";
    if (aLine !== bLine) {
      return { lineNum: i + 1, aLine, bLine };
    }
  }
  return null;
}

// Get agent files from upstream
const upstreamAgentsDir = path.join(upstream, "agents");
const pigsdAgentsDir = path.join(pigsdRoot, "agents");
const agentFiles = fs
  .readdirSync(upstreamAgentsDir)
  .filter((f) => f.endsWith(".md"))
  .sort();

// =========================================================================
console.log("\nTransform-and-compare (PRTY-11):\n");
// =========================================================================

for (const agentFile of agentFiles) {
  const agentName = agentFile.replace(".md", "");

  testSync(`[PRTY-11] ${agentName} matches upstream after path transform`, () => {
    const upstreamPath = path.join(upstreamAgentsDir, agentFile);
    const pigsdPath = path.join(pigsdAgentsDir, agentFile);

    // Verify pi-gsd counterpart exists
    assert.ok(
      fs.existsSync(pigsdPath),
      `FILE: tests/parity-agents.test.ts → transform-and-compare [${agentName}]\n` +
        `  EXPECTED: pi-gsd agent file exists at ${pigsdPath}\n` +
        `  ACTUAL: File not found\n` +
        `  WHY: Cannot compare agent content if pi-gsd version is missing.`
    );

    const upstreamRaw = fs.readFileSync(upstreamPath, "utf-8");
    const pigsdContent = fs.readFileSync(pigsdPath, "utf-8");
    const transformed = transformUpstreamAgent(upstreamRaw);

    if (transformed !== pigsdContent) {
      const diff = firstDiffLine(transformed, pigsdContent);
      const evidence = diff
        ? `First difference at line ${diff.lineNum}:\n` +
          `      upstream (transformed): ${diff.aLine}\n` +
          `      pi-gsd:                 ${diff.bLine}`
        : "Unknown difference";

      assert.fail(
        `FILE: tests/parity-agents.test.ts → transform-and-compare [${agentName}]\n` +
          `  EXPECTED: Upstream content after path transform matches pi-gsd version\n` +
          `  ACTUAL: Content differs after transformation\n` +
          `  WHY: Agent file has drifted from upstream — either content was modified\n` +
          `       in upstream without syncing to pi-gsd, or pi-gsd has local edits\n` +
          `       beyond path replacement.\n` +
          `  EVIDENCE: ${evidence}`
      );
    }
  });
}

// =========================================================================
console.log("\nResidual path pattern scan (PRTY-12):\n");
// =========================================================================

const RESIDUAL_PATTERN = /\.claude\/get-shit-done/;

for (const agentFile of agentFiles) {
  const agentName = agentFile.replace(".md", "");

  testSync(`[PRTY-12] ${agentName} has no residual .claude/get-shit-done paths`, () => {
    const pigsdPath = path.join(pigsdAgentsDir, agentFile);

    if (!fs.existsSync(pigsdPath)) {
      // Already caught by PRTY-11 / PRTY-02; skip here
      return;
    }

    const content = fs.readFileSync(pigsdPath, "utf-8");
    const lines = content.split("\n");
    const occurrences: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      if (RESIDUAL_PATTERN.test(lines[i])) {
        occurrences.push(`Line ${i + 1}: ${lines[i].trim()}`);
      }
    }

    assert.strictEqual(
      occurrences.length,
      0,
      `FILE: tests/parity-agents.test.ts → no-residual-paths [${agentName}]\n` +
        `  EXPECTED: Zero occurrences of .claude/get-shit-done in pi-gsd agent\n` +
        `  ACTUAL: Found ${occurrences.length} occurrence(s)\n` +
        `  WHY: Residual upstream paths cause agents to reference non-existent\n` +
        `       directories when running under pi-gsd.\n` +
        `  EVIDENCE:\n    ${occurrences.join("\n    ")}`
    );
  });
}

// =========================================================================
// Summary
// =========================================================================
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
