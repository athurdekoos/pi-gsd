# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- Custom test harness (no framework dependency — zero runtime deps policy)
- `tsx` 4.x for TypeScript execution
- Node.js `assert` module for assertions

**Assertion Library:**
- Node.js built-in `assert` (`assert.strictEqual`, `assert.ok`, `assert.throws`, `assert.match`)
- No third-party assertion library

**Run Commands:**
```bash
npx tsx tests/run-all.ts              # Run all suites (excludes E2E)
npx tsx tests/run-all.ts --e2e        # Run all suites including E2E
npx tsx tests/{suite-name}.test.ts    # Single suite
```

## Test File Organization

**Location:**
- All tests in `tests/` directory (not collocated with source)
- Harness infrastructure in `tests/harness/`
- Test helpers in `tests/helpers/`

**Naming:**
- `{category}-{name}.test.ts` for test files
- Categories: `unit-`, `intg-` (integration), `parity-`, `compliance-`, `e2e-`, `runtime-`, `harness-`

**Structure:**
```
tests/
├── harness/
│   ├── diagnostic.ts       # Test result formatting (formatSummary, formatFailure)
│   ├── lifecycle.ts        # Temp dirs, env snapshots (withTempDir, saveEnv, restoreEnv)
│   ├── mock-api.ts         # MockExtensionAPI for extension testing
│   ├── mock-context.ts     # Mock context creation
│   └── pi-rpc.ts          # Pi RPC integration helpers
├── helpers/
│   └── upstream-resolver.ts
├── unit-frontmatter.test.ts
├── unit-exec-context.test.ts
├── unit-path-rewrite.test.ts
├── intg-loading.test.ts
├── intg-commands.test.ts
├── intg-events.test.ts
├── intg-tui-output.test.ts
├── intg-edge-cases.test.ts
├── parity-files.test.ts
├── parity-agents.test.ts
├── compliance.test.ts
├── e2e-smoke.test.ts
├── runtime-wiring.test.ts
├── runtime-hooks.test.ts
├── runtime-isolation.test.ts
├── harness-mock.test.ts
├── harness-util.test.ts
├── command-loading.test.ts   # Legacy
├── path-resolver.test.ts     # Legacy
└── run-all.ts               # Unified runner
```

## Test Structure

**Suite Organization:**
```typescript
import assert from "node:assert";

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

// --- Tests ---
testSync("CMPL-01: descriptive test name", () => {
  // test body
  assert.strictEqual(actual, expected);
});

// --- Report ---
console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
```

**Patterns:**
- Each suite is self-contained (no shared global state between suites)
- `testSync` / `testAsync` wrappers catch errors, count pass/fail
- Test IDs follow requirement tracing: `CMPL-01`, `E2E-01`, etc.
- Setup/teardown via `saveEnv()`/`restoreEnv()` and `withTempDir()`
- Exit code 1 on any failure

## Mocking

**Framework:**
- Custom `MockExtensionAPI` in `tests/harness/mock-api.ts`
- No generic mocking library

**Patterns:**
```typescript
// Extension API mock
const api = new MockExtensionAPI();
extensionFactory(api as any);

// Access registered commands
const commands = api.getCommands();

// Access registered event handlers
const handlers = api.getHandlers("before_agent_start");
```

**What to Mock:**
- Pi ExtensionAPI (always — never call real Pi in unit/integration tests)
- File system via temporary directories (`withTempDir`)
- Environment variables via `saveEnv()`/`restoreEnv()`

**What NOT to Mock:**
- gsd-tools.cjs (tested via real `execSync` calls in integration tests)
- File system reads within temp dirs (use real files)

## Fixtures and Factories

**Test Data:**
- Temp directories created via `withTempDir()` from `tests/harness/lifecycle.ts`
- Command `.md` files read from actual `commands/gsd/` directory
- Agent `.md` files read from actual `agents/` directory
- No dedicated fixtures directory — tests use real project files or create temp files inline

**Location:**
- Test utilities: `tests/harness/` (shared across all suites)
- Test helpers: `tests/helpers/` (specialized utilities)

## Coverage

**Requirements:**
- No coverage tool configured
- No coverage targets
- Coverage assessed qualitatively through test category breadth

**Test Categories (19 suites):**
- Harness (2) — Validate test infrastructure itself
- Unit (3) — Path rewriting, execution context, frontmatter parsing
- Integration (5) — Command loading, events, TUI output, edge cases
- Parity (2) — Command ↔ workflow file parity, agent ↔ model profile parity
- Compliance (1) — Pi SDK contract validation
- E2E (1) — Real Pi process smoke test (gated behind `--e2e` flag)
- Runtime (3) — Real Pi process wiring, hooks, isolation
- Legacy (2) — Older tests retained for backward compatibility

## Test Types

**Unit Tests (`unit-*.test.ts`):**
- Scope: Individual functions in isolation (path rewriting rules, frontmatter parsing)
- Speed: Milliseconds per test
- Examples: `unit-path-rewrite.test.ts` tests all 4 path rewrite rules

**Integration Tests (`intg-*.test.ts`):**
- Scope: Extension loading + command registration + event handling
- Uses: `MockExtensionAPI`, temp directories
- Examples: `intg-commands.test.ts` verifies all `/gsd:*` commands register correctly

**Parity Tests (`parity-*.test.ts`):**
- Scope: Cross-file consistency checks
- Purpose: Every command has a workflow, every agent has a model profile entry
- Examples: `parity-files.test.ts` checks `commands/gsd/*.md` ↔ `gsd/workflows/*.md`

**Compliance Tests (`compliance.test.ts`):**
- Scope: Pi Extension SDK contract validation
- Purpose: Valid event names, correct handler shapes, proper manifest
- Checks: 28 valid Pi events, factory export pattern, package.json structure

**E2E Tests (`e2e-smoke.test.ts`):**
- Scope: Full Pi process with extension loaded
- Gated: `--e2e` flag required, skips if Pi not installed
- Purpose: Verify extension loads and commands register in real runtime

**Runtime Tests (`runtime-*.test.ts`):**
- Scope: Real Pi process behavior — wiring, hooks, isolation
- Mandatory: Not gated (unlike E2E)

## Common Patterns

**Unified Runner:**
```typescript
// tests/run-all.ts orchestrates all 19 suites
// Outputs AI-readable summary via formatSummary()
// Exit code: 0 all pass, 1 any fail
```

**Temp Directory Testing:**
```typescript
import { withTempDir } from "./harness/lifecycle.js";

testAsync("test with temp dir", async () => {
  await withTempDir(async (tmpDir) => {
    // tmpDir is a fresh temporary directory
    // cleaned up after callback returns
  });
});
```

**Environment Snapshot:**
```typescript
import { saveEnv, restoreEnv } from "./harness/lifecycle.js";

const snap = saveEnv();
// ... test modifies process.env ...
restoreEnv(snap);
```

---

*Testing analysis: 2026-03-05*
*Update when test patterns change*
