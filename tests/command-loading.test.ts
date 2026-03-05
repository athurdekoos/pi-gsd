/**
 * Unit tests for command discovery and parsing
 *
 * Validates that all GSD command .md files are:
 *   1. Discoverable in commands/gsd/
 *   2. Have valid frontmatter with name and description
 *   3. Have non-empty body content
 *   4. Use consistent naming (gsd:slug matches filename)
 *
 * Run: npx tsx tests/command-loading.test.ts
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.join(__dirname, "..", "commands", "gsd");
const AGENTS_DIR = path.join(__dirname, "..", "agents");
const GSD_DIR = path.join(__dirname, "..", "gsd");

/** Parse frontmatter from a GSD .md file */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kv) {
      fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
  }

  return { frontmatter: fm, body: match[2] };
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
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

console.log("command-loading tests:\n");

// --- Command directory exists ---

test("commands/gsd/ directory exists", () => {
  assert.ok(fs.existsSync(COMMANDS_DIR), `Missing: ${COMMANDS_DIR}`);
});

// --- Discover all commands ---

const commandFiles = fs.existsSync(COMMANDS_DIR)
  ? fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".md") && !f.endsWith(".bak"))
  : [];

test("at least 20 command files found", () => {
  assert.ok(
    commandFiles.length >= 20,
    `Expected ≥20 commands, found ${commandFiles.length}`
  );
});

// --- Required commands exist ---

const REQUIRED_COMMANDS = [
  "help.md",
  "new-project.md",
  "map-codebase.md",
  "discuss-phase.md",
  "plan-phase.md",
  "execute-phase.md",
  "verify-work.md",
  "quick.md",
  "progress.md",
  "health.md",
  "resume-work.md",
  "pause-work.md",
];

for (const cmd of REQUIRED_COMMANDS) {
  test(`required command exists: ${cmd}`, () => {
    assert.ok(
      commandFiles.includes(cmd),
      `Missing required command: ${cmd}`
    );
  });
}

// --- Each command has valid frontmatter ---

for (const file of commandFiles) {
  const filePath = path.join(COMMANDS_DIR, file);
  const content = fs.readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(content);
  const slug = file.replace(".md", "");

  test(`${file}: has frontmatter with description`, () => {
    assert.ok(frontmatter.description, `Missing description in ${file}`);
  });

  test(`${file}: has non-empty body`, () => {
    assert.ok(body.trim().length > 0, `Empty body in ${file}`);
  });

  test(`${file}: name matches gsd:${slug} pattern`, () => {
    if (frontmatter.name) {
      assert.ok(
        frontmatter.name === `gsd:${slug}`,
        `Name "${frontmatter.name}" doesn't match expected "gsd:${slug}"`
      );
    }
    // Name is optional in frontmatter; slug-based registration always works
  });
}

// --- Agents directory ---

console.log("\nagent tests:\n");

test("agents/ directory exists", () => {
  assert.ok(fs.existsSync(AGENTS_DIR), `Missing: ${AGENTS_DIR}`);
});

const agentFiles = fs.existsSync(AGENTS_DIR)
  ? fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"))
  : [];

const REQUIRED_AGENTS = [
  "gsd-executor.md",
  "gsd-planner.md",
  "gsd-plan-checker.md",
  "gsd-codebase-mapper.md",
];

for (const agent of REQUIRED_AGENTS) {
  test(`required agent exists: ${agent}`, () => {
    assert.ok(agentFiles.includes(agent), `Missing required agent: ${agent}`);
  });
}

test("agents have no old .claude/get-shit-done paths", () => {
  for (const file of agentFiles) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), "utf8");
    const hasOldPath = content.includes(".claude/get-shit-done");
    assert.ok(
      !hasOldPath,
      `Agent ${file} still contains old .claude/get-shit-done paths`
    );
  }
});

test("agents use $GSD_HOME for path references", () => {
  // At least some agents should reference $GSD_HOME
  let hasGsdHome = false;
  for (const file of agentFiles) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), "utf8");
    if (content.includes("$GSD_HOME")) {
      hasGsdHome = true;
      break;
    }
  }
  assert.ok(hasGsdHome, "No agents reference $GSD_HOME");
});

// --- GSD runtime files ---

console.log("\ngsd runtime tests:\n");

test("gsd/bin/gsd-tools.cjs exists", () => {
  assert.ok(fs.existsSync(path.join(GSD_DIR, "bin", "gsd-tools.cjs")));
});

test("gsd/workflows/ has files", () => {
  const files = fs.readdirSync(path.join(GSD_DIR, "workflows"));
  assert.ok(files.length >= 20, `Expected ≥20 workflows, found ${files.length}`);
});

test("gsd/references/ has files", () => {
  const files = fs.readdirSync(path.join(GSD_DIR, "references"));
  assert.ok(files.length >= 10, `Expected ≥10 references, found ${files.length}`);
});

test("gsd/templates/ has files", () => {
  const items = fs.readdirSync(path.join(GSD_DIR, "templates"));
  assert.ok(items.length >= 15, `Expected ≥15 templates, found ${items.length}`);
});

// --- Summary ---

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
