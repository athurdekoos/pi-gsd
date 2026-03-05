/**
 * Unit tests for GsdPathResolver
 *
 * Run: npx tsx tests/path-resolver.test.ts
 * (or via the test runner)
 */

import * as assert from "node:assert";
import * as path from "node:path";

// We test the path rewriting logic directly without instantiating GsdPathResolver
// (which checks for filesystem existence). Instead we extract the pure functions.

const MOCK_GSD_HOME = "/home/user/.pi/agent/git/github.com/athurdekoos/pi-gsd/gsd";

/** Rewrite paths — extracted logic matching path-resolver.ts */
function rewritePaths(content: string, gsdHome: string): string {
  let result = content;
  result = result.replace(/@~\/\.claude\/get-shit-done\//g, `@${gsdHome}/`);
  result = result.replace(/\$HOME\/\.claude\/get-shit-done\//g, `${gsdHome}/`);
  result = result.replace(/~\/\.claude\/get-shit-done\//g, `${gsdHome}/`);
  result = result.replace(/\$GSD_HOME\//g, `${gsdHome}/`);
  return result;
}

/** Transform execution context — extracted logic */
function transformExecutionContext(content: string): string {
  return content.replace(
    /<execution_context>([\s\S]*?)<\/execution_context>/g,
    (_match, inner: string) => {
      const lines = inner.split("\n").map((line) => line.trim());
      const fileLines = lines.filter((line) => line.startsWith("@"));
      const nonFileLines = lines.filter((line) => line && !line.startsWith("@"));

      if (fileLines.length === 0) {
        return `<execution_context>${inner}</execution_context>`;
      }

      const filePaths = fileLines.map((line) => line.slice(1));
      const readInstructions = filePaths.map((f) => `- ${f}`).join("\n");

      let block =
        "<execution_context>\n" +
        "IMPORTANT: Read each of these files using the Read tool before proceeding:\n" +
        readInstructions;

      if (nonFileLines.length > 0) {
        block += "\n\n" + nonFileLines.join("\n");
      }

      block += "\n</execution_context>";
      return block;
    }
  );
}

// ─── Tests ───

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
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

console.log("path-resolver tests:\n");

// --- rewritePaths ---

test("rewrites @~/.claude/get-shit-done/ pattern", () => {
  const input = "@~/.claude/get-shit-done/workflows/plan-phase.md";
  const result = rewritePaths(input, MOCK_GSD_HOME);
  assert.strictEqual(result, `@${MOCK_GSD_HOME}/workflows/plan-phase.md`);
});

test("rewrites $HOME/.claude/get-shit-done/ pattern", () => {
  const input = 'node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init';
  const result = rewritePaths(input, MOCK_GSD_HOME);
  assert.strictEqual(result, `node "${MOCK_GSD_HOME}/bin/gsd-tools.cjs" init`);
});

test("rewrites ~/.claude/get-shit-done/ pattern", () => {
  const input = "See ~/.claude/get-shit-done/references/checkpoints.md";
  const result = rewritePaths(input, MOCK_GSD_HOME);
  assert.strictEqual(result, `See ${MOCK_GSD_HOME}/references/checkpoints.md`);
});

test("rewrites $GSD_HOME/ pattern (from pre-transformed agents)", () => {
  const input = 'node "$GSD_HOME/bin/gsd-tools.cjs" state load';
  const result = rewritePaths(input, MOCK_GSD_HOME);
  assert.strictEqual(result, `node "${MOCK_GSD_HOME}/bin/gsd-tools.cjs" state load`);
});

test("rewrites multiple patterns in same content", () => {
  const input = [
    "@~/.claude/get-shit-done/workflows/plan-phase.md",
    "@~/.claude/get-shit-done/references/ui-brand.md",
    'INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init)',
  ].join("\n");
  const result = rewritePaths(input, MOCK_GSD_HOME);
  assert.ok(!result.includes(".claude/get-shit-done"));
  assert.ok(result.includes(MOCK_GSD_HOME));
});

test("does not modify unrelated paths", () => {
  const input = "Read ~/.config/settings.json and $HOME/projects/foo";
  const result = rewritePaths(input, MOCK_GSD_HOME);
  assert.strictEqual(result, input);
});

test("handles empty string", () => {
  assert.strictEqual(rewritePaths("", MOCK_GSD_HOME), "");
});

// --- transformExecutionContext ---

test("transforms @-includes to read instructions", () => {
  const input = `<execution_context>
@/path/to/workflow.md
@/path/to/reference.md
</execution_context>`;

  const result = transformExecutionContext(input);
  assert.ok(result.includes("IMPORTANT: Read each of these files"));
  assert.ok(result.includes("- /path/to/workflow.md"));
  assert.ok(result.includes("- /path/to/reference.md"));
  assert.ok(!result.includes("@/path"));
});

test("preserves non-@-include content in execution_context", () => {
  const input = `<execution_context>
@/path/to/file.md
Some other instructions here
</execution_context>`;

  const result = transformExecutionContext(input);
  assert.ok(result.includes("- /path/to/file.md"));
  assert.ok(result.includes("Some other instructions here"));
});

test("passes through execution_context with no @-includes", () => {
  const input = `<execution_context>
Just some text, no includes
</execution_context>`;

  const result = transformExecutionContext(input);
  assert.ok(result.includes("Just some text, no includes"));
  assert.ok(!result.includes("IMPORTANT"));
});

test("handles multiple execution_context blocks", () => {
  const input = `<execution_context>
@/path/a.md
</execution_context>
Some text between
<execution_context>
@/path/b.md
</execution_context>`;

  const result = transformExecutionContext(input);
  assert.ok(result.includes("- /path/a.md"));
  assert.ok(result.includes("- /path/b.md"));
  assert.ok(result.includes("Some text between"));
});

// --- Argument injection ---

test("injects arguments into $ARGUMENTS placeholder", () => {
  const input = "Phase number: $ARGUMENTS (optional)";
  const result = input.replace(/\$ARGUMENTS/g, "3 --auto");
  assert.strictEqual(result, "Phase number: 3 --auto (optional)");
});

test("handles missing arguments (empty string)", () => {
  const input = "Phase: $ARGUMENTS";
  const result = input.replace(/\$ARGUMENTS/g, "");
  assert.strictEqual(result, "Phase: ");
});

// --- Full pipeline ---

test("full transform: rewrite → execution_context → arguments", () => {
  const input = `<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

Phase number: $ARGUMENTS

Execute from @~/.claude/get-shit-done/workflows/plan-phase.md`;

  let result = rewritePaths(input, MOCK_GSD_HOME);
  result = transformExecutionContext(result);
  result = result.replace(/\$ARGUMENTS/g, "3");

  assert.ok(!result.includes(".claude/get-shit-done"), "No old paths remaining");
  assert.ok(result.includes(`${MOCK_GSD_HOME}/workflows/plan-phase.md`));
  assert.ok(result.includes("IMPORTANT: Read each of these files"));
  assert.ok(result.includes("Phase number: 3"));
});

// --- Summary ---

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
