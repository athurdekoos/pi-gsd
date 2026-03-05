/**
 * Integration tests for extension loading and registration
 * Tests: factory execution, command count, event subscriptions, GSD_HOME, descriptions
 * Requirements: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05
 *
 * Run: npx tsx tests/intg-loading.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import extensionFactory from "../extensions/gsd/index.js";
import { MockExtensionAPI } from "./harness/mock-api.js";
import { saveEnv, restoreEnv } from "./harness/lifecycle.js";

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

// --- Setup: load extension once ---
const envSnap = saveEnv();
const api = new MockExtensionAPI();
extensionFactory(api as any);

// =========================================================================
console.log("\nExtension loading:\n");
// =========================================================================

// INTG-01
testSync("factory executes without throwing on valid mock API", () => {
  // We reached this point — factory was called above without error
  assert.ok(true, "Factory should not throw");
  assert.ok(api.commands.size > 0, `Expected commands > 0, got ${api.commands.size}`);
});

// INTG-04
testSync("sets process.env.GSD_HOME to a valid directory", () => {
  assert.ok(process.env.GSD_HOME, "GSD_HOME should be set");
  assert.ok(
    fs.existsSync(process.env.GSD_HOME!),
    `GSD_HOME should point to existing directory, got: ${process.env.GSD_HOME}`
  );
  assert.ok(
    process.env.GSD_HOME!.endsWith("/gsd") || process.env.GSD_HOME!.endsWith("\\gsd"),
    `GSD_HOME should end with /gsd, got: ${process.env.GSD_HOME}`
  );
});

// =========================================================================
console.log("\nCommand registration:\n");
// =========================================================================

// INTG-02
testSync("registers exactly 32 commands", () => {
  assert.strictEqual(
    api.commands.size,
    32,
    `Expected 32 commands, got ${api.commands.size}. Commands: ${[...api.commands.keys()].join(", ")}`
  );
});

testSync("registers bare /gsd command", () => {
  assert.ok(api.commands.has("gsd"), "Should have bare 'gsd' command");
});

testSync("registers all gsd: prefixed commands (31)", () => {
  const prefixedCount = [...api.commands.keys()].filter((k) => k.startsWith("gsd:")).length;
  assert.strictEqual(
    prefixedCount,
    31,
    `Expected 31 gsd: prefixed commands, got ${prefixedCount}`
  );
});

testSync("command names match .md file names", () => {
  const commandsDir = path.join(process.cwd(), "commands", "gsd");
  const mdFiles = fs
    .readdirSync(commandsDir)
    .filter((f) => f.endsWith(".md") && !f.endsWith(".bak"))
    .sort();

  for (const file of mdFiles) {
    const slug = file.replace(".md", "");
    const cmdName = `gsd:${slug}`;
    assert.ok(
      api.commands.has(cmdName),
      `Expected command '${cmdName}' for file '${file}', but not found. Registered: ${[...api.commands.keys()].join(", ")}`
    );
  }
});

// =========================================================================
console.log("\nEvent subscriptions:\n");
// =========================================================================

// INTG-03
testSync("subscribes to exactly 3 events", () => {
  assert.strictEqual(
    api.subscriptions.size,
    3,
    `Expected 3 events, got ${api.subscriptions.size}. Events: ${[...api.subscriptions.keys()].join(", ")}`
  );
});

testSync("subscribes to before_agent_start", () => {
  assert.ok(api.subscriptions.has("before_agent_start"), "Should subscribe to before_agent_start");
  assert.strictEqual(
    api.subscriptions.get("before_agent_start")!.length,
    1,
    "Should have exactly 1 before_agent_start handler"
  );
});

testSync("subscribes to tool_call", () => {
  assert.ok(api.subscriptions.has("tool_call"), "Should subscribe to tool_call");
});

testSync("subscribes to session_start", () => {
  assert.ok(api.subscriptions.has("session_start"), "Should subscribe to session_start");
});

// =========================================================================
console.log("\nCommand descriptions:\n");
// =========================================================================

// INTG-05
testSync("all registered commands have non-empty descriptions", () => {
  for (const [name, cmd] of api.commands) {
    assert.ok(
      typeof cmd.description === "string" && cmd.description.length > 0,
      `Command '${name}' has empty or missing description: ${JSON.stringify(cmd.description)}`
    );
  }
});

// --- Cleanup ---
restoreEnv(envSnap);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
