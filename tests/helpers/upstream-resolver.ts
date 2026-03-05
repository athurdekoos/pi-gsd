/**
 * Upstream GSD repo resolver for parity tests
 *
 * Locates the upstream get-shit-done repo for comparison:
 *   1. Check local ~/dev/get-shit-done/ (fast, preferred)
 *   2. Clone from GitHub into temp dir (fallback)
 *
 * Hard-fails with diagnostic output if neither path works.
 * All parity tests depend on this resolver.
 *
 * Run: import { resolveUpstream, cleanupUpstream, getAllFiles, CATEGORY_MAP } from './helpers/upstream-resolver.js'
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const GITHUB_URL = "https://github.com/athurdekoos/get-shit-done.git";
const LOCAL_PATH = path.join(os.homedir(), "dev", "get-shit-done");

let _cachedUpstream: string | null = null;
let _clonedDir: string | null = null;

/**
 * Resolve upstream GSD repo path. Checks local first, clones from GitHub as fallback.
 * Caches result — safe to call multiple times.
 * Hard-fails (process.exit(1)) if upstream is unreachable.
 */
export function resolveUpstream(): string {
  if (_cachedUpstream) return _cachedUpstream;

  // Try local first — validate it's a real GSD repo by checking agents/ exists
  if (fs.existsSync(LOCAL_PATH) && fs.existsSync(path.join(LOCAL_PATH, "agents"))) {
    _cachedUpstream = LOCAL_PATH;
    return LOCAL_PATH;
  }

  // Fallback: clone from GitHub (shallow, main branch only)
  let cloneError = "";
  try {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-parity-"));
    execSync(`git clone --depth 1 --branch main "${GITHUB_URL}" "${tmpDir}"`, {
      stdio: "pipe",
      timeout: 30000,
    });
    _cachedUpstream = tmpDir;
    _clonedDir = tmpDir;

    // Register cleanup on process exit for crash safety
    process.on("exit", cleanupUpstream);

    return tmpDir;
  } catch (err: any) {
    cloneError = err.stderr?.toString().trim() || err.message;
  }

  // Hard-fail: neither local nor clone worked
  console.error(`FAIL: [parity] upstream-resolution`);
  console.error(`  FILE: tests/helpers/upstream-resolver.ts → resolveUpstream()`);
  console.error(`  EXPECTED: Upstream GSD repo available at ${LOCAL_PATH} or via git clone`);
  console.error(`  ACTUAL: Neither source available`);
  console.error(`  WHY: All parity tests require upstream GSD as comparison baseline.`);
  console.error(`        Without upstream, no file presence or byte-identity checks can run.`);
  console.error(`  EVIDENCE:`);
  console.error(`    Local path: ${LOCAL_PATH} — ${fs.existsSync(LOCAL_PATH) ? "exists but missing agents/" : "not found"}`);
  console.error(`    GitHub clone: ${GITHUB_URL} — failed: ${cloneError}`);
  process.exit(1);
}

/**
 * Clean up temp clone if one was created. Safe to call multiple times.
 */
export function cleanupUpstream(): void {
  if (_clonedDir && fs.existsSync(_clonedDir)) {
    try {
      fs.rmSync(_clonedDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup — OS will clean /tmp eventually
    }
    _clonedDir = null;
  }
}

/**
 * Recursively list all files in a directory. Returns absolute paths.
 * Used for templates (has codebase/, research-project/ subdirs) and bin (has lib/ subdir).
 */
export function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Category mapping: upstream directory → pi-gsd directory, with recursion flag.
 */
export interface CategoryMapping {
  name: string;
  upstreamDir: string;
  pigsdDir: string;
  recursive: boolean;
}

export const CATEGORY_MAP: CategoryMapping[] = [
  { name: "commands",   upstreamDir: "commands/gsd",            pigsdDir: "commands/gsd",   recursive: false },
  { name: "agents",     upstreamDir: "agents",                  pigsdDir: "agents",         recursive: false },
  { name: "workflows",  upstreamDir: "get-shit-done/workflows", pigsdDir: "gsd/workflows",  recursive: false },
  { name: "templates",  upstreamDir: "get-shit-done/templates", pigsdDir: "gsd/templates",  recursive: true  },
  { name: "references", upstreamDir: "get-shit-done/references",pigsdDir: "gsd/references", recursive: false },
  { name: "bin",        upstreamDir: "get-shit-done/bin",       pigsdDir: "gsd/bin",        recursive: true  },
];
