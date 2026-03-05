/**
 * Wiring tests: agent frontmatter validation
 * Tests: AGNT-01, AGNT-02, AGNT-03, AGNT-04
 *
 * Validates all 11 agent .md files have correct YAML frontmatter:
 * parseable by Pi SDK, required fields present, name matches filename,
 * tools contain only recognized Pi tool names.
 *
 * Run: npx tsx tests/wiring-agents.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
// Import parseFrontmatter from Pi SDK — use direct path to frontmatter module
// since the main entry has transitive dependencies not resolvable from this project.
// This is the same function Pi uses to parse agent frontmatter at runtime.
import { parseFrontmatter } from "/home/mia/.npm-global/lib/node_modules/@mariozechner/pi-coding-agent/dist/utils/frontmatter.js";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const AGENTS_DIR = path.join(PROJECT_ROOT, "agents");

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

// Canonical Pi tool names
const CANONICAL_TOOLS = new Set([
  "Read", "Write", "Edit", "Bash", "Grep", "Glob", "WebSearch", "WebFetch",
]);

function isValidTool(tool: string): boolean {
  return CANONICAL_TOOLS.has(tool) || tool.startsWith("mcp__");
}

/**
 * Parse the tools field from agent frontmatter.
 * Handles both string ("Read, Write, Bash") and array formats.
 */
function parseTools(tools: unknown): string[] {
  if (Array.isArray(tools)) {
    return tools.map((t: unknown) => String(t).trim()).filter(Boolean);
  }
  if (typeof tools === "string") {
    return tools.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return [];
}

// Discover all agent files dynamically
const agentFiles = fs
  .readdirSync(AGENTS_DIR)
  .filter((f) => f.startsWith("gsd-") && f.endsWith(".md"))
  .sort();

// =========================================================================
console.log("\nAgent frontmatter parsing (AGNT-01):\n");
// =========================================================================

for (const agentFile of agentFiles) {
  const agentName = agentFile.replace(".md", "");
  const agentPath = path.join(AGENTS_DIR, agentFile);

  testSync(`[AGNT-01] ${agentName} parses with Pi SDK parseFrontmatter`, () => {
    const content = fs.readFileSync(agentPath, "utf-8");
    let result: any;
    try {
      result = parseFrontmatter(content);
    } catch (err: any) {
      assert.fail(
        `FILE: tests/wiring-agents.test.ts → frontmatter-parse [${agentName}]\n` +
          `  EXPECTED: parseFrontmatter returns a valid object without throwing\n` +
          `  ACTUAL: Threw error: ${err.message}\n` +
          `  WHY: Pi SDK must be able to parse agent frontmatter for subagent dispatch.\n` +
          `  EVIDENCE: ${agentPath}`
      );
    }
    assert.ok(
      result && typeof result.frontmatter === "object",
      `FILE: tests/wiring-agents.test.ts → frontmatter-parse [${agentName}]\n` +
        `  EXPECTED: parseFrontmatter returns { frontmatter: object, body: string }\n` +
        `  ACTUAL: Got ${JSON.stringify(result)}\n` +
        `  WHY: Pi SDK must be able to parse agent frontmatter for subagent dispatch.\n` +
        `  EVIDENCE: ${agentPath}`
    );
  });
}

// =========================================================================
console.log("\nRequired fields present (AGNT-02):\n");
// =========================================================================

for (const agentFile of agentFiles) {
  const agentName = agentFile.replace(".md", "");
  const agentPath = path.join(AGENTS_DIR, agentFile);

  testSync(`[AGNT-02] ${agentName} has required name and description`, () => {
    const content = fs.readFileSync(agentPath, "utf-8");
    const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);

    assert.ok(
      typeof frontmatter.name === "string" && frontmatter.name.length > 0,
      `FILE: tests/wiring-agents.test.ts → required-fields [${agentName}]\n` +
        `  EXPECTED: frontmatter.name is a non-empty string\n` +
        `  ACTUAL: name = ${JSON.stringify(frontmatter.name)}\n` +
        `  WHY: Pi uses the name field to identify and dispatch agents.\n` +
        `  EVIDENCE: ${agentPath}`
    );

    assert.ok(
      typeof frontmatter.description === "string" && frontmatter.description.length > 0,
      `FILE: tests/wiring-agents.test.ts → required-fields [${agentName}]\n` +
        `  EXPECTED: frontmatter.description is a non-empty string\n` +
        `  ACTUAL: description = ${JSON.stringify(frontmatter.description)}\n` +
        `  WHY: Pi uses description for agent capability matching.\n` +
        `  EVIDENCE: ${agentPath}`
    );
  });
}

// =========================================================================
console.log("\nName matches filename (AGNT-03):\n");
// =========================================================================

for (const agentFile of agentFiles) {
  const agentName = agentFile.replace(".md", "");
  const agentPath = path.join(AGENTS_DIR, agentFile);

  testSync(`[AGNT-03] ${agentName} name matches filename`, () => {
    const content = fs.readFileSync(agentPath, "utf-8");
    const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);

    assert.strictEqual(
      frontmatter.name,
      agentName,
      `FILE: tests/wiring-agents.test.ts → name-matches-filename [${agentName}]\n` +
        `  EXPECTED: frontmatter.name === "${agentName}"\n` +
        `  ACTUAL: frontmatter.name === "${frontmatter.name}"\n` +
        `  WHY: Pi dispatches agents by filename — name field must match for\n` +
        `       subagent resolution to work correctly.\n` +
        `  EVIDENCE: File: ${agentFile}, name field: ${frontmatter.name}`
    );
  });
}

// =========================================================================
console.log("\nTools are recognized Pi tool names (AGNT-04):\n");
// =========================================================================

for (const agentFile of agentFiles) {
  const agentName = agentFile.replace(".md", "");
  const agentPath = path.join(AGENTS_DIR, agentFile);

  testSync(`[AGNT-04] ${agentName} tools are recognized Pi tool names`, () => {
    const content = fs.readFileSync(agentPath, "utf-8");
    const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);

    const tools = parseTools(frontmatter.tools);
    assert.ok(
      tools.length > 0,
      `FILE: tests/wiring-agents.test.ts → valid-tools [${agentName}]\n` +
        `  EXPECTED: At least one tool in tools field\n` +
        `  ACTUAL: tools is empty or missing\n` +
        `  WHY: Agents without tools cannot perform any actions.\n` +
        `  EVIDENCE: tools = ${JSON.stringify(frontmatter.tools)}`
    );

    const invalidTools = tools.filter((t) => !isValidTool(t));
    assert.strictEqual(
      invalidTools.length,
      0,
      `FILE: tests/wiring-agents.test.ts → valid-tools [${agentName}]\n` +
        `  EXPECTED: All tools are canonical Pi tools or mcp__-prefixed\n` +
        `  ACTUAL: Found ${invalidTools.length} unrecognized tool(s): ${invalidTools.join(", ")}\n` +
        `  WHY: Unrecognized tools will fail at Pi runtime — tool calls will be rejected.\n` +
        `  EVIDENCE: Canonical set: ${[...CANONICAL_TOOLS].join(", ")} | mcp__*`
    );
  });
}

// =========================================================================
// Summary
// =========================================================================
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
