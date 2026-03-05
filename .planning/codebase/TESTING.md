# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- Custom test runner (`tests/run-all.ts`) — no jest, mocha, or vitest
- Each test file is a standalone script with its own pass/fail counters
- Runner executes each suite as a child process via `execSync`, parses structured output

**Assertion Library:**
- `node:assert` (strict mode)
- Common matchers: `assert.strictEqual`, `assert.ok`, `assert.deepStrictEqual`, `assert.throws`

**Run Commands:**
```bash
npx tsx tests/run-all.ts               # Run all 16 suites (except E2E)
npx tsx tests/run-all.ts --e2e         # Run all suites including E2E
npx tsx tests/compliance.test.ts       # Run a single suite
```

## Test File Organization

**Location:**
- All tests in `tests/` directory (separate from source)
- Test infrastructure in `tests/harness/` (4 files)
- Test helpers in `tests/helpers/` (1 file)

**Naming:**
- Category prefix + descriptive name: `{category}-{name}.test.ts`
- Categories: `unit-*`, `intg-*`, `parity-*`, `e2e-*`, plus `compliance.test.ts`
- Legacy tests: `path-resolver.test.ts`, `command-loading.test.ts` (no category prefix)
- Harness self-tests: `harness-mock.test.ts`, `harness-util.test.ts`

**Structure:**
```
tests/
├── run-all.ts                    # Unified test runner
├── harness/
│   ├── mock-api.ts               # MockExtensionAPI
│   ├── mock-context.ts           # createMockContext(), createMockCommandContext()
│   ├── diagnostic.ts             # formatSummary(), formatFailure()
│   └── lifecycle.ts              # saveEnv(), restoreEnv(), withTempDir()
├── helpers/
│   └── upstream-resolver.ts      # Resolves upstream GSD for parity tests
├── harness-mock.test.ts          # Harness self-validation
├── harness-util.test.ts          # Harness utility tests
├── unit-path-rewrite.test.ts     # Path resolver rules
├── unit-exec-context.test.ts     # Execution context transform
├── unit-frontmatter.test.ts      # Frontmatter parsing
├── intg-loading.test.ts          # Extension load behavior
├── intg-commands.test.ts         # Command registration + invocation
├── intg-events.test.ts           # Lifecycle event handlers
├── intg-tui-output.test.ts       # TUI output formatting
├── intg-edge-cases.test.ts       # Error/edge case handling
├── parity-files.test.ts          # File presence vs upstream
├── parity-agents.test.ts         # Agent parity vs upstream
├── compliance.test.ts            # Pi SDK contract validation
├── path-resolver.test.ts         # Legacy path resolver tests
├── command-loading.test.ts       # Legacy command loading tests
└── e2e-smoke.test.ts             # E2E with real Pi binary
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

// --- Tests grouped by section ---
console.log("\nSection name:\n");

testSync("UNIT-01: descriptive test name", () => {
  const result = functionUnderTest(input);
  assert.strictEqual(result, expected);
});

// --- Results ---
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Patterns:**
- Requirement IDs in test names: `UNIT-01`, `CMPL-03`, `INTG-06`, `PRTY-01`
- Section headers with `console.log("\nSection:\n")` for grouping
- Both `testSync` and `testAsync` helpers defined per file (not shared)
- No `beforeEach`/`afterEach` — environment saved/restored manually
- Explicit pass/fail counters with structured output line format

## Mocking

**Framework:**
- Custom mocks — no mocking library
- `MockExtensionAPI` class in `tests/harness/mock-api.ts`
- `createMockContext()` / `createMockCommandContext()` in `tests/harness/mock-context.ts`

**Patterns:**
```typescript
// Create mock Pi API
import { MockExtensionAPI } from "./harness/mock-api.js";
const api = new MockExtensionAPI();

// Load extension (registers commands, subscribes to events)
import extensionFactory from "../extensions/gsd/index.js";
extensionFactory(api as any);

// Verify registrations
assert.ok(api.commands.has("gsd:plan-phase"));
assert.ok(api.subscriptions.has("before_agent_start"));

// Fire events and inspect results
const result = await api.fireEvent("tool_call", {
  toolName: "bash",
  input: { command: 'node "$GSD_HOME/bin/gsd-tools.cjs" state load' }
});

// Check recorded messages
await api.commands.get("gsd:help")!.handler("", ctx);
assert.ok(api.messages[0].content.includes("GSD"));
```

**What to Mock:**
- Pi Extension API (`MockExtensionAPI` — records subscriptions, commands, messages)
- Execution context (`createMockContext` — provides cwd, UI recording)
- Environment variables (`saveEnv`/`restoreEnv` for GSD_HOME isolation)
- Temp directories (`withTempDir` — creates isolated `.planning/` for tests)

**What NOT to Mock:**
- `GsdPathResolver` — tested with real instance (uses actual filesystem paths)
- File I/O in path resolver — reads real command `.md` files
- `gsd-tools.cjs` — not mocked; CLI layer has no dedicated tests

## Fixtures and Factories

**Test Data:**
```typescript
// Environment snapshots for isolation
const envSnap = saveEnv();
// ... run tests ...
restoreEnv(envSnap);

// Temp directory with .planning/ scaffolding
await withTempDir(async (dir) => {
  // dir has .planning/ pre-created
  fs.writeFileSync(path.join(dir, ".planning", "STATE.md"), "---\n...\n---");
  // test code
});
// auto-cleaned up

// Mock context factory
const ctx = createMockContext({ cwd: "/tmp/test-project" });
ctx.ui.statusCalls; // [] — inspect after handler runs
```

**Location:**
- All factory functions in `tests/harness/` (shared infrastructure)
- No separate fixtures directory
- Inline test data for simple cases

## Coverage

**Requirements:**
- No enforced coverage target
- No coverage tooling configured
- Coverage tracked informally via requirement IDs (UNIT-01, CMPL-07, etc.)

**View Coverage:**
```bash
# No coverage report command — not configured
# Test completeness tracked via requirement IDs in test names
```

## Test Categories

**Harness Tests (2 suites):**
- Validate the test infrastructure itself works correctly
- MockExtensionAPI: subscription recording, command recording, message recording, fireEvent
- Lifecycle helpers: saveEnv/restoreEnv, withTempDir cleanup

**Unit Tests (3 suites):**
- Test isolated functions from `extensions/gsd/path-resolver.ts`
- Path rewriting: 4 rules with positive, negative, edge cases
- Execution context transformation: `<execution_context>` block processing
- Frontmatter parsing: extraction, reconstruction, edge cases

**Integration Tests (5 suites):**
- Test extension behavior with MockExtensionAPI
- Loading: extension factory executes, commands and events register
- Commands: handler invocation, sendUserMessage, hot-reload, path rewriting
- Events: before_agent_start prompt injection, tool_call rewriting, session_start status
- TUI: output formatting, status indicators
- Edge cases: missing files, empty content, malformed frontmatter

**Parity Tests (2 suites):**
- Verify pi-gsd stays in sync with upstream GSD project
- File presence: every expected file exists in pi-gsd
- Agent parity: agent files match expected set
- Uses `tests/helpers/upstream-resolver.ts` to locate upstream

**Compliance Tests (1 suite):**
- Validate Pi Extension SDK contract adherence
- 7 compliance checks (CMPL-01 through CMPL-07)
- Valid event names, correct handler return shapes, proper factory export

**E2E Tests (1 suite, gated):**
- Require `--e2e` flag and Pi binary in PATH
- Spawn real Pi process, verify extension loads and commands resolve
- Skipped in normal test runs

## Common Patterns

**Async Testing:**
```typescript
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

await testAsync("fires event correctly", async () => {
  const result = await api.fireEvent("before_agent_start", event, ctx);
  assert.ok(result.systemPrompt.includes("GSD"));
});
```

**Error Testing:**
```typescript
testSync("handles missing file gracefully", () => {
  // Extension should not throw when file missing
  const api = new MockExtensionAPI();
  // Load extension with missing gsd/ — should return without crashing
  extensionFactory(api as any);
});
```

**Structured Output (parsed by run-all.ts):**
```
  ✓ UNIT-01: replaces @~/.claude/get-shit-done/ with actual gsdHome
  ✗ UNIT-02: replaces $HOME path
    Expected "foo", got "bar"

7 passed, 1 failed
```

**Test Runner Output:**
```
Running pi-gsd test suites...

Running compliance.test.ts...
  ✓ compliance

Running unit-path-rewrite.test.ts...
  ✓ unit-path-rewrite

Total: 87 passed, 0 failed
1234ms
```

---

*Testing analysis: 2026-03-05*
*Update when test patterns change*
