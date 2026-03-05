/**
 * Self-test for MockExtensionAPI and MockContext
 * Validates recording, replay, and reset capabilities (HARN-01 through HARN-05)
 */

import assert from "node:assert";
import { MockExtensionAPI } from "./harness/mock-api.js";
import { createMockContext, createMockCommandContext } from "./harness/mock-context.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    return result
      .then(() => {
        passed++;
        console.log(`  ✓ ${name}`);
      })
      .catch((err: any) => {
        failed++;
        console.log(`  ✗ ${name}`);
        console.log(`    ${err.message}`);
      });
  }
  try {
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    // sync errors caught by outer try in the non-promise path
  }
  return Promise.resolve();
}

// Wrap sync tests
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

async function run() {
  // =========================================================================
  console.log("\nMockExtensionAPI — on() recording:\n");
  // =========================================================================

  testSync("records single event subscription", () => {
    const api = new MockExtensionAPI();
    const handler = async () => {};
    api.on("session_start", handler);
    const handlers = api.subscriptions.get("session_start");
    assert.ok(handlers, "should have session_start entry in subscriptions");
    assert.strictEqual(handlers!.length, 1, "should have exactly 1 handler");
    assert.strictEqual(handlers![0], handler, "should be the same handler reference");
  });

  testSync("records multiple handlers for same event", () => {
    const api = new MockExtensionAPI();
    const h1 = async () => {};
    const h2 = async () => {};
    api.on("tool_call", h1);
    api.on("tool_call", h2);
    const handlers = api.subscriptions.get("tool_call");
    assert.ok(handlers, "should have tool_call entry");
    assert.strictEqual(handlers!.length, 2, "should have 2 handlers");
  });

  testSync("records handlers for different events", () => {
    const api = new MockExtensionAPI();
    api.on("before_agent_start", async () => {});
    api.on("session_start", async () => {});
    assert.ok(api.subscriptions.has("before_agent_start"), "should have before_agent_start");
    assert.ok(api.subscriptions.has("session_start"), "should have session_start");
  });

  // =========================================================================
  console.log("\nMockExtensionAPI — registerCommand() recording:\n");
  // =========================================================================

  testSync("records command with name, description, handler", () => {
    const api = new MockExtensionAPI();
    const handler = async () => {};
    api.registerCommand("test-cmd", { description: "Test command", handler });
    const cmd = api.commands.get("test-cmd");
    assert.ok(cmd, "should have test-cmd in commands");
    assert.strictEqual(cmd!.description, "Test command");
    assert.strictEqual(cmd!.handler, handler);
  });

  testSync("warns on duplicate command and overwrites", () => {
    const api = new MockExtensionAPI();
    const h1 = async () => {};
    const h2 = async () => {};

    // Capture stderr
    const stderrChunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as any;

    api.registerCommand("dup-cmd", { description: "First", handler: h1 });
    api.registerCommand("dup-cmd", { description: "Second", handler: h2 });

    process.stderr.write = origWrite;

    const warning = stderrChunks.join("");
    assert.ok(warning.includes("[mock] duplicate command"), `expected duplicate warning, got: "${warning}"`);
    assert.strictEqual(api.commands.get("dup-cmd")!.handler, h2, "should have second handler (overwrite)");
  });

  // =========================================================================
  console.log("\nMockExtensionAPI — sendUserMessage() recording:\n");
  // =========================================================================

  testSync("records message content", () => {
    const api = new MockExtensionAPI();
    api.sendUserMessage("hello");
    assert.strictEqual(api.messages.length, 1);
    assert.strictEqual(api.messages[0].content, "hello");
  });

  testSync("records message with options", () => {
    const api = new MockExtensionAPI();
    api.sendUserMessage("hello", { deliverAs: "steer" });
    assert.strictEqual(api.messages[0].content, "hello");
    assert.strictEqual(api.messages[0].options?.deliverAs, "steer");
  });

  // =========================================================================
  console.log("\nMockExtensionAPI — fireEvent():\n");
  // =========================================================================

  await test("invokes registered handler and returns result", async () => {
    const api = new MockExtensionAPI();
    api.on("before_agent_start", async () => {
      return { systemPrompt: "modified" };
    });
    const result = await api.fireEvent("before_agent_start", { type: "before_agent_start", prompt: "", systemPrompt: "" }, {});
    assert.ok(result, "should return a result");
    assert.strictEqual(result.systemPrompt, "modified");
  });

  await test("invokes multiple handlers in order, returns last result", async () => {
    const api = new MockExtensionAPI();
    const callOrder: number[] = [];

    api.on("before_agent_start", async () => {
      callOrder.push(1);
      return { systemPrompt: "first" };
    });
    api.on("before_agent_start", async () => {
      callOrder.push(2);
      return { systemPrompt: "second" };
    });

    const result = await api.fireEvent("before_agent_start", { type: "before_agent_start" }, {});
    assert.deepStrictEqual(callOrder, [1, 2], "should call handlers in order");
    assert.strictEqual(result.systemPrompt, "second", "should return last handler's result");
  });

  await test("warns and returns undefined for unregistered event", async () => {
    const api = new MockExtensionAPI();
    const stderrChunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as any;

    const result = await api.fireEvent("unknown_event", {});

    process.stderr.write = origWrite;

    const warning = stderrChunks.join("");
    assert.ok(warning.includes("[mock] fireEvent for unregistered event"), `expected warning, got: "${warning}"`);
    assert.strictEqual(result, undefined, "should return undefined");
  });

  await test("handles async handlers", async () => {
    const api = new MockExtensionAPI();
    api.on("session_start", async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { done: true };
    });
    const result = await api.fireEvent("session_start", { type: "session_start" }, {});
    assert.ok(result, "should return result from async handler");
    assert.strictEqual(result.done, true);
  });

  // =========================================================================
  console.log("\nMockExtensionAPI — reset():\n");
  // =========================================================================

  testSync("clears all recorded state", () => {
    const api = new MockExtensionAPI();
    api.on("session_start", async () => {});
    api.registerCommand("cmd", { description: "test", handler: async () => {} });
    api.sendUserMessage("msg");

    assert.ok(api.subscriptions.size > 0, "pre-reset: should have subscriptions");
    assert.ok(api.commands.size > 0, "pre-reset: should have commands");
    assert.ok(api.messages.length > 0, "pre-reset: should have messages");

    api.reset();

    assert.strictEqual(api.subscriptions.size, 0, "post-reset: subscriptions should be empty");
    assert.strictEqual(api.commands.size, 0, "post-reset: commands should be empty");
    assert.strictEqual(api.messages.length, 0, "post-reset: messages should be empty");
  });

  // =========================================================================
  console.log("\nMockContext — recording stubs:\n");
  // =========================================================================

  testSync("provides cwd", () => {
    const ctx = createMockContext({ cwd: "/my/project" });
    assert.strictEqual(ctx.cwd, "/my/project");
  });

  testSync("defaults cwd to /tmp/test-project", () => {
    const ctx = createMockContext();
    assert.strictEqual(ctx.cwd, "/tmp/test-project");
  });

  testSync("records ui.setStatus() calls", () => {
    const ctx = createMockContext();
    ctx.ui.setStatus("gsd", "GSD ●");
    assert.strictEqual(ctx.ui.statusCalls.length, 1);
    assert.strictEqual(ctx.ui.statusCalls[0].key, "gsd");
    assert.strictEqual(ctx.ui.statusCalls[0].text, "GSD ●");
  });

  testSync("records ui.notify() calls", () => {
    const ctx = createMockContext();
    ctx.ui.notify("hello", "info");
    assert.strictEqual(ctx.ui.notifyCalls.length, 1);
    assert.strictEqual(ctx.ui.notifyCalls[0].message, "hello");
    assert.strictEqual(ctx.ui.notifyCalls[0].type, "info");
  });

  testSync("reset clears recorded calls", () => {
    const ctx = createMockContext();
    ctx.ui.setStatus("gsd", "active");
    ctx.ui.notify("test", "info");
    assert.ok(ctx.ui.statusCalls.length > 0, "pre-reset: should have status calls");
    assert.ok(ctx.ui.notifyCalls.length > 0, "pre-reset: should have notify calls");

    ctx.reset();

    assert.strictEqual(ctx.ui.statusCalls.length, 0, "post-reset: statusCalls should be empty");
    assert.strictEqual(ctx.ui.notifyCalls.length, 0, "post-reset: notifyCalls should be empty");
  });

  // =========================================================================
  console.log("\nMockCommandContext:\n");
  // =========================================================================

  testSync("extends mock context with command methods", () => {
    const ctx = createMockCommandContext();
    assert.strictEqual(typeof ctx.waitForIdle, "function");
    assert.strictEqual(typeof ctx.newSession, "function");
    assert.strictEqual(typeof ctx.fork, "function");
    assert.strictEqual(typeof ctx.navigateTree, "function");
    assert.strictEqual(typeof ctx.switchSession, "function");
    assert.strictEqual(typeof ctx.reload, "function");
  });

  await test("command methods resolve without error", async () => {
    const ctx = createMockCommandContext();
    await ctx.waitForIdle();
    const session = await ctx.newSession();
    assert.strictEqual(session.cancelled, false);
    const forked = await ctx.fork("entry-1");
    assert.strictEqual(forked.cancelled, false);
    const nav = await ctx.navigateTree("target-1");
    assert.strictEqual(nav.cancelled, false);
    const switched = await ctx.switchSession("/tmp/session");
    assert.strictEqual(switched.cancelled, false);
    await ctx.reload();
  });

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
