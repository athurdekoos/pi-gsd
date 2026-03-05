/**
 * Unit tests for GsdPathResolver.transformExecutionContext() and injectArguments()
 * Tests @-include conversion and $ARGUMENTS replacement.
 * Requirements: UNIT-08 through UNIT-13
 *
 * Run: npx tsx tests/unit-exec-context.test.ts
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

const envSnap = saveEnv();
const resolver = new GsdPathResolver();

// =========================================================================
console.log("\ntransformExecutionContext — @-include conversion:\n");
// =========================================================================

// UNIT-08
testSync("converts @path lines to Read these files bullet list", () => {
  const input = `<execution_context>
@/path/to/workflow.md
@/path/to/reference.md
</execution_context>`;

  const result = resolver.transformExecutionContext(input);
  assert.ok(result.includes("IMPORTANT: Read each of these files using the Read tool before proceeding:"),
    "Should contain IMPORTANT read instruction");
  assert.ok(result.includes("- /path/to/workflow.md"),
    "Should contain workflow.md as bullet item");
  assert.ok(result.includes("- /path/to/reference.md"),
    "Should contain reference.md as bullet item");
  assert.ok(!result.includes("@/path"),
    "Should not contain @-prefixed paths");
  assert.ok(result.includes("<execution_context>"),
    "Should be wrapped in execution_context tags");
  assert.ok(result.includes("</execution_context>"),
    "Should have closing execution_context tag");
});

// UNIT-09
testSync("preserves non-@ content in execution_context blocks", () => {
  const input = `<execution_context>
@/path/to/file.md
Some other instructions here
More text to preserve
</execution_context>`;

  const result = resolver.transformExecutionContext(input);
  assert.ok(result.includes("- /path/to/file.md"),
    "Should convert @path to bullet item");
  assert.ok(result.includes("Some other instructions here"),
    "Should preserve first non-@ line");
  assert.ok(result.includes("More text to preserve"),
    "Should preserve second non-@ line");
});

// UNIT-10
testSync("passes through blocks with no @-includes unchanged", () => {
  const input = `<execution_context>
Just some text, no includes
Another line without @
</execution_context>`;

  const result = resolver.transformExecutionContext(input);
  assert.ok(!result.includes("IMPORTANT"),
    "Should not contain IMPORTANT when no @-includes");
  assert.ok(result.includes("Just some text, no includes"),
    "Should preserve original text");
  assert.ok(result.includes("<execution_context>"),
    "Should keep execution_context tags");
});

// UNIT-11
testSync("handles multiple execution_context blocks in same content", () => {
  const input = `<execution_context>
@/path/a.md
</execution_context>
Some text between blocks
<execution_context>
@/path/b.md
</execution_context>`;

  const result = resolver.transformExecutionContext(input);
  assert.ok(result.includes("- /path/a.md"),
    "Should convert first block's @-include");
  assert.ok(result.includes("- /path/b.md"),
    "Should convert second block's @-include");
  assert.ok(result.includes("Some text between blocks"),
    "Should preserve text between blocks");
  // Count execution_context tags — should have 2 opening and 2 closing
  const openTags = (result.match(/<execution_context>/g) || []).length;
  const closeTags = (result.match(/<\/execution_context>/g) || []).length;
  assert.strictEqual(openTags, 2, `Should have 2 opening tags, found ${openTags}`);
  assert.strictEqual(closeTags, 2, `Should have 2 closing tags, found ${closeTags}`);
});

// =========================================================================
console.log("\ntransformExecutionContext — edge cases:\n");
// =========================================================================

testSync("handles empty execution_context block", () => {
  const input = `<execution_context>
</execution_context>`;

  const result = resolver.transformExecutionContext(input);
  assert.ok(!result.includes("IMPORTANT"),
    "Empty block should not produce IMPORTANT instruction");
});

testSync("handles single @-include", () => {
  const input = `<execution_context>
@/single/file.md
</execution_context>`;

  const result = resolver.transformExecutionContext(input);
  assert.ok(result.includes("- /single/file.md"),
    "Should produce single bullet item");
  assert.ok(result.includes("IMPORTANT"),
    "Should have IMPORTANT instruction for single include");
});

// =========================================================================
console.log("\ninjectArguments — $ARGUMENTS replacement:\n");
// =========================================================================

// UNIT-12
testSync("replaces all $ARGUMENTS occurrences with provided args", () => {
  const input = "Phase number: $ARGUMENTS\nExtra: $ARGUMENTS flag";
  const result = resolver.injectArguments(input, "3 --auto");
  assert.strictEqual(result, "Phase number: 3 --auto\nExtra: 3 --auto flag",
    `Expected all $ARGUMENTS replaced, got: ${result}`);
  assert.ok(!result.includes("$ARGUMENTS"),
    "Should not contain $ARGUMENTS after injection");
});

// UNIT-13
testSync("handles empty string args", () => {
  const input = "Phase: $ARGUMENTS";
  const result = resolver.injectArguments(input, "");
  assert.strictEqual(result, "Phase: ",
    `Expected empty replacement, got: ${result}`);
  assert.ok(!result.includes("$ARGUMENTS"),
    "Should not contain $ARGUMENTS after empty injection");
});

testSync("content with no $ARGUMENTS passes through unchanged", () => {
  const input = "No arguments placeholder here";
  const result = resolver.injectArguments(input, "ignored");
  assert.strictEqual(result, input,
    "Content without $ARGUMENTS should pass through unchanged");
});

testSync("handles args containing regex special characters", () => {
  const input = "Phase: $ARGUMENTS";
  const args = "some (value) with [brackets] and $pecial";
  const result = resolver.injectArguments(input, args);
  assert.ok(result.includes("some (value) with [brackets] and $pecial"),
    `Should contain args with special chars intact, got: ${result}`);
});

// Restore env
restoreEnv(envSnap);

// =========================================================================
// Summary
// =========================================================================
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
