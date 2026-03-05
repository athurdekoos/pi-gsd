/**
 * Parity tests: file presence and byte-identity
 * Tests: PRTY-01 through PRTY-10
 *
 * Verifies every upstream GSD file has a pi-gsd counterpart (presence)
 * and that synced files are byte-identical (content identity).
 * Agents are excluded from byte-identity — tested separately in parity-agents.test.ts.
 *
 * Run: npx tsx tests/parity-files.test.ts
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  resolveUpstream,
  cleanupUpstream,
  getAllFiles,
  CATEGORY_MAP,
} from "./helpers/upstream-resolver.ts";

const upstream = resolveUpstream();
const pigsdRoot = path.resolve(__dirname, "..");

process.on("exit", cleanupUpstream);

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

/**
 * Get relative file paths for a category directory.
 * Uses getAllFiles for recursive categories, flat readdirSync otherwise.
 */
function getRelativeFiles(baseDir: string, recursive: boolean): string[] {
  if (!fs.existsSync(baseDir)) return [];
  if (recursive) {
    return getAllFiles(baseDir).map((f) => path.relative(baseDir, f));
  }
  return fs.readdirSync(baseDir).filter((f) => {
    return fs.statSync(path.join(baseDir, f)).isFile();
  });
}

/**
 * Find first differing byte position between two buffers.
 */
function firstDiffPosition(a: Buffer, b: Buffer): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return len; // lengths differ
}

// =========================================================================
console.log("\nFile presence (PRTY-01 through PRTY-06):\n");
// =========================================================================

for (const cat of CATEGORY_MAP) {
  const reqId =
    cat.name === "commands"
      ? "PRTY-01"
      : cat.name === "agents"
      ? "PRTY-02"
      : cat.name === "workflows"
      ? "PRTY-03"
      : cat.name === "templates"
      ? "PRTY-04"
      : cat.name === "references"
      ? "PRTY-05"
      : "PRTY-06"; // bin

  testSync(`[${reqId}] every upstream ${cat.name} file has a pi-gsd counterpart`, () => {
    const upstreamDir = path.join(upstream, cat.upstreamDir);
    const pigsdDir = path.join(pigsdRoot, cat.pigsdDir);

    const upstreamFiles = getRelativeFiles(upstreamDir, cat.recursive);
    const pigsdFiles = getRelativeFiles(pigsdDir, cat.recursive);

    const upstreamSet = new Set(upstreamFiles);
    const pigsdSet = new Set(pigsdFiles);

    // Separate .bak files — flagged but don't cause failure
    const bakFiles: string[] = [];
    const canonicalMissing: string[] = [];

    for (const f of upstreamFiles) {
      if (!pigsdSet.has(f)) {
        if (f.endsWith(".bak")) {
          bakFiles.push(f);
        } else {
          canonicalMissing.push(f);
        }
      }
    }

    // Flag upstream-only files (informational)
    if (bakFiles.length > 0) {
      console.log(`    ℹ Flagged upstream-only (.bak): ${bakFiles.join(", ")}`);
    }

    // Flag pi-gsd-only files (unexpected additions)
    const pigsdOnly = pigsdFiles.filter((f) => !upstreamSet.has(f));
    if (pigsdOnly.length > 0) {
      console.log(`    ℹ pi-gsd-only (not in upstream): ${pigsdOnly.join(", ")}`);
    }

    // Fail only on canonical (non-.bak) missing files
    assert.strictEqual(
      canonicalMissing.length,
      0,
      `FILE: tests/parity-files.test.ts → ${cat.name} presence\n` +
        `  EXPECTED: Every canonical upstream ${cat.name} file exists in pi-gsd\n` +
        `  ACTUAL: ${canonicalMissing.length} file(s) missing from pi-gsd\n` +
        `  WHY: Missing files mean pi-gsd cannot deliver the same outcome as upstream GSD.\n` +
        `  EVIDENCE: Missing: ${canonicalMissing.join(", ")}`
    );
  });
}

// =========================================================================
console.log("\nByte-identity (PRTY-07 through PRTY-10 + commands):\n");
// =========================================================================

// Categories that should be byte-identical (everything except agents)
const byteIdenticalCategories = CATEGORY_MAP.filter((c) => c.name !== "agents");

for (const cat of byteIdenticalCategories) {
  const reqId =
    cat.name === "workflows"
      ? "PRTY-07"
      : cat.name === "templates"
      ? "PRTY-08"
      : cat.name === "references"
      ? "PRTY-09"
      : cat.name === "bin"
      ? "PRTY-10"
      : "PRTY-01+"; // commands (byte-identity per user decision)

  testSync(`[${reqId}] ${cat.name} files are byte-identical to upstream`, () => {
    const upstreamDir = path.join(upstream, cat.upstreamDir);
    const pigsdDir = path.join(pigsdRoot, cat.pigsdDir);

    const upstreamFiles = getRelativeFiles(upstreamDir, cat.recursive);
    const pigsdFiles = new Set(getRelativeFiles(pigsdDir, cat.recursive));

    // Only compare files that exist in both
    const commonFiles = upstreamFiles.filter(
      (f) => pigsdFiles.has(f) && !f.endsWith(".bak")
    );

    const diffs: string[] = [];
    for (const f of commonFiles) {
      const upBuf = fs.readFileSync(path.join(upstreamDir, f));
      const piBuf = fs.readFileSync(path.join(pigsdDir, f));

      if (!upBuf.equals(piBuf)) {
        const pos = firstDiffPosition(upBuf, piBuf);
        diffs.push(
          `${f} (upstream: ${upBuf.length}B, pi-gsd: ${piBuf.length}B, first diff at byte ${pos})`
        );
      }
    }

    assert.strictEqual(
      diffs.length,
      0,
      `FILE: tests/parity-files.test.ts → ${cat.name} byte-identity\n` +
        `  EXPECTED: All ${commonFiles.length} ${cat.name} files byte-identical to upstream\n` +
        `  ACTUAL: ${diffs.length} file(s) differ\n` +
        `  WHY: Non-identical files mean pi-gsd may produce different outcomes than upstream.\n` +
        `        These files have no transform layer — they must match exactly.\n` +
        `  EVIDENCE:\n    ${diffs.join("\n    ")}`
    );
  });
}

// =========================================================================
// Summary
// =========================================================================
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
