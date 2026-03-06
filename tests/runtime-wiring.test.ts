/**
 * Runtime Wiring Tests — validates extension discovery, event subscriptions,
 * and command registration against the real Pi extension contract.
 *
 * These are deterministic, mock-based tests that verify the extension wires
 * up correctly. They extend existing compliance/integration patterns.
 *
 * Tests: WIRE-01 through WIRE-08
 *
 * Run: npx tsx tests/runtime-wiring.test.ts
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

// --- Setup ---
const envSnap = saveEnv();
const api = new MockExtensionAPI();
extensionFactory(api as any);

const projectRoot = path.resolve(__dirname, "..");

// =========================================================================
console.log("\nPackage manifest contract:\n");
// =========================================================================

// WIRE-01
testSync("WIRE-01: package.json has name 'pi-gsd'", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
  assert.strictEqual(pkg.name, "pi-gsd",
    `Expected package name 'pi-gsd', got '${pkg.name}'`);
});

// WIRE-02
testSync("WIRE-02: package.json pi.extensions includes extension entry point", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
  assert.ok(pkg.pi, "Missing 'pi' field in package.json");
  assert.ok(Array.isArray(pkg.pi.extensions), "Missing 'pi.extensions' array");
  assert.ok(pkg.pi.extensions.length > 0, "pi.extensions is empty");

  // Verify each entry resolves to an existing file/directory
  for (const ext of pkg.pi.extensions) {
    const resolved = path.resolve(projectRoot, ext);
    assert.ok(fs.existsSync(resolved),
      `Extension entry '${ext}' does not resolve to existing path: ${resolved}`);
  }
});

// WIRE-03
testSync("WIRE-03: package.json pi.agents includes agents directory", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf-8"));
  assert.ok(pkg.pi, "Missing 'pi' field in package.json");
  assert.ok(Array.isArray(pkg.pi.agents), "Missing 'pi.agents' array");
  assert.ok(pkg.pi.agents.length > 0, "pi.agents is empty");

  // Verify agents directory exists and contains agent .md files
  for (const agentDir of pkg.pi.agents) {
    const resolved = path.resolve(projectRoot, agentDir);
    assert.ok(fs.existsSync(resolved),
      `Agents directory '${agentDir}' does not exist: ${resolved}`);
    const agentFiles = fs.readdirSync(resolved).filter(f => f.endsWith(".md"));
    assert.ok(agentFiles.length > 0,
      `Agents directory '${agentDir}' contains no .md files`);
  }
});

// =========================================================================
console.log("\nEvent subscriptions:\n");
// =========================================================================

// WIRE-04
testSync("WIRE-04: subscribes to before_agent_start event", () => {
  assert.ok(api.subscriptions.has("before_agent_start"),
    "Extension must subscribe to 'before_agent_start' for system prompt injection");
  const handlers = api.subscriptions.get("before_agent_start")!;
  assert.ok(handlers.length > 0, "No handlers registered for before_agent_start");
});

// WIRE-05
testSync("WIRE-05: subscribes to tool_call event", () => {
  assert.ok(api.subscriptions.has("tool_call"),
    "Extension must subscribe to 'tool_call' for GSD_HOME rewriting");
  const handlers = api.subscriptions.get("tool_call")!;
  assert.ok(handlers.length > 0, "No handlers registered for tool_call");
});

// WIRE-06
testSync("WIRE-06: subscribes to session_start event", () => {
  assert.ok(api.subscriptions.has("session_start"),
    "Extension must subscribe to 'session_start' for status indicator");
  const handlers = api.subscriptions.get("session_start")!;
  assert.ok(handlers.length > 0, "No handlers registered for session_start");
});

// =========================================================================
console.log("\nCommand registration:\n");
// =========================================================================

// WIRE-07
testSync("WIRE-07: registers bare /gsd command", () => {
  assert.ok(api.commands.has("gsd"),
    "Extension must register bare 'gsd' command (alias for /gsd:help)");
});

// WIRE-08
testSync("WIRE-08: registers /gsd:* commands matching commands directory", () => {
  const commandsDir = path.join(projectRoot, "commands", "gsd");
  assert.ok(fs.existsSync(commandsDir), `Commands directory not found: ${commandsDir}`);

  const expectedFiles = fs.readdirSync(commandsDir)
    .filter(f => f.endsWith(".md") && !f.endsWith(".bak"));
  const expectedCommands = expectedFiles.map(f => "gsd:" + f.replace(".md", ""));

  // Verify all expected commands are registered
  const missing: string[] = [];
  for (const cmd of expectedCommands) {
    if (!api.commands.has(cmd)) {
      missing.push(cmd);
    }
  }
  assert.strictEqual(missing.length, 0,
    `Missing commands: ${missing.join(", ")}. ` +
    `Expected ${expectedCommands.length} /gsd:* commands, ` +
    `found ${[...api.commands.keys()].filter(k => k.startsWith("gsd:")).length}`);

  // Verify command count matches (no extra commands beyond expected + bare /gsd)
  const registeredGsd = [...api.commands.keys()].filter(k => k.startsWith("gsd:"));
  assert.strictEqual(registeredGsd.length, expectedCommands.length,
    `Command count mismatch: ${registeredGsd.length} registered vs ${expectedCommands.length} expected`);
});

// --- Cleanup ---
restoreEnv(envSnap);

// --- Results ---
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
