/**
 * Wiring tests: template path resolution
 * Tests: TMPL-01, TMPL-02, TMPL-03
 *
 * Validates prompt templates have no residual upstream paths after
 * GsdPathResolver.rewritePaths() and @ file references point to
 * plausible .planning/ directory paths.
 *
 * Run: npx tsx tests/wiring-templates.test.ts
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

// Save env before constructing resolver (constructor sets process.env.GSD_HOME)
const envSnap = saveEnv();
const resolver = new GsdPathResolver();

const TEMPLATE_DIR = path.join(resolver.packageRoot, "gsd", "templates");

// Residual path patterns to check for
const RESIDUAL_PATTERNS = [
  /\.claude\/get-shit-done/,
  /\$GSD_HOME\//,
];

// Plausible .planning/ path prefixes
const VALID_PLANNING_ROOTS = [
  ".planning/STATE.md",
  ".planning/ROADMAP.md",
  ".planning/REQUIREMENTS.md",
  ".planning/phases/",
  ".planning/research/",
  ".planning/codebase/",
  ".planning/debug/",
  ".planning/config.json",
];

function isPlausiblePlanningPath(ref: string): boolean {
  // Strip {placeholder} tokens for validation
  const cleaned = ref.replace(/\{[^}]+\}/g, "_placeholder_");
  return VALID_PLANNING_ROOTS.some((prefix) => cleaned.startsWith(prefix));
}

/**
 * Scan content for residual upstream paths.
 * Returns array of { line, lineNum, pattern } for all occurrences.
 */
function findResidualPaths(content: string): { line: string; lineNum: number; pattern: string }[] {
  const lines = content.split("\n");
  const occurrences: { line: string; lineNum: number; pattern: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (const pat of RESIDUAL_PATTERNS) {
      if (pat.test(lines[i])) {
        occurrences.push({
          line: lines[i].trim(),
          lineNum: i + 1,
          pattern: pat.source,
        });
      }
    }
  }
  return occurrences;
}

/**
 * Extract @ file references from content.
 * Returns references that start with .planning/
 */
function extractAtReferences(content: string): string[] {
  const refs: string[] = [];
  const pattern = /@([^\s@]+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const ref = match[1];
    // Only validate .planning/ references — skip $GSD_HOME, execution context, etc.
    if (ref.startsWith(".planning/")) {
      refs.push(ref);
    }
  }
  return refs;
}

// =========================================================================
console.log("\nTemplate existence check:\n");
// =========================================================================

const expectedTemplates = ["planner-subagent-prompt.md", "debug-subagent-prompt.md"];
const subagentTemplates = fs
  .readdirSync(TEMPLATE_DIR)
  .filter((f: string) => f.includes("subagent") && f.endsWith(".md"));

testSync("[TMPL-03] expected subagent templates exist", () => {
  for (const expected of expectedTemplates) {
    assert.ok(
      subagentTemplates.includes(expected),
      `FILE: tests/wiring-templates.test.ts → template-existence\n` +
        `  EXPECTED: ${expected} exists in ${TEMPLATE_DIR}\n` +
        `  ACTUAL: Not found. Available: ${subagentTemplates.join(", ") || "(none)"}\n` +
        `  WHY: Missing template means subagent prompts cannot be constructed.\n` +
        `  EVIDENCE: Directory listing: ${subagentTemplates.join(", ")}`
    );
  }
});

// =========================================================================
console.log("\nResidual upstream path scan (TMPL-01):\n");
// =========================================================================

testSync("[TMPL-01] planner-subagent-prompt.md has no residual upstream paths after rewrite", () => {
  const templatePath = path.join(TEMPLATE_DIR, "planner-subagent-prompt.md");
  const content = fs.readFileSync(templatePath, "utf-8");
  const rewritten = resolver.rewritePaths(content);
  const residuals = findResidualPaths(rewritten);

  assert.strictEqual(
    residuals.length,
    0,
    `FILE: tests/wiring-templates.test.ts → residual-paths [planner-subagent-prompt.md]\n` +
      `  EXPECTED: Zero residual upstream paths after GsdPathResolver.rewritePaths()\n` +
      `  ACTUAL: Found ${residuals.length} residual path(s)\n` +
      `  WHY: Residual upstream paths cause templates to reference non-existent\n` +
      `       directories when running under pi-gsd.\n` +
      `  EVIDENCE:\n    ${residuals.map((r) => `Line ${r.lineNum} [${r.pattern}]: ${r.line}`).join("\n    ")}`
  );
});

// =========================================================================
console.log("\nResidual upstream path scan (TMPL-02):\n");
// =========================================================================

testSync("[TMPL-02] debug-subagent-prompt.md has no residual upstream paths after rewrite", () => {
  const templatePath = path.join(TEMPLATE_DIR, "debug-subagent-prompt.md");
  const content = fs.readFileSync(templatePath, "utf-8");
  const rewritten = resolver.rewritePaths(content);
  const residuals = findResidualPaths(rewritten);

  assert.strictEqual(
    residuals.length,
    0,
    `FILE: tests/wiring-templates.test.ts → residual-paths [debug-subagent-prompt.md]\n` +
      `  EXPECTED: Zero residual upstream paths after GsdPathResolver.rewritePaths()\n` +
      `  ACTUAL: Found ${residuals.length} residual path(s)\n` +
      `  WHY: Residual upstream paths cause templates to reference non-existent\n` +
      `       directories when running under pi-gsd.\n` +
      `  EVIDENCE:\n    ${residuals.map((r) => `Line ${r.lineNum} [${r.pattern}]: ${r.line}`).join("\n    ")}`
  );
});

// =========================================================================
console.log("\n@ reference plausibility (TMPL-03):\n");
// =========================================================================

for (const templateFile of expectedTemplates) {
  const templateName = templateFile.replace(".md", "");

  testSync(`[TMPL-03] ${templateName} @ references point to plausible .planning/ paths`, () => {
    const templatePath = path.join(TEMPLATE_DIR, templateFile);
    const content = fs.readFileSync(templatePath, "utf-8");
    const refs = extractAtReferences(content);

    if (refs.length === 0) {
      // No .planning/ @ references — that's fine for some templates
      return;
    }

    const implausible = refs.filter((ref) => !isPlausiblePlanningPath(ref));

    assert.strictEqual(
      implausible.length,
      0,
      `FILE: tests/wiring-templates.test.ts → plausible-refs [${templateName}]\n` +
        `  EXPECTED: All @ references starting with .planning/ point to recognized subdirectories\n` +
        `  ACTUAL: Found ${implausible.length} implausible reference(s)\n` +
        `  WHY: @ references that don't match known .planning/ structure will fail to resolve.\n` +
        `  EVIDENCE: Implausible refs: ${implausible.join(", ")}\n` +
        `            Valid prefixes: ${VALID_PLANNING_ROOTS.join(", ")}`
    );
  });
}

// Restore env
restoreEnv(envSnap);

// =========================================================================
// Summary
// =========================================================================
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
