/**
 * Unit tests for GsdPathResolver.transform() pipeline and parseCommand() frontmatter parsing
 * Tests full pipeline ordering and YAML frontmatter extraction.
 * Requirements: UNIT-14 through UNIT-18
 *
 * Run: npx tsx tests/unit-frontmatter.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
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

// --- Duplicated parseCommand (not exported from commands.ts) ---
interface CommandMeta {
  name: string;
  description: string;
  argumentHint: string;
  body: string;
}

function parseCommand(content: string): CommandMeta {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { name: "", description: "", argumentHint: "", body: content };
  }

  const fm = fmMatch[1];
  const body = fmMatch[2];

  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);
  const argHintMatch = fm.match(/^argument-hint:\s*(.+)$/m);

  return {
    name: nameMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "",
    description: descMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "",
    argumentHint: argHintMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "",
    body,
  };
}

const envSnap = saveEnv();
const resolver = new GsdPathResolver();
const gsdHome = resolver.gsdHome;

// =========================================================================
console.log("\ntransform — full pipeline:\n");
// =========================================================================

// UNIT-14
testSync("applies rewrite → context → arguments in correct order", () => {
  const input = `<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
</execution_context>

Phase number: $ARGUMENTS

Run from ~/.claude/get-shit-done/workflows/plan-phase.md`;

  const result = resolver.transform(input, "3 --auto");

  // Path rewriting happened
  assert.ok(!result.includes(".claude/get-shit-done"),
    `Should not contain .claude/get-shit-done, got: ${result}`);
  // Execution context transformed
  assert.ok(result.includes("IMPORTANT: Read each of these files"),
    "Should contain Read tool instruction");
  assert.ok(result.includes(`- ${gsdHome}/workflows/plan-phase.md`),
    "Should contain resolved path as bullet item");
  // Arguments injected
  assert.ok(!result.includes("$ARGUMENTS"),
    "Should not contain $ARGUMENTS");
  assert.ok(result.includes("Phase number: 3 --auto"),
    "Should contain injected arguments");
});

// UNIT-15
testSync("content with all pattern types produces fully resolved output", () => {
  const input = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PLANNING PHASE $ARGUMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

✓ Pattern 1: @~/.claude/get-shit-done/workflows/test.md
✓ Pattern 2: $HOME/.claude/get-shit-done/bin/gsd-tools.cjs
✓ Pattern 3: ~/.claude/get-shit-done/references/ref.md
✓ Pattern 4: $GSD_HOME/templates/summary.md
╔══════════════════════════════════════╗
║  Phase: $ARGUMENTS                    ║
╚══════════════════════════════════════╝`;

  const result = resolver.transform(input, "2");

  // No old paths remain
  assert.ok(!result.includes(".claude/get-shit-done"),
    "Should not contain .claude/get-shit-done anywhere");
  assert.ok(!result.includes("$GSD_HOME/"),
    "Should not contain $GSD_HOME/");
  assert.ok(!result.includes("$ARGUMENTS"),
    "Should not contain $ARGUMENTS");
  // Execution context transformed
  assert.ok(result.includes("IMPORTANT: Read each of these files"),
    "Should contain Read tool instruction");
  // Arguments injected
  assert.ok(result.includes("PLANNING PHASE 2"),
    "Should have phase number in banner");
  assert.ok(result.includes("Phase: 2"),
    "Should have phase number in box");
  // Unicode preserved
  assert.ok(result.includes("━"), "Should preserve ━");
  assert.ok(result.includes("✓"), "Should preserve ✓");
  assert.ok(result.includes("╔"), "Should preserve ╔");
  assert.ok(result.includes("║"), "Should preserve ║");
  assert.ok(result.includes("╚"), "Should preserve ╚");
  assert.ok(result.includes("╗"), "Should preserve ╗");
});

testSync("pipeline order: @-include paths are resolved before transformation", () => {
  const input = `<execution_context>
@~/.claude/get-shit-done/workflows/test.md
</execution_context>`;

  const result = resolver.transform(input, "");

  // The bullet list should have the resolved gsdHome path, NOT the old path
  assert.ok(result.includes(`- ${gsdHome}/workflows/test.md`),
    `Bullet should contain resolved path ${gsdHome}/workflows/test.md`);
  assert.ok(!result.includes("- ~/.claude/get-shit-done/"),
    "Bullet should NOT contain old path");
});

// =========================================================================
console.log("\nparseCommand — frontmatter extraction:\n");
// =========================================================================

// UNIT-16
testSync("extracts name, description, and argumentHint from valid YAML", () => {
  const input = `---
name: gsd:plan-phase
description: Create executable phase plans
argument-hint: "<phase-number>"
allowed-tools: Read, Write
---

<objective>Plan the phase</objective>`;

  const result = parseCommand(input);
  assert.strictEqual(result.name, "gsd:plan-phase",
    `Expected name 'gsd:plan-phase', got '${result.name}'`);
  assert.strictEqual(result.description, "Create executable phase plans",
    `Expected correct description, got '${result.description}'`);
  assert.strictEqual(result.argumentHint, "<phase-number>",
    `Expected argumentHint '<phase-number>', got '${result.argumentHint}'`);
  assert.ok(result.body.includes("<objective>Plan the phase</objective>"),
    `Body should contain objective, got: '${result.body}'`);
  assert.ok(!result.body.includes("---"),
    "Body should not contain frontmatter delimiters");
});

// UNIT-17
testSync("returns empty values for missing fields (does not throw)", () => {
  const input = `---
name: gsd:minimal
---

Some body content`;

  const result = parseCommand(input);
  assert.strictEqual(result.name, "gsd:minimal",
    `Expected name 'gsd:minimal', got '${result.name}'`);
  assert.strictEqual(result.description, "",
    `Expected empty description, got '${result.description}'`);
  assert.strictEqual(result.argumentHint, "",
    `Expected empty argumentHint, got '${result.argumentHint}'`);
  assert.ok(result.body.includes("Some body content"),
    `Body should contain content, got: '${result.body}'`);
});

testSync("handles quoted field values", () => {
  const input = `---
name: "gsd:quoted"
description: 'single quoted value'
---

Body`;

  const result = parseCommand(input);
  assert.strictEqual(result.name, "gsd:quoted",
    `Should strip double quotes, got '${result.name}'`);
  assert.strictEqual(result.description, "single quoted value",
    `Should strip single quotes, got '${result.description}'`);
});

// UNIT-18
testSync("returns full content as body when no frontmatter present", () => {
  const input = "<objective>\nJust some content with no frontmatter\n</objective>";
  const result = parseCommand(input);
  assert.strictEqual(result.name, "",
    `Expected empty name, got '${result.name}'`);
  assert.strictEqual(result.description, "",
    `Expected empty description, got '${result.description}'`);
  assert.strictEqual(result.argumentHint, "",
    `Expected empty argumentHint, got '${result.argumentHint}'`);
  assert.strictEqual(result.body, input,
    `Body should equal full input when no frontmatter`);
});

testSync("validates against real command file (help.md)", () => {
  const helpPath = path.join(resolver.packageRoot, "commands", "gsd", "help.md");
  const content = fs.readFileSync(helpPath, "utf8");
  const result = parseCommand(content);
  assert.strictEqual(result.name, "gsd:help",
    `Expected name 'gsd:help', got '${result.name}'`);
  assert.ok(result.description.length > 0,
    `Description should be non-empty, got '${result.description}'`);
  assert.ok(result.body.length > 0,
    `Body should be non-empty`);
  assert.ok(result.body.includes("<objective>"),
    `Body should contain <objective> tag`);
});

// Restore env
restoreEnv(envSnap);

// =========================================================================
// Summary
// =========================================================================
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
