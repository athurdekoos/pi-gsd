/**
 * Wiring tests: model profile coverage and resolution
 * Tests: MODL-01, MODL-02, MODL-03
 *
 * Validates bidirectional coverage between MODEL_PROFILES and agent files,
 * plus resolveModelInternal returns valid models for all 33 combinations.
 *
 * Run: npx tsx tests/wiring-models.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { withTempDir } from "./harness/lifecycle.js";

const require = createRequire(import.meta.url);
const { MODEL_PROFILES, resolveModelInternal } = require("../gsd/bin/lib/core.cjs");

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

// Discover all agent files dynamically
const agentFiles = fs
  .readdirSync(AGENTS_DIR)
  .filter((f: string) => f.startsWith("gsd-") && f.endsWith(".md"))
  .sort();

const agentNames = agentFiles.map((f: string) => f.replace(".md", ""));
const profileKeys = Object.keys(MODEL_PROFILES);
const PROFILES = ["quality", "balanced", "budget"] as const;

// =========================================================================
console.log("\nMODEL_PROFILES → agent file coverage (MODL-01):\n");
// =========================================================================

testSync("[MODL-01] MODEL_PROFILES has exactly 11 entries", () => {
  assert.strictEqual(
    profileKeys.length,
    11,
    `FILE: tests/wiring-models.test.ts → profile-count\n` +
      `  EXPECTED: MODEL_PROFILES has exactly 11 entries\n` +
      `  ACTUAL: Found ${profileKeys.length} entries\n` +
      `  WHY: Mismatch indicates ghost or missing agent profiles.\n` +
      `  EVIDENCE: Keys: ${profileKeys.join(", ")}`
  );
});

for (const key of profileKeys) {
  testSync(`[MODL-01] ${key} has corresponding agent file`, () => {
    const agentPath = path.join(AGENTS_DIR, `${key}.md`);
    assert.ok(
      fs.existsSync(agentPath),
      `FILE: tests/wiring-models.test.ts → profile-to-file [${key}]\n` +
        `  EXPECTED: agents/${key}.md exists on disk\n` +
        `  ACTUAL: File not found\n` +
        `  WHY: Ghost profile — MODEL_PROFILES has entry for removed agent.\n` +
        `       resolveModelInternal will return a model but the agent can't be dispatched.\n` +
        `  EVIDENCE: MODEL_PROFILES[${key}] = ${JSON.stringify(MODEL_PROFILES[key])}`
    );
  });
}

// =========================================================================
console.log("\nAgent file → MODEL_PROFILES coverage (MODL-02):\n");
// =========================================================================

for (const agentName of agentNames) {
  testSync(`[MODL-02] ${agentName} has MODEL_PROFILES entry`, () => {
    assert.ok(
      MODEL_PROFILES[agentName] !== undefined,
      `FILE: tests/wiring-models.test.ts → file-to-profile [${agentName}]\n` +
        `  EXPECTED: MODEL_PROFILES["${agentName}"] exists\n` +
        `  ACTUAL: No entry found in MODEL_PROFILES\n` +
        `  WHY: Orphaned agent — file exists but no model profile defined.\n` +
        `       resolveModelInternal will fall back to 'sonnet' default.\n` +
        `  EVIDENCE: Available profile keys: ${profileKeys.join(", ")}`
    );
  });
}

// =========================================================================
console.log("\nModel resolution for all 33 combinations (MODL-03):\n");
// =========================================================================

async function runModl03() {
  for (const profile of PROFILES) {
    for (const agentName of agentNames) {
      await testAsync(
        `[MODL-03] ${agentName} × ${profile} resolves to valid model`,
        async () => {
          await withTempDir((tmpDir: string) => {
            // Write minimal config.json with this profile
            fs.writeFileSync(
              path.join(tmpDir, ".planning", "config.json"),
              JSON.stringify({ model_profile: profile }),
              "utf-8"
            );

            const result = resolveModelInternal(tmpDir, agentName);

            assert.ok(
              result && typeof result === "string" && result.length > 0,
              `FILE: tests/wiring-models.test.ts → model-resolution [${agentName} × ${profile}]\n` +
                `  EXPECTED: Non-empty string model name\n` +
                `  ACTUAL: ${JSON.stringify(result)}\n` +
                `  WHY: resolveModelInternal must return a valid model for Pi subagent dispatch.\n` +
                `  EVIDENCE: profile=${profile}, agent=${agentName}, MODEL_PROFILES[${agentName}] = ${JSON.stringify(MODEL_PROFILES[agentName])}`
            );
          });
        }
      );
    }
  }
}

// Run async tests then print summary
runModl03().then(() => {
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
});
