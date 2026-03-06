/**
 * E2E Parallel Subagent Spawn Tests — validates that Pi can spawn 5 GSD
 * subagents concurrently in a single turn. Each agent reads distinct input
 * fixtures, produces a distinct output file, and sentinel strings verify
 * real reads (not hallucination) and agent isolation (no cross-contamination).
 *
 * Requirements: PAR-01 through PAR-05
 * PREREQUISITE: Pi binary, Anthropic auth, GSD extension source.
 * Gated behind --e2e flag (expensive: real LLM round-trips).
 *
 * Run: npx tsx tests/e2e-parallel-subagent.test.ts --e2e
 */

import assert from "node:assert";
import {
  checkPrerequisites,
  createTempWorkspace,
  spawnPiRpc,
  promptAndWait,
  TempWorkspace,
} from "./harness/pi-rpc.js";
import { formatFailure } from "./harness/diagnostic.js";

// =========================================================================
// E2E gate — skip unless --e2e flag is set
// =========================================================================

if (!process.argv.includes("--e2e")) {
  console.log("Skipping E2E: --e2e flag not set");
  process.exit(0);
}

// =========================================================================
// Prerequisites — MUST fail if missing
// =========================================================================

console.log("\nE2E Parallel Subagent prerequisites:\n");

try {
  checkPrerequisites();
  console.log("  ✓ All prerequisites met");
} catch (err: any) {
  console.log(`  ✗ ${err.message}`);
  console.log(`\n0 passed, 1 failed`);
  process.exit(1);
}

// =========================================================================
// Test scaffolding
// =========================================================================

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
// Sentinel constants — unique per run, per agent
// =========================================================================

const ts = Date.now();

const SENTINELS = {
  SYNTH: `XPAR_SYNTH_${ts}`,
  MAPPER: `XPAR_MAPPER_${ts}`,
  RESEARCHER: `XPAR_RESEARCHER_${ts}`,
  CHECKER: `XPAR_CHECKER_${ts}`,
  VERIFIER: `XPAR_VERIFIER_${ts}`,
} as const;

// Agent → expected output path mapping
const AGENT_OUTPUTS: Record<string, string> = {
  SYNTH: ".planning/research/SUMMARY.md",
  MAPPER: ".planning/codebase/STACK.md",
  RESEARCHER: ".planning/phase-1/RESEARCH.md",
  CHECKER: ".planning/phase-check/VERDICT.md",
  VERIFIER: ".planning/phase-verify/VERIFICATION.md",
};

// =========================================================================
// Fixture seeding — each agent gets isolated inputs with its own sentinel
// =========================================================================

function seedFixtures(ws: TempWorkspace): void {
  // --- gsd-research-synthesizer inputs ---
  ws.writeFile(
    ".planning/research/STACK.md",
    `# Stack Research\n\n## Recommended: ${SENTINELS.SYNTH}\n\n- TypeScript 5.x for type safety\n- Node.js 20 LTS runtime\n- ESM module system\n`,
  );
  ws.writeFile(
    ".planning/research/FEATURES.md",
    `# Features Research\n\n## Core Feature: ${SENTINELS.SYNTH}\n\n- User authentication with JWT\n- Real-time data sync\n- Data export pipeline\n`,
  );
  ws.writeFile(
    ".planning/research/ARCHITECTURE.md",
    `# Architecture Research\n\n## Pattern: ${SENTINELS.SYNTH}\n\n- MVC structure with service layer\n- Event-driven messaging\n- Repository pattern for data access\n`,
  );
  ws.writeFile(
    ".planning/research/PITFALLS.md",
    `# Pitfalls Research\n\n## Warning: ${SENTINELS.SYNTH}\n\n- Memory leaks in long-running sessions\n- Race conditions in concurrent writes\n- Unbounded queue growth under load\n`,
  );

  // --- gsd-codebase-mapper inputs (fake source files) ---
  ws.writeFile(
    "src/index.ts",
    `// Main entry point — ${SENTINELS.MAPPER}\n` +
    `import { parseConfig } from "./utils.js";\n` +
    `export async function main() {\n` +
    `  const config = parseConfig();\n` +
    `  console.log("Starting server on port", config.port);\n` +
    `}\n`,
  );
  ws.writeFile(
    "src/utils.ts",
    `// Utilities — ${SENTINELS.MAPPER}\n` +
    `export interface Config { port: number; dbUrl: string; }\n` +
    `export function parseConfig(): Config {\n` +
    `  return { port: parseInt(process.env.PORT || "3000"), dbUrl: process.env.DB_URL || "" };\n` +
    `}\n`,
  );

  // --- gsd-phase-researcher inputs ---
  ws.writeFile(
    ".planning/phase-1/SPEC.md",
    `# Phase 1: Authentication System\n\n` +
    `## Sentinel: ${SENTINELS.RESEARCHER}\n\n` +
    `## Goal\nImplement JWT-based authentication with refresh tokens.\n\n` +
    `## Requirements\n- Login endpoint with email/password\n- JWT access tokens (15m expiry)\n` +
    `- Refresh token rotation\n- Password hashing with bcrypt\n`,
  );

  // --- gsd-plan-checker inputs ---
  ws.writeFile(
    ".planning/phase-check/SPEC.md",
    `# Phase 2: Data Export Pipeline\n\n` +
    `## Sentinel: ${SENTINELS.CHECKER}\n\n` +
    `## Goal\nBuild CSV/JSON export for user data with streaming support.\n\n` +
    `## Requirements\n- Export endpoint accepting format parameter\n` +
    `- Stream large datasets (>100k rows) without OOM\n- Rate limiting per user\n`,
  );
  ws.writeFile(
    ".planning/phase-check/PLAN.md",
    `# Phase 2 Plan\n\n` +
    `## Sentinel: ${SENTINELS.CHECKER}\n\n` +
    `## Tasks\n` +
    `1. Create export controller with format switching\n` +
    `2. Implement streaming CSV writer\n` +
    `3. Implement streaming JSON writer\n` +
    `4. Add rate limiting middleware\n` +
    `5. Write integration tests for large exports\n\n` +
    `## Dependencies\n- Task 2,3 depend on Task 1\n- Task 4 is independent\n- Task 5 depends on Tasks 1-3\n`,
  );

  // --- gsd-verifier inputs ---
  ws.writeFile(
    ".planning/phase-verify/PLAN.md",
    `# Phase 3: API Layer\n\n` +
    `## Sentinel: ${SENTINELS.VERIFIER}\n\n` +
    `## Goal\nBuild REST API endpoints for CRUD operations on resources.\n\n` +
    `## Tasks\n` +
    `1. Create Express router with resource routes\n` +
    `2. Implement input validation middleware\n` +
    `3. Add error handling with proper HTTP status codes\n` +
    `4. Write API tests\n`,
  );
  ws.writeFile(
    "verify-src/auth.ts",
    `// Auth module — ${SENTINELS.VERIFIER}\n` +
    `export function verifyToken(token: string): boolean {\n` +
    `  return token.length > 0; // stub\n` +
    `}\n`,
  );
  ws.writeFile(
    "verify-src/api.ts",
    `// API module — ${SENTINELS.VERIFIER}\n` +
    `import { verifyToken } from "./auth.js";\n` +
    `export function handleRequest(req: any) {\n` +
    `  if (!verifyToken(req.token)) throw new Error("Unauthorized");\n` +
    `  return { status: 200, data: req.body };\n` +
    `}\n`,
  );

  // --- Minimal GSD config ---
  ws.writeFile(
    ".planning/config.json",
    JSON.stringify({ model_profile: "balanced", commit_docs: false }, null, 2),
  );
}

// =========================================================================
// Prompt — instructs Pi to spawn all 5 agents in parallel
// =========================================================================

function buildPrompt(): string {
  return [
    `Spawn all 5 of the following agents in PARALLEL using the subagent tool.`,
    `Issue all 5 subagent tool calls at once — do NOT wait for one to finish before starting the next.`,
    `Each agent should skip any git commit steps.`,
    ``,
    `1. Agent "gsd-research-synthesizer": Read the 4 research files in .planning/research/ ` +
    `(STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md) and synthesize them into ` +
    `.planning/research/SUMMARY.md.`,
    ``,
    `2. Agent "gsd-codebase-mapper": Analyze the source files in src/ with focus area "tech". ` +
    `Write your findings to .planning/codebase/STACK.md.`,
    ``,
    `3. Agent "gsd-phase-researcher": Read .planning/phase-1/SPEC.md and research how to ` +
    `implement it. Write your findings to .planning/phase-1/RESEARCH.md.`,
    ``,
    `4. Agent "gsd-plan-checker": Read .planning/phase-check/PLAN.md and .planning/phase-check/SPEC.md. ` +
    `Verify the plan achieves the goal. Write your verdict to .planning/phase-check/VERDICT.md.`,
    ``,
    `5. Agent "gsd-verifier": Read .planning/phase-verify/PLAN.md and check the implementation ` +
    `in verify-src/ (auth.ts, api.ts). Write your verification report to ` +
    `.planning/phase-verify/VERIFICATION.md.`,
  ].join("\n");
}

// =========================================================================
// Tests
// =========================================================================

async function runTests() {
  console.log("\nE2E Parallel Subagent Spawn Tests\n");

  const ws = createTempWorkspace({ withPlanning: true });
  seedFixtures(ws);

  const session = spawnPiRpc({
    cwd: ws.dir,
    processTimeoutMs: 600_000, // 10 min total process limit
    model: "anthropic/claude-sonnet-4-20250514",
    thinking: "off",
  });

  try {
    // Single prompt drives all 5 parallel subagent invocations
    await promptAndWait(session, buildPrompt(), 480_000); // 8 min for the turn

    // -----------------------------------------------------------------
    // PAR-01: No extension errors during parallel execution
    // -----------------------------------------------------------------
    await testAsync(
      "PAR-01: No extension errors — all 5 agents resolve without errors",
      async () => {
        const errors = session.extensionErrors();
        assert.strictEqual(
          errors.length,
          0,
          formatFailure({
            file: "agents/*.md",
            expected: "0 extension errors during parallel subagent execution",
            actual: `${errors.length} error(s): ${JSON.stringify(errors.map((e) => e.message ?? e.error ?? e))}`,
            why: "PAR-01 requires all 5 agents to resolve without 'Unknown agent' or other extension errors",
          }),
        );
      },
    );

    // -----------------------------------------------------------------
    // PAR-02: All 5 output files exist
    // -----------------------------------------------------------------
    await testAsync(
      "PAR-02: All 5 output files created by parallel agents",
      async () => {
        const missing: string[] = [];
        for (const [agent, outputPath] of Object.entries(AGENT_OUTPUTS)) {
          if (!ws.exists(outputPath)) {
            missing.push(`${agent}: ${outputPath}`);
          }
        }
        assert.strictEqual(
          missing.length,
          0,
          formatFailure({
            file: "tests/e2e-parallel-subagent.test.ts",
            expected: "All 5 output files exist after parallel turn completes",
            actual: `${missing.length} file(s) missing: ${missing.join(", ")}`,
            why: "PAR-02 requires each agent to write its output file to the expected path",
          }),
        );
      },
    );

    // -----------------------------------------------------------------
    // PAR-03: Each output contains its agent-specific sentinel
    // -----------------------------------------------------------------
    await testAsync(
      "PAR-03: Each output contains its agent-specific sentinel string",
      async () => {
        const failures: string[] = [];
        for (const [agent, sentinel] of Object.entries(SENTINELS)) {
          const outputPath = AGENT_OUTPUTS[agent];
          if (!ws.exists(outputPath)) {
            failures.push(`${agent}: output file missing (${outputPath})`);
            continue;
          }
          const content = ws.readFile(outputPath);
          if (!content.includes(sentinel)) {
            failures.push(
              `${agent}: sentinel "${sentinel}" not found in ${outputPath} (${content.length} chars)`,
            );
          }
        }
        assert.strictEqual(
          failures.length,
          0,
          formatFailure({
            file: "tests/e2e-parallel-subagent.test.ts",
            expected: "Each output file contains its agent-specific sentinel",
            actual: `${failures.length} failure(s):\n${failures.join("\n")}`,
            why: "PAR-03 verifies agents actually read input files (sentinels prove real reads, not hallucination)",
          }),
        );
      },
    );

    // -----------------------------------------------------------------
    // PAR-04: No cross-contamination between agents
    // -----------------------------------------------------------------
    await testAsync(
      "PAR-04: No cross-contamination — outputs contain only their own sentinels",
      async () => {
        const contaminations: string[] = [];
        for (const [ownerAgent, outputPath] of Object.entries(AGENT_OUTPUTS)) {
          if (!ws.exists(outputPath)) continue;
          const content = ws.readFile(outputPath);

          for (const [otherAgent, otherSentinel] of Object.entries(SENTINELS)) {
            if (otherAgent === ownerAgent) continue;
            if (content.includes(otherSentinel)) {
              contaminations.push(
                `${ownerAgent}'s output (${outputPath}) contains ${otherAgent}'s sentinel`,
              );
            }
          }
        }
        assert.strictEqual(
          contaminations.length,
          0,
          formatFailure({
            file: "tests/e2e-parallel-subagent.test.ts",
            expected: "No agent output contains another agent's sentinel string",
            actual: `${contaminations.length} contamination(s):\n${contaminations.join("\n")}`,
            why: "PAR-04 verifies agent isolation — parallel execution must not leak context between agents",
          }),
        );
      },
    );

    // -----------------------------------------------------------------
    // PAR-05: All outputs are substantial with markdown structure
    // -----------------------------------------------------------------
    await testAsync(
      "PAR-05: All outputs are substantial (≥100 chars with markdown headings)",
      async () => {
        const failures: string[] = [];
        for (const [agent, outputPath] of Object.entries(AGENT_OUTPUTS)) {
          if (!ws.exists(outputPath)) {
            failures.push(`${agent}: output file missing`);
            continue;
          }
          const content = ws.readFile(outputPath);

          if (content.length < 100) {
            failures.push(
              `${agent}: only ${content.length} chars (need ≥100)`,
            );
          }
          if (!content.includes("#")) {
            failures.push(
              `${agent}: no markdown heading found`,
            );
          }
        }
        assert.strictEqual(
          failures.length,
          0,
          formatFailure({
            file: "tests/e2e-parallel-subagent.test.ts",
            expected: "All 5 outputs ≥100 characters with at least one markdown heading",
            actual: `${failures.length} failure(s):\n${failures.join("\n")}`,
            why: "PAR-05 verifies agents produced substantial structured output, not stubs",
          }),
        );
      },
    );
  } finally {
    session.kill();
    await session.waitForExit();
    ws.cleanup();
  }
}

// =========================================================================
// Run and report
// =========================================================================

runTests()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
  });
