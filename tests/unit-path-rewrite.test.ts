/**
 * Unit tests for GsdPathResolver.rewritePaths()
 * Tests all 4 path rewriting patterns with positive, negative, and edge cases.
 * Requirements: UNIT-01 through UNIT-07
 *
 * Run: npx tsx tests/unit-path-rewrite.test.ts
 */

import assert from "node:assert";
import { saveEnv, restoreEnv } from "./harness/lifecycle.js";
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

// Save env before constructing resolver (constructor sets process.env.GSD_HOME)
const envSnap = saveEnv();
const resolver = new GsdPathResolver();
const gsdHome = resolver.gsdHome;

// =========================================================================
console.log("\nrewritePaths — pattern coverage:\n");
// =========================================================================

// UNIT-01
testSync("replaces @~/.claude/get-shit-done/ with actual gsdHome", () => {
  const input = "@~/.claude/get-shit-done/workflows/plan-phase.md";
  const result = resolver.rewritePaths(input);
  assert.strictEqual(result, `@${gsdHome}/workflows/plan-phase.md`,
    `Expected @${gsdHome}/workflows/plan-phase.md, got ${result}`);
});

// UNIT-02
testSync("replaces $HOME/.claude/get-shit-done/ with actual gsdHome", () => {
  const input = 'node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init';
  const result = resolver.rewritePaths(input);
  assert.strictEqual(result, `node "${gsdHome}/bin/gsd-tools.cjs" init`,
    `Expected gsdHome path, got ${result}`);
});

// UNIT-03
testSync("replaces ~/.claude/get-shit-done/ with actual gsdHome", () => {
  const input = "See ~/.claude/get-shit-done/references/checkpoints.md";
  const result = resolver.rewritePaths(input);
  assert.strictEqual(result, `See ${gsdHome}/references/checkpoints.md`,
    `Expected gsdHome path, got ${result}`);
});

// UNIT-04
testSync("replaces $GSD_HOME/ with actual gsdHome", () => {
  const input = 'node "$GSD_HOME/bin/gsd-tools.cjs" state load';
  const result = resolver.rewritePaths(input);
  assert.strictEqual(result, `node "${gsdHome}/bin/gsd-tools.cjs" state load`,
    `Expected gsdHome path, got ${result}`);
});

// =========================================================================
console.log("\nrewritePaths — multi-pattern and edge cases:\n");
// =========================================================================

// UNIT-05
testSync("handles multiple patterns in same content", () => {
  const input = [
    "@~/.claude/get-shit-done/workflows/plan-phase.md",
    "@~/.claude/get-shit-done/references/ui-brand.md",
    'INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init)',
    'node "$GSD_HOME/bin/gsd-tools.cjs" state load',
  ].join("\n");
  const result = resolver.rewritePaths(input);
  assert.ok(!result.includes(".claude/get-shit-done"),
    `Should not contain .claude/get-shit-done, but found it in: ${result}`);
  // Count occurrences of gsdHome
  const count = (result.match(new RegExp(gsdHome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  assert.ok(count >= 4, `Expected at least 4 occurrences of gsdHome, found ${count}`);
});

// UNIT-06
testSync("does not modify unrelated paths", () => {
  const input = "Read ~/.config/settings.json and $HOME/projects/foo";
  const result = resolver.rewritePaths(input);
  assert.strictEqual(result, input,
    `Unrelated paths should not be modified, got: ${result}`);
});

testSync("does not modify @~/documents/ path", () => {
  const input = "@~/documents/readme.md";
  const result = resolver.rewritePaths(input);
  assert.strictEqual(result, input,
    `@~/documents/ should not be rewritten, got: ${result}`);
});

testSync("does not modify $HOME/.claude/other-tool/ path", () => {
  const input = "$HOME/.claude/other-tool/config.json";
  const result = resolver.rewritePaths(input);
  assert.strictEqual(result, input,
    `$HOME/.claude/other-tool/ should not be rewritten, got: ${result}`);
});

// UNIT-07
testSync("handles empty string input", () => {
  const result = resolver.rewritePaths("");
  assert.strictEqual(result, "", "Empty string should return empty string");
});

// =========================================================================
console.log("\nrewritePaths — realistic content:\n");
// =========================================================================

testSync("rewrites paths in realistic GSD command template", () => {
  const input = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Read @~/.claude/get-shit-done/workflows/plan-phase.md
✓ Load $HOME/.claude/get-shit-done/references/ui-brand.md
║ Use ~/.claude/get-shit-done/templates/summary.md
⚠ Run: node "$GSD_HOME/bin/gsd-tools.cjs" init`;

  const result = resolver.rewritePaths(input);
  assert.ok(!result.includes(".claude/get-shit-done"),
    `Should not contain .claude/get-shit-done after rewrite`);
  assert.ok(!result.includes("$GSD_HOME/"),
    `Should not contain $GSD_HOME/ after rewrite`);
  // Verify Unicode preserved
  assert.ok(result.includes("━"), "Should preserve ━ character");
  assert.ok(result.includes("✓"), "Should preserve ✓ character");
  assert.ok(result.includes("║"), "Should preserve ║ character");
  assert.ok(result.includes("◆"), "Should preserve ◆ character");
  assert.ok(result.includes("⚠"), "Should preserve ⚠ character");
});

testSync("preserves @-prefix on pattern 1 specifically", () => {
  const input1 = "@~/.claude/get-shit-done/file.md";
  const input2 = "~/.claude/get-shit-done/file.md";
  const result1 = resolver.rewritePaths(input1);
  const result2 = resolver.rewritePaths(input2);
  assert.ok(result1.startsWith("@"), `Pattern 1 should preserve @, got: ${result1}`);
  assert.ok(!result2.startsWith("@"), `Pattern 3 should not have @, got: ${result2}`);
  assert.strictEqual(result1, `@${gsdHome}/file.md`);
  assert.strictEqual(result2, `${gsdHome}/file.md`);
});

// Restore env
restoreEnv(envSnap);

// =========================================================================
// Summary
// =========================================================================
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
