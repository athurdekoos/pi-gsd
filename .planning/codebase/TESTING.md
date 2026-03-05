# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- Custom test runner (`tests/run-all.ts`)
- Node.js built-in `assert` module for assertions
- `tsx` for TypeScript execution without compilation

**Assertion Library:**
- `node:assert` (strict mode)

**Run Commands:**
```bash
npx tsx tests/run-all.ts           # Run all tests (except E2E)
npx tsx tests/compliance.test.ts   # Run single test file
npx tsx tests/e2e-smoke.test.ts --e2e  # Run E2E (requires pi binary)
```

## Test File Organization

**Location:**
- All tests in `tests/` directory (separate from source)
- Test harness infrastructure in `tests/harness/`
- Test helpers in `tests/helpers/`

**Naming:**
- `{scope}-{domain}.test.ts` (e.g., `compliance.test.ts`, `intg-commands.test.ts`)
- Scopes: `compliance`, `e2e`, `parity`, `intg` (integration), `unit`, `harness`

**Structure:**
```
tests/
├── harness/
│   ├── mock-api.ts          # MockExtensionAPI — simulates Pi ExtensionAPI
│   ├── mock-context.ts      # createMockContext() — simulates ExtensionContext
│   ├── diagnostic.ts        # formatFailure() — structured test error messages
│   └── lifecycle.ts         # saveEnv/restoreEnv, withTempDir for isolation
├── helpers/
│   └── upstream-resolver.ts # Resolves upstream GSD paths for parity tests
├── run-all.ts               # Test runner (glob discovers *.test.ts)
├── compliance.test.ts       # Pi SDK contract validation (CMPL-01..07)
├── e2e-smoke.test.ts        # End-to-end smoke tests (E2E-01..02)
├── parity-agents.test.ts    # Agent file parity with upstream
├── parity-files.test.ts     # File parity with upstream
├── command-loading.test.ts  # Command discovery and registration
├── path-resolver.test.ts    # GsdPathResolver transform pipeline
├── intg-commands.test.ts    # Integration: command handler invocation
├── intg-edge-cases.test.ts  # Integration: edge case handling
├── intg-events.test.ts      # Integration: event handler behavior
├── intg-loading.test.ts     # Integration: extension loading scenarios
├── intg-tui-output.test.ts  # Integration: TUI output formatting
├── unit-exec-context.test.ts    # Unit: execution context building
├── unit-frontmatter.test.ts     # Unit: frontmatter parsing
├── unit-path-rewrite.test.ts    # Unit: path rewriting rules
├── harness-mock.test.ts     # Validates mock harness itself
└── harness-util.test.ts     # Validates harness utilities
```

## Test Structure

**Suite Organization:**
```typescript
// Standard pattern across all test files
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
  // Same pattern but async
}

// Tests use requirement IDs: CMPL-01, E2E-01, PATH-01, etc.
testSync("CMPL-01: extension subscribes only to valid events", () => {
  // ...
});

// Summary at end
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
```

**Patterns:**
- Each test file has its own `passed`/`failed` counters and runner
- Test names include requirement IDs for traceability
- `run-all.ts` discovers and executes all files, aggregating exit codes

## Mocking

**Framework:** Custom mock classes in `tests/harness/`

**Patterns:**
```typescript
// MockExtensionAPI (tests/harness/mock-api.ts)
const api = new MockExtensionAPI();
extensionFactory(api as any);  // Load extension with mock

// Access registered state
api.subscriptions;    // Map<string, Function[]> — event handlers
api.commands;         // Map<string, { description, handler }> — commands
api.sentMessages;     // string[] — messages sent via sendUserMessage
```

```typescript
// Mock context (tests/harness/mock-context.ts)
const ctx = createMockContext({
  cwd: "/tmp/test-project",
  hasPlanning: true,
  hasState: true,
});
```

**What to Mock:**
- Pi ExtensionAPI (`pi.on()`, `pi.registerCommand()`, `pi.sendUserMessage()`)
- ExtensionContext (`ctx.ui`, `ctx.cwd`, `ctx.sessionManager`)
- Filesystem state (`.planning/` directory presence via `withTempDir()`)
- Environment variables (via `saveEnv()`/`restoreEnv()`)

**What NOT to Mock:**
- `gsd-tools.cjs` operations — test against real filesystem in temp directories
- `GsdPathResolver` class — test the actual transform pipeline
- Git operations — use real git in temp repos where needed

## Fixtures and Factories

**Test Data:**
```typescript
// Environment isolation (tests/harness/lifecycle.ts)
const envSnap = saveEnv();
// ... test runs ...
restoreEnv(envSnap);

// Temp directory with cleanup
await withTempDir(async (dir) => {
  // dir is a fresh temporary directory
  // automatically cleaned up after callback
});
```

**Location:**
- Mock classes: `tests/harness/`
- No separate fixtures directory — test data created inline

## Coverage

**Requirements:** None enforced — no coverage tooling configured

**View Coverage:**
- Not available — no coverage tool (istanbul, c8, etc.) configured

## Test Types

**Unit Tests:**
- Scope: Individual functions and classes
- Files: `unit-*.test.ts`
- Examples: `unit-frontmatter.test.ts` (frontmatter parsing), `unit-path-rewrite.test.ts` (path rewriting rules)

**Integration Tests:**
- Scope: Extension loading, command registration, event handling
- Files: `intg-*.test.ts`
- Examples: `intg-commands.test.ts` (command handler invocation), `intg-events.test.ts` (event handler behavior)

**Compliance Tests:**
- Scope: Pi SDK contract validation
- Files: `compliance.test.ts`
- Examples: CMPL-01 (valid event names), CMPL-02 (handler return shapes), CMPL-03 (package manifest)

**Parity Tests:**
- Scope: File-level consistency with upstream GSD repository
- Files: `parity-*.test.ts`
- Examples: Agent file existence/content parity, workflow file parity

**E2E Tests:**
- Scope: Full Pi process with extension loaded
- Files: `e2e-smoke.test.ts`
- Gated: `--e2e` flag required (skips if pi binary not found)
- Examples: E2E-01 (extension loads without crash), E2E-02 (commands discoverable)

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
```

**Error Testing:**
```typescript
testSync("rejects invalid config", () => {
  assert.throws(() => {
    someFunction(invalidInput);
  }, /expected error pattern/);
});
```

**Diagnostic Messages:**
```typescript
// tests/harness/diagnostic.ts
import { formatFailure } from "./harness/diagnostic.js";

assert.ok(condition, formatFailure({
  file: "extensions/gsd/index.ts",
  expected: "Extension loads without error",
  actual: "Got error: ...",
  why: "Requirement CMPL-01 requires valid event subscriptions",
  evidence: actualOutput.substring(0, 300),
}));
```

---

*Testing analysis: 2026-03-05*
