# Phase 1: Wiring Validation - Research

**Researched:** 2026-03-05
**Domain:** Test suite for subagent wiring (frontmatter, model profiles, template paths)
**Confidence:** HIGH

## Summary

Phase 1 builds three test files that validate the wiring layer between GSD workflows and Pi's subagent system — without API calls. The domain is well-constrained: validate 11 agent `.md` files parse correctly, MODEL_PROFILES has 1:1 coverage with agent files, and prompt templates resolve paths properly.

All necessary infrastructure exists. Pi SDK exports `parseFrontmatter` from its main package entry (`@mariozechner/pi-coding-agent`). The CJS module `gsd/bin/lib/core.cjs` exports `MODEL_PROFILES` and `resolveModelInternal` directly. The `GsdPathResolver` class is importable from `extensions/gsd/path-resolver.ts`. Existing test patterns (harness, naming, structure) are well-established across 19 test suites.

**Primary recommendation:** Follow established test patterns exactly — self-contained suites with `testSync`/`testAsync` wrappers, verbose parity-style diagnostics, real file reads against actual project files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All four gray areas delegated to Claude's discretion:

- **Tool name validation:** Validate exact tool names against canonical list (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebSearch`, `WebFetch`) plus accept any `mcp__` prefixed tool name as valid
- **Template path plausibility:** Pattern-based validation only — check `@` references point to `.planning/` with recognized subdirectory patterns
- **Failure diagnostics:** Verbose parity-style format (FILE → EXPECTED → ACTUAL → WHY → EVIDENCE)
- **Test gating:** Always run, no flag gating; register under "Wiring" category in run-all.ts

### Claude's Discretion
All implementation details including exact test structure, helper extraction, import strategies.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGNT-01 | All 11 agent `.md` files parse successfully with Pi SDK's `parseFrontmatter()` | Pi SDK exports `parseFrontmatter` from main entry; accepts generic type parameter for frontmatter shape |
| AGNT-02 | Every agent frontmatter contains required fields `name` and `description` (non-empty strings) | `parseFrontmatter` returns `{ frontmatter, body }` — check fields on frontmatter object |
| AGNT-03 | Every agent frontmatter `name` field matches filename convention (`gsd-{slug}.md` → `name: gsd-{slug}`) | All 11 agents follow this pattern already; test enforces it going forward |
| AGNT-04 | Every agent frontmatter has a `tools` field containing recognized Pi tool names | Tools field is a comma-separated string in YAML or an array; canonical tool list + `mcp__` prefix validation |
| MODL-01 | Every key in `MODEL_PROFILES` has a corresponding `agents/{key}.md` file on disk | `MODEL_PROFILES` is a const object in `core.cjs` with 11 keys; direct comparison to `agents/` directory listing |
| MODL-02 | Every `agents/gsd-*.md` file has a corresponding entry in `MODEL_PROFILES` | Reverse of MODL-01 — catches orphaned agent files |
| MODL-03 | `resolveModelInternal()` returns valid non-empty model string for all 11×3 combinations | Function takes `(cwd, agentType)` and reads config for profile; needs a temp dir with minimal config.json |
| TMPL-01 | `planner-subagent-prompt.md` has no residual `~/.claude/get-shit-done/` paths after rewrite | `GsdPathResolver.rewritePaths()` handles 4 pattern variants |
| TMPL-02 | `debug-subagent-prompt.md` has no residual paths after rewrite | Same rewrite logic |
| TMPL-03 | `@` file references in templates point to plausible `.planning/` directory paths | Templates use `@.planning/STATE.md`, `@.planning/phases/{phase_dir}/...` etc. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mariozechner/pi-coding-agent` | (installed) | `parseFrontmatter` for AGNT tests | Tests what Pi actually sees — same parser Pi uses to load agents |
| `node:assert` | built-in | Assertions | Project convention — no third-party assertion library |
| `node:fs`, `node:path` | built-in | File operations | Zero runtime deps policy |
| `tsx` | 4.x | TypeScript execution | Project convention for running tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `GsdPathResolver` | local | Path rewriting for template tests | Import from `extensions/gsd/path-resolver.ts` |
| `gsd/bin/lib/core.cjs` | local | `MODEL_PROFILES`, `resolveModelInternal` | Import via `require()` or `createRequire` for MODL tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pi SDK `parseFrontmatter` | Local `frontmatter.cjs` parser | Pi SDK is the truth — we want to test what Pi actually sees, not our own parser |
| Direct `require('core.cjs')` | `execSync` to run gsd-tools.cjs | Direct import is simpler, faster, and already used in other tests for shared modules |

## Architecture Patterns

### Test File Organization
```
tests/
├── wiring-agents.test.ts      # AGNT-01 through AGNT-04 (Plan 01-01)
├── wiring-models.test.ts      # MODL-01 through MODL-03 (Plan 01-02)
└── wiring-templates.test.ts   # TMPL-01 through TMPL-03 (Plan 01-03)
```

Category prefix: `wiring-` (new category, registered in run-all.ts as "Wiring")

### Pattern 1: Self-Contained Suite with Requirement Tracing
**What:** Each test file follows the standard pattern — own counters, testSync/testAsync, requirement ID in test name, exit code.
**When to use:** All three test files.
**Example:**
```typescript
import assert from "node:assert";

let passed = 0;
let failed = 0;

function testSync(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err: any) { failed++; console.log(`  ✗ ${name}`); console.log(`    ${err.message}`); }
}

testSync("[AGNT-01] gsd-planner parses successfully", () => { ... });

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
```

### Pattern 2: Iterate Over Agent Files
**What:** Dynamically read `agents/` directory and generate one test per agent per requirement.
**When to use:** AGNT tests and MODL-02.
**Example:**
```typescript
const agentsDir = path.join(PROJECT_ROOT, "agents");
const agentFiles = fs.readdirSync(agentsDir)
  .filter(f => f.startsWith("gsd-") && f.endsWith(".md"))
  .sort();

for (const file of agentFiles) {
  const agentName = file.replace(".md", "");
  testSync(`[AGNT-01] ${agentName} parses with Pi SDK`, () => { ... });
}
```

### Pattern 3: Verbose Parity-Style Diagnostics
**What:** Multi-line error messages with FILE, EXPECTED, ACTUAL, WHY, EVIDENCE fields.
**When to use:** All tests — matches parity-agents.test.ts style.
**Example:**
```typescript
assert.ok(
  fm.name,
  `FILE: tests/wiring-agents.test.ts → name-required [${agentName}]\n` +
  `  EXPECTED: Non-empty 'name' field in frontmatter\n` +
  `  ACTUAL: name is '${fm.name || "(empty)"}'\n` +
  `  WHY: Pi uses 'name' to identify agents for subagent tool dispatch.\n` +
  `  EVIDENCE: Frontmatter keys: ${Object.keys(fm).join(", ")}`
);
```

### Anti-Patterns to Avoid
- **Importing from internal Pi SDK paths** (e.g., `@mariozechner/pi-coding-agent/dist/utils/frontmatter.js`) — use the public export from main entry
- **Mocking file system** — tests should read real agent files (established convention)
- **Sharing state between test files** — each suite must be self-contained

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | Pi SDK `parseFrontmatter` | Tests what Pi actually sees; handles edge cases (empty frontmatter, no frontmatter) |
| Path rewriting | Custom regex replacements | `GsdPathResolver.rewritePaths()` | Already battle-tested in `unit-path-rewrite.test.ts` with 11 passing tests |
| Agent file discovery | Hardcoded list of 11 agents | `fs.readdirSync` with filter | Automatically catches new agents or removed agents |

## Common Pitfalls

### Pitfall 1: CJS Import from ESM TypeScript
**What goes wrong:** `import { MODEL_PROFILES } from '../gsd/bin/lib/core.cjs'` may not work directly.
**Why it happens:** TypeScript with `moduleResolution: "bundler"` and ESM module format can't directly `require()` CJS.
**How to avoid:** Use `createRequire(import.meta.url)` to get a `require` function that works in ESM context:
```typescript
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { MODEL_PROFILES, resolveModelInternal } = require("../gsd/bin/lib/core.cjs");
```
**Warning signs:** "Cannot use require in ES module" or "ERR_REQUIRE_ESM" errors.

### Pitfall 2: Tools Field Format Variance
**What goes wrong:** Agent tools field may be a comma-separated string (`"Read, Write, Bash"`) or a YAML array.
**Why it happens:** Pi SDK's `parseFrontmatter` uses the `yaml` package which handles both formats, but the result type differs.
**How to avoid:** Normalize after parsing — if string, split on `, `; if array, use directly:
```typescript
const tools = Array.isArray(fm.tools) ? fm.tools : String(fm.tools).split(/,\s*/);
```
**Warning signs:** Test passes with one format but fails when someone changes YAML style.

### Pitfall 3: resolveModelInternal Needs a Real Config
**What goes wrong:** Function reads `.planning/config.json` from cwd — calling with project root finds the real config.
**Why it happens:** `resolveModelInternal(cwd, agentType)` calls `loadConfig(cwd)` internally.
**How to avoid:** Use `withTempDir` from lifecycle harness to create a temp dir with minimal config, or pass project root and test against expected default profile ("balanced").
**Warning signs:** Tests pass locally but fail in CI where `.planning/` may not exist.

### Pitfall 4: Template @ References Have Placeholders
**What goes wrong:** Templates contain `@.planning/phases/{phase_dir}/{phase_num}-CONTEXT.md` — the `{phase_dir}` is a placeholder, not a literal path.
**Why it happens:** Templates are fill-in templates, not final resolved paths.
**How to avoid:** For TMPL-03, validate that the base path pattern is plausible (starts with `.planning/`, uses recognized subdirs) without requiring literal path resolution. Strip or ignore `{placeholder}` tokens.
**Warning signs:** Overly strict validation rejects valid template patterns.

## Code Examples

### Importing parseFrontmatter from Pi SDK
```typescript
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";

const content = fs.readFileSync(agentPath, "utf-8");
const { frontmatter, body } = parseFrontmatter<{
  name?: string;
  description?: string;
  tools?: string | string[];
  color?: string;
}>(content);
```

### Importing MODEL_PROFILES from CJS
```typescript
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const core = require("../gsd/bin/lib/core.cjs");
// core.MODEL_PROFILES, core.resolveModelInternal
```

### Agent file iteration
```typescript
const PROJECT_ROOT = path.resolve(__dirname, "..");
const agentsDir = path.join(PROJECT_ROOT, "agents");
const agentFiles = fs.readdirSync(agentsDir)
  .filter((f: string) => f.startsWith("gsd-") && f.endsWith(".md"))
  .sort();
// agentFiles: ["gsd-codebase-mapper.md", "gsd-debugger.md", ...]
```

### Canonical tool validation
```typescript
const CANONICAL_TOOLS = new Set([
  "Read", "Write", "Edit", "Bash", "Grep", "Glob", "WebSearch", "WebFetch"
]);

function isValidTool(tool: string): boolean {
  return CANONICAL_TOOLS.has(tool) || tool.startsWith("mcp__");
}
```

### Template @ reference extraction and validation
```typescript
const AT_REF_PATTERN = /@([^\s]+)/g;
const VALID_PLANNING_PREFIXES = [
  ".planning/STATE.md",
  ".planning/ROADMAP.md", 
  ".planning/REQUIREMENTS.md",
  ".planning/phases/",
  ".planning/research/",
  ".planning/codebase/",
  ".planning/debug/",
];

function isPlausiblePath(ref: string): boolean {
  return VALID_PLANNING_PREFIXES.some(prefix => ref.startsWith(prefix));
}
```

## Open Questions

None — domain is well-understood with HIGH confidence across all areas.

## Sources

### Primary (HIGH confidence)
- Pi SDK source code at `/home/mia/.npm-global/lib/node_modules/@mariozechner/pi-coding-agent/` — verified `parseFrontmatter` export, YAML parsing behavior, type signature
- Project source code — verified all 11 agent files, MODEL_PROFILES structure, template contents, existing test patterns

### Secondary (MEDIUM confidence)
- None needed — all findings verified against source code directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all imports verified against actual package exports and project source
- Architecture: HIGH — follows established patterns from 19 existing test suites  
- Pitfalls: HIGH — identified from actual code analysis (CJS/ESM interop, tools format, config dependency)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain — agent files and test harness rarely change structure)
