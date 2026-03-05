/**
 * Compliance tests: Pi Extension SDK contract and package manifest validation
 * Tests: CMPL-01 through CMPL-07
 *
 * Validates that pi-gsd uses the Pi extension SDK correctly — valid event
 * subscriptions, correct handler return shapes, proper package manifest,
 * and correct factory export pattern. Structural/contractual checks only;
 * behavioral correctness is covered by integration tests (Phase 3).
 *
 * Run: npx tsx tests/compliance.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import extensionFactory from "../extensions/gsd/index.js";
import { MockExtensionAPI } from "./harness/mock-api.js";
import { saveEnv, restoreEnv, withTempDir } from "./harness/lifecycle.js";
import { createMockContext } from "./harness/mock-context.js";

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

// --- Setup: load extension once ---
const envSnap = saveEnv();
const api = new MockExtensionAPI();
extensionFactory(api as any);

// Source: Pi SDK @mariozechner/pi-coding-agent types.d.ts — ExtensionAPI.on() overloads
// 28 valid events total
const VALID_PI_EVENTS = new Set([
  "resources_discover",
  "session_start",
  "session_before_switch",
  "session_switch",
  "session_before_fork",
  "session_fork",
  "session_before_compact",
  "session_compact",
  "session_shutdown",
  "session_before_tree",
  "session_tree",
  "context",
  "before_agent_start",
  "agent_start",
  "agent_end",
  "turn_start",
  "turn_end",
  "message_start",
  "message_update",
  "message_end",
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
  "model_select",
  "tool_call",
  "tool_result",
  "user_bash",
  "input",
]);

async function runTests() {
  // =========================================================================
  console.log("\nSDK contract compliance:\n");
  // =========================================================================

  // CMPL-01: Extension subscribes only to valid Pi event names
  testSync("CMPL-01: extension subscribes only to valid Pi SDK event names", () => {
    const subscribedEvents = [...api.subscriptions.keys()];
    assert.ok(subscribedEvents.length > 0, "Extension should subscribe to at least one event");
    for (const eventName of subscribedEvents) {
      assert.ok(
        VALID_PI_EVENTS.has(eventName),
        `Extension subscribed to invalid event "${eventName}". ` +
        `Valid events (${VALID_PI_EVENTS.size}): ${[...VALID_PI_EVENTS].join(", ")}`
      );
    }
  });

  // CMPL-02: before_agent_start returns object with systemPrompt key
  await testAsync("CMPL-02: before_agent_start returns {systemPrompt} shape", async () => {
    await withTempDir(async (dir) => {
      const ctx = createMockContext({ cwd: dir });
      const result = await api.fireEvent("before_agent_start", { systemPrompt: "base" }, ctx);
      assert.ok(result !== undefined, "before_agent_start should return a result (not undefined)");
      assert.ok(
        "systemPrompt" in result,
        `Result should have "systemPrompt" key. Got keys: ${Object.keys(result).join(", ")}`
      );
      assert.strictEqual(
        typeof result.systemPrompt,
        "string",
        `systemPrompt should be a string, got ${typeof result.systemPrompt}`
      );
    });
  });

  // CMPL-03: tool_call handler mutates event.input.command for bash commands referencing GSD
  await testAsync("CMPL-03: tool_call mutates event.input.command for GSD references", async () => {
    const event = {
      toolName: "bash",
      input: { command: "echo $GSD_HOME/bin/gsd-tools.cjs" },
    };
    const originalCommand = event.input.command;
    await api.fireEvent("tool_call", event);
    assert.notStrictEqual(
      event.input.command,
      originalCommand,
      "tool_call handler should mutate event.input.command when it references GSD_HOME"
    );
    assert.ok(
      event.input.command.includes("export GSD_HOME="),
      `Mutated command should contain "export GSD_HOME=". Got: ${event.input.command}`
    );
  });

  // CMPL-06: Extension entry file exports a default function (factory pattern)
  testSync("CMPL-06: extension entry exports a default function (factory)", () => {
    assert.strictEqual(
      typeof extensionFactory,
      "function",
      `Default export should be a function, got ${typeof extensionFactory}`
    );
    assert.ok(
      extensionFactory.length >= 1,
      `Factory should accept at least 1 argument (ExtensionAPI), got arity ${extensionFactory.length}`
    );
  });

  // CMPL-07: All registered event handlers are async functions
  testSync("CMPL-07: all event handlers are async functions", () => {
    assert.ok(api.subscriptions.size > 0, "Extension should have registered event handlers");
    for (const [eventName, handlers] of api.subscriptions) {
      for (let i = 0; i < handlers.length; i++) {
        assert.strictEqual(
          handlers[i].constructor.name,
          "AsyncFunction",
          `Handler ${i} for "${eventName}" should be AsyncFunction, got ${handlers[i].constructor.name}`
        );
      }
    }
  });

  // =========================================================================
  console.log("\nPackage manifest compliance:\n");
  // =========================================================================

  // CMPL-04: package.json pi.extensions entries point to existing files/directories
  testSync("CMPL-04: pi.extensions entries resolve to existing paths with entry points", () => {
    const pkgPath = path.resolve("package.json");
    assert.ok(fs.existsSync(pkgPath), `package.json not found at ${pkgPath}`);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

    assert.ok(pkg.pi, "package.json should have a 'pi' field");
    assert.ok(Array.isArray(pkg.pi.extensions), "pi.extensions should be an array");
    assert.ok(pkg.pi.extensions.length > 0, "pi.extensions should have at least one entry");

    for (const entry of pkg.pi.extensions) {
      const resolved = path.resolve(entry);
      assert.ok(
        fs.existsSync(resolved),
        `pi.extensions entry "${entry}" does not resolve to an existing path (tried: ${resolved})`
      );

      // If it's a directory, verify it has an entry point file
      if (fs.statSync(resolved).isDirectory()) {
        const hasEntry =
          fs.existsSync(path.join(resolved, "index.ts")) ||
          fs.existsSync(path.join(resolved, "index.js"));
        assert.ok(
          hasEntry,
          `Extension directory "${entry}" has no index.ts or index.js entry point`
        );
      }
    }
  });

  // CMPL-05: package.json pi.agents entries point to existing directories with .md files
  testSync("CMPL-05: pi.agents entries resolve to directories with agent .md files", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));

    assert.ok(pkg.pi, "package.json should have a 'pi' field");
    assert.ok(Array.isArray(pkg.pi.agents), "pi.agents should be an array");
    assert.ok(pkg.pi.agents.length > 0, "pi.agents should have at least one entry");

    for (const entry of pkg.pi.agents) {
      const resolved = path.resolve(entry);
      assert.ok(
        fs.existsSync(resolved),
        `pi.agents entry "${entry}" does not resolve to an existing path (tried: ${resolved})`
      );
      assert.ok(
        fs.statSync(resolved).isDirectory(),
        `pi.agents entry "${entry}" should be a directory, got file at ${resolved}`
      );

      const mdFiles = fs.readdirSync(resolved).filter((f) => f.endsWith(".md"));
      assert.ok(
        mdFiles.length > 0,
        `Agents directory "${entry}" contains no .md files. Found: ${fs.readdirSync(resolved).join(", ")}`
      );
    }
  });

  // --- Cleanup and summary ---
  restoreEnv(envSnap);

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  if (failed > 0) process.exit(1);
}

runTests();
