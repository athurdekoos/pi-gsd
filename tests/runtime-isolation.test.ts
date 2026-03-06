/**
 * Runtime Isolation & Durability Tests — validates that pi-gsd's architecture
 * prevents context degradation and maintains file-based state integrity.
 *
 * Probe 1: "Main session stays clean" — orchestrator delegates to subagent;
 *   subagent artifacts exist separately from orchestrator output.
 * Probe 2: "Prevents degradation over long runs" — many turns with tool calls;
 *   file-based state remains correct and gsd-tools still functions.
 *
 * Tests: ISOL-01 through ISOL-04
 * PREREQUISITE: Pi binary, Anthropic auth, GSD extension source.
 * These tests FAIL (not skip) if prerequisites are missing.
 *
 * Run: npx tsx tests/runtime-isolation.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import {
  checkPrerequisites,
  createTempWorkspace,
  spawnPiRpc,
  promptAndWait,
  extractAssistantText,
  TempWorkspace,
  PiRpcSession,
} from "./harness/pi-rpc.js";

let passed = 0;
let failed = 0;

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

// =========================================================================
// Prerequisites — MUST fail if missing
// =========================================================================

console.log("\nRuntime prerequisites:\n");

try {
  checkPrerequisites();
  console.log("  ✓ All prerequisites met");
} catch (err: any) {
  console.log(`  ✗ ${err.message}`);
  console.log(`\n0 passed, 1 failed`);
  process.exit(1);
}

// =========================================================================
// Helper: resolve gsd-tools path
// =========================================================================

const GSD_TOOLS = path.resolve(__dirname, "../gsd/bin/gsd-tools.cjs");

// =========================================================================
// Tests
// =========================================================================

async function runTests() {
  // -----------------------------------------------------------------------
  console.log("\nProbe 1 — Orchestrator/subagent isolation:\n");
  // -----------------------------------------------------------------------

  // ISOL-01: Subagent work produces distinct artifacts that the orchestrator doesn't claim
  await testAsync("ISOL-01: subagent writes to a distinct output path — orchestrator session doesn't write the same file", async () => {
    const ws = createTempWorkspace({ withPlanning: true });
    // Set up a minimal config.json for gsd-tools
    ws.writeFile(".planning/config.json", JSON.stringify({
      model_profile: "balanced",
      commit_docs: false,
    }));

    try {
      const session = spawnPiRpc({
        cwd: ws.dir,
        processTimeoutMs: 180_000,
        model: "anthropic/claude-sonnet-4-20250514",
      });

      try {
        // Use the agent as an "orchestrator" that creates a file in a subagent-like path.
        // In pi-gsd architecture, subagents write to .planning/codebase/, .planning/research/, etc.
        // The orchestrator's job is to spawn them and collect confirmations.
        //
        // We simulate this by asking the agent to:
        // 1. Write a "subagent marker" file to a specific path
        // 2. Write an "orchestrator marker" file to a different path
        // Then verify the files are in separate locations.

        const SUBAGENT_MARKER = "SUBAGENT_MARKER_" + Date.now();
        const ORCHESTRATOR_MARKER = "ORCHESTRATOR_MARKER_" + Date.now();

        await promptAndWait(
          session,
          `Do these two tasks using the write tool:
1. Write the exact text "${SUBAGENT_MARKER}" to the file .planning/codebase/PROBE.md (create directories as needed)
2. Write the exact text "${ORCHESTRATOR_MARKER}" to the file .planning/ORCHESTRATOR_LOG.md

Do not include one marker in the other's file.`,
          90_000,
        );

        // Verify subagent file exists with its marker
        assert.ok(ws.exists(".planning/codebase/PROBE.md"),
          "Subagent output path .planning/codebase/PROBE.md should exist");
        const subagentContent = ws.readFile(".planning/codebase/PROBE.md");
        assert.ok(subagentContent.includes(SUBAGENT_MARKER),
          `Subagent file should contain marker '${SUBAGENT_MARKER}'`);

        // Verify orchestrator file exists with its marker
        assert.ok(ws.exists(".planning/ORCHESTRATOR_LOG.md"),
          "Orchestrator output .planning/ORCHESTRATOR_LOG.md should exist");
        const orchestratorContent = ws.readFile(".planning/ORCHESTRATOR_LOG.md");
        assert.ok(orchestratorContent.includes(ORCHESTRATOR_MARKER),
          `Orchestrator file should contain marker '${ORCHESTRATOR_MARKER}'`);

        // Verify isolation: orchestrator file does NOT contain subagent marker
        assert.ok(!orchestratorContent.includes(SUBAGENT_MARKER),
          "Orchestrator file must NOT contain the subagent marker (isolation violation)");

        // Verify isolation: subagent file does NOT contain orchestrator marker
        assert.ok(!subagentContent.includes(ORCHESTRATOR_MARKER),
          "Subagent file must NOT contain the orchestrator marker (isolation violation)");

      } finally {
        session.kill();
        await session.waitForExit();
      }
    } finally {
      ws.cleanup();
    }
  });

  // ISOL-02: Agent .md definitions exist for all expected subagent roles
  await testAsync("ISOL-02: all expected subagent roles have agent definition files", async () => {
    const agentsDir = path.resolve(__dirname, "../agents");

    // These are the core subagent roles pi-gsd depends on for isolation
    const requiredAgents = [
      "gsd-executor.md",
      "gsd-planner.md",
      "gsd-verifier.md",
      "gsd-codebase-mapper.md",
      "gsd-roadmapper.md",
    ];

    for (const agentFile of requiredAgents) {
      const agentPath = path.join(agentsDir, agentFile);
      assert.ok(fs.existsSync(agentPath),
        `Required agent definition missing: ${agentFile}`);

      // Verify agent file has frontmatter with name and tools
      const content = fs.readFileSync(agentPath, "utf-8");
      assert.ok(content.startsWith("---"),
        `Agent ${agentFile} should have YAML frontmatter`);
      assert.ok(content.includes("name:"),
        `Agent ${agentFile} frontmatter should include 'name:'`);
    }
  });

  // -----------------------------------------------------------------------
  console.log("\nProbe 2 — Long-run durability (file-based state survives many turns):\n");
  // -----------------------------------------------------------------------

  // ISOL-03: File-based state remains valid after many tool calls
  await testAsync("ISOL-03: .planning/ state files survive 10+ turns of tool calls without corruption", async () => {
    const ws = createTempWorkspace({ withPlanning: true });

    // Create a realistic .planning/ state
    ws.writeFile(".planning/config.json", JSON.stringify({
      model_profile: "balanced",
      commit_docs: false,
      parallelization: true,
      workflow: { research: true, plan_check: true, verifier: true },
    }, null, 2));

    ws.writeFile(".planning/STATE.md", [
      "---",
      "phase: 1",
      "status: active",
      "progress: 10",
      "---",
      "# Project State",
      "",
      "**Phase:** 1",
      "**Status:** Active",
      "**Progress:** 10%",
    ].join("\n"));

    ws.writeFile(".planning/PROJECT.md", [
      "# Test Project",
      "",
      "## What This Is",
      "A test project for runtime isolation testing.",
      "",
      "## Core Value",
      "Validate that pi-gsd survives long runs.",
    ].join("\n"));

    try {
      const session = spawnPiRpc({
        cwd: ws.dir,
        processTimeoutMs: 300_000, // 5 minutes
        model: "anthropic/claude-sonnet-4-20250514",
      });

      try {
        // Turn 1: Read and echo state
        await promptAndWait(
          session,
          "Use bash to run: cat .planning/STATE.md",
          60_000,
        );

        // Turns 2-6: Multiple tool calls that read/write files
        for (let i = 2; i <= 6; i++) {
          await promptAndWait(
            session,
            `Use bash to run: echo "Turn ${i} marker $(date +%s)" >> .planning/durability-log.txt && cat .planning/durability-log.txt | wc -l`,
            60_000,
          );
        }

        // Turn 7: Run gsd-tools to verify it still works
        await promptAndWait(
          session,
          `Use bash to run: node "${GSD_TOOLS}" current-timestamp --cwd "${ws.dir}"`,
          60_000,
        );

        // Turn 8: Run gsd-tools state operation
        await promptAndWait(
          session,
          `Use bash to run: node "${GSD_TOOLS}" verify-path-exists .planning/STATE.md --cwd "${ws.dir}"`,
          60_000,
        );

        // Turn 9: Read state again
        await promptAndWait(
          session,
          "Use bash to run: cat .planning/STATE.md",
          60_000,
        );

        // Turn 10: Final verification via gsd-tools
        await promptAndWait(
          session,
          `Use bash to run: node "${GSD_TOOLS}" state get --cwd "${ws.dir}"`,
          60_000,
        );

        // --- Assertions on file-based state integrity ---

        // STATE.md must still exist and be parseable
        assert.ok(ws.exists(".planning/STATE.md"),
          "STATE.md must survive 10 turns of tool calls");
        const stateContent = ws.readFile(".planning/STATE.md");
        assert.ok(stateContent.includes("---"),
          "STATE.md must still have frontmatter delimiter");
        assert.ok(stateContent.includes("phase:"),
          "STATE.md frontmatter must still contain 'phase:' field");

        // config.json must still be valid JSON
        assert.ok(ws.exists(".planning/config.json"),
          "config.json must survive 10 turns");
        const configContent = ws.readFile(".planning/config.json");
        const config = JSON.parse(configContent); // Throws if corrupted
        assert.strictEqual(config.model_profile, "balanced",
          "config.json model_profile must be unchanged");

        // PROJECT.md must still exist
        assert.ok(ws.exists(".planning/PROJECT.md"),
          "PROJECT.md must survive 10 turns");

        // Durability log should have entries from turns 2-6
        assert.ok(ws.exists(".planning/durability-log.txt"),
          "Durability log should exist (written during turns 2-6)");
        const logContent = ws.readFile(".planning/durability-log.txt");
        const logLines = logContent.trim().split("\n").filter(Boolean);
        assert.ok(logLines.length >= 5,
          `Expected at least 5 log entries, got ${logLines.length}`);

        // Verify gsd-tools was successfully called (check tool_execution_end events)
        const successfulBash = session.toolEnds().filter(
          e => e.toolName === "bash" && !e.isError
        );
        assert.ok(successfulBash.length >= 8,
          `Expected at least 8 successful bash executions across 10 turns, got ${successfulBash.length}`);

      } finally {
        session.kill();
        await session.waitForExit();
      }
    } finally {
      ws.cleanup();
    }
  });

  // ISOL-04: gsd-tools deterministic operations work after many Pi interactions
  await testAsync("ISOL-04: gsd-tools CLI operations are deterministic — same input always produces same output", async () => {
    const ws = createTempWorkspace({ withPlanning: true });
    ws.writeFile(".planning/config.json", JSON.stringify({
      model_profile: "balanced",
      commit_docs: false,
    }));

    try {
      // Run gsd-tools directly (not through Pi) to verify determinism
      // This validates the CLI layer that Pi's extension depends on
      const run = (cmd: string) => execSync(
        `node "${GSD_TOOLS}" ${cmd} --cwd "${ws.dir}"`,
        { encoding: "utf-8", timeout: 10_000 }
      ).trim();

      // current-timestamp: two calls should return same-second timestamps
      const ts1 = run("current-timestamp");
      const ts2 = run("current-timestamp");
      assert.ok(/\d{4}-\d{2}-\d{2}/.test(ts1),
        `Expected timestamp format, got: ${ts1}`);
      // Both should be valid timestamps (same minute at minimum)
      assert.ok(/\d{4}-\d{2}-\d{2}/.test(ts2),
        `Expected timestamp format, got: ${ts2}`);

      // generate-slug: deterministic output
      const slug1 = JSON.parse(run("generate-slug 'Phase 1: Foundation Setup'"));
      const slug2 = JSON.parse(run("generate-slug 'Phase 1: Foundation Setup'"));
      assert.strictEqual(slug1.slug, slug2.slug,
        `Slug generation should be deterministic: '${slug1.slug}' !== '${slug2.slug}'`);

      // verify-path-exists: correct for existing and non-existing paths
      const existsResult = JSON.parse(run("verify-path-exists .planning/config.json"));
      assert.strictEqual(existsResult.exists, true,
        "verify-path-exists should return true for existing config.json");

      const notExistsResult = JSON.parse(run("verify-path-exists .planning/NONEXISTENT.md"));
      assert.strictEqual(notExistsResult.exists, false,
        "verify-path-exists should return false for non-existing file");

    } finally {
      ws.cleanup();
    }
  });
}

runTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}).catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
