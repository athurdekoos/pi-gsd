# Testing

> **Key Takeaways:**
> - 16 test suites across 5 categories: Harness, Unit, Integration, Parity, Compliance, E2E
> - Custom test runner (`tests/run-all.ts`) — no jest/mocha/vitest
> - Assertions via `node:assert` (strict mode)
> - Mock Pi API (`MockExtensionAPI`) for integration tests
> - E2E tests gated behind `--e2e` flag (requires Pi binary)

## Running Tests

```bash
# Run all tests (except E2E)
npx tsx tests/run-all.ts

# Run all tests including E2E
npx tsx tests/run-all.ts --e2e

# Run a single test file
npx tsx tests/compliance.test.ts

# Run a single test file with verbose output
npx tsx tests/unit-frontmatter.test.ts
```

## Test Organization

```
tests/
├── run-all.ts                   # Test runner (explicit suite list)
├── harness/
│   ├── mock-api.ts              # MockExtensionAPI — Pi API simulator
│   ├── mock-context.ts          # createMockContext() — ExtensionContext simulator
│   ├── diagnostic.ts            # formatSummary() — structured test output
│   └── lifecycle.ts             # saveEnv/restoreEnv, withTempDir
├── helpers/
│   └── upstream-resolver.ts     # Resolves upstream GSD paths for parity
├── harness-mock.test.ts         # Validates mock harness itself
├── harness-util.test.ts         # Validates harness utilities
├── unit-path-rewrite.test.ts    # Path resolver rewrite rules
├── unit-exec-context.test.ts    # Execution context transformation
├── unit-frontmatter.test.ts     # Frontmatter parsing
├── intg-loading.test.ts         # Extension loading scenarios
├── intg-commands.test.ts        # Command registration + invocation
├── intg-events.test.ts          # Event handler behavior
├── intg-tui-output.test.ts      # TUI output formatting
├── intg-edge-cases.test.ts      # Edge case handling
├── parity-files.test.ts         # File parity with upstream GSD
├── parity-agents.test.ts        # Agent parity with upstream
├── compliance.test.ts           # Pi SDK contract validation
├── command-loading.test.ts      # Command discovery (legacy)
├── path-resolver.test.ts        # Path resolver (legacy)
└── e2e-smoke.test.ts            # End-to-end smoke tests
```

## Test Categories

### Harness Tests
Validate the test infrastructure itself:
- `harness-mock.test.ts` — MockExtensionAPI records subscriptions, commands, messages correctly
- `harness-util.test.ts` — saveEnv/restoreEnv, withTempDir work correctly

### Unit Tests
Test individual functions in isolation:
- `unit-path-rewrite.test.ts` — All 4 path rewrite rules
- `unit-exec-context.test.ts` — `<execution_context>` block transformation
- `unit-frontmatter.test.ts` — YAML frontmatter parsing and reconstruction

### Integration Tests
Test the extension with MockExtensionAPI:
- `intg-loading.test.ts` — Extension loads successfully, registers events + commands
- `intg-commands.test.ts` — Command handlers produce correct transformed messages
- `intg-events.test.ts` — Event handlers fire correctly and modify events
- `intg-tui-output.test.ts` — TUI-related output formatting
- `intg-edge-cases.test.ts` — Missing files, empty bodies, malformed frontmatter

### Parity Tests
Verify pi-gtd stays in sync with upstream GSD:
- `parity-files.test.ts` — All expected files exist
- `parity-agents.test.ts` — Agent files match expected set

### Compliance Tests
Validate the Pi Extension API contract:
- `compliance.test.ts` — Tests CMPL-01 through CMPL-07:
  - CMPL-01: Extension exports a default function
  - CMPL-02: Function accepts ExtensionAPI parameter
  - CMPL-03: Commands registered correctly
  - CMPL-04: Events subscribed correctly
  - CMPL-05: No disallowed Pi API usage
  - CMPL-06: Event handlers return correct shapes
  - CMPL-07: sendUserMessage called correctly

### E2E Tests
Full end-to-end with actual Pi binary (gated behind `--e2e`):
- `e2e-smoke.test.ts` — Extension loads in real Pi, commands resolve

## Mock API (`tests/harness/mock-api.ts`)

```typescript
class MockExtensionAPI {
  subscriptions: Map<string, Function[]>;  // Event handlers
  commands: Map<string, {description, handler}>;  // Registered commands
  messages: Array<{content, options}>;  // sendUserMessage calls

  on(event, handler): void;
  registerCommand(name, opts): void;
  sendUserMessage(content, options?): void;
  async fireEvent(event, ...args): Promise<any>;  // Trigger handlers
}
```

**Usage in tests:**
```typescript
import { MockExtensionAPI } from "./harness/mock-api.js";
import gsdExtension from "../extensions/gsd/index.js";

const api = new MockExtensionAPI();
gsdExtension(api as any);

// Verify commands registered
assert(api.commands.has("gsd:plan-phase"));

// Fire events
const result = await api.fireEvent("tool_call", { toolName: "bash", input: { command: "..." } });
```

## Test Output Format

Tests produce structured output parsed by `run-all.ts`:

```
Running compliance.test.ts...
  ✓ CMPL-01: exports default function
  ✓ CMPL-02: accepts ExtensionAPI parameter
  ✗ CMPL-03: commands registered
    Expected 31 commands, got 30

Results: 2 passed, 1 failed out of 3 tests
```

## Writing a New Test

1. Create `tests/my-test.test.ts`
2. Add to `SUITES` array in `tests/run-all.ts`
3. Follow the pattern:

```typescript
import assert from "node:assert/strict";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n    ${e}`); }
}

test("my test", () => {
  assert.equal(1 + 1, 2);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

## Test Coverage Gaps

⚠️ **Major gap:** `gsd/bin/lib/*.cjs` commands have no dedicated unit tests. Only parity tests verify file existence. All state management, phase operations, roadmap parsing, and verification logic is untested.

See `.planning/codebase/CONCERNS.md` (at repo root) for the full coverage analysis.
