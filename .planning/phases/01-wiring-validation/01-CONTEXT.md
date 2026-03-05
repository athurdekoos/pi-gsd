# Phase 1: Wiring Validation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Fast unit tests that validate all 11 agent definitions are correctly structured (frontmatter fields, tool names, name↔filename parity), model profile resolution works for every agent×profile combination (11×3 = 33), and both prompt templates resolve paths properly after `GsdPathResolver.rewritePaths()` runs. All tests run without API calls.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All four gray areas were delegated to Claude's judgment. Decisions below are based on established codebase patterns and pragmatic tradeoffs.

**Tool name validation strictness (AGNT-04):**
- Validate exact tool names against the canonical list used in compliance.test.ts (`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebSearch`, `WebFetch`)
- Accept any `mcp__` prefixed tool name as valid (wildcard pattern — agents use `mcp__context7__*` which means specific MCP tools will vary)
- This catches real typos (e.g., `Reads`, `bash`) while not breaking when new MCP integrations are added
- Fail on completely unrecognized tool names that don't match either the canonical list or the `mcp__` prefix

**Template path plausibility (TMPL-03):**
- Check that `@` file references resolve to paths under `.planning/` with recognized subdirectory patterns (`phases/`, `research/`, `codebase/`)
- Pattern-based validation only — don't create fixture directories or verify file existence
- Sufficient to catch broken path references (e.g., residual upstream paths, typos in directory names)

**Failure diagnostic depth:**
- Follow the verbose parity test style: FILE → EXPECTED → ACTUAL → WHY → EVIDENCE
- These wiring tests serve the same "catch drift" purpose as `parity-agents.test.ts` and `parity-files.test.ts`
- When a wiring test fails in CI, the output should immediately identify which agent broke, which field was wrong, and why it matters

**Test gating in run-all.ts:**
- Always run — no flag gating
- Tests are fast (pure file reads, no API calls) and catch real breakage
- Register in SUITES array under categories matching the plan split (e.g., "Wiring" category)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parity-agents.test.ts`: Reads all agent `.md` files, iterates over them, checks content — same traversal pattern needed for AGNT tests
- `unit-frontmatter.test.ts`: Has a local `parseCommand()` for command frontmatter — agents use different frontmatter (name, description, tools, color) parsed by Pi SDK's `parseFrontmatter()`
- `unit-path-rewrite.test.ts`: Tests `GsdPathResolver.rewritePaths()` thoroughly — TMPL tests can import same resolver
- `compliance.test.ts`: Contains canonical Pi tool/event lists — reference for valid tool names
- `tests/harness/lifecycle.ts`: `withTempDir`, `saveEnv`, `restoreEnv` — may be useful for template tests needing config setup
- `tests/harness/diagnostic.ts`: `formatSummary`, `formatFailure` — used by run-all.ts

### Established Patterns
- Self-contained suites: each test file has its own `passed`/`failed` counters, `testSync`/`testAsync` wrappers, and exit code
- Requirement tracing: test names prefixed with requirement ID (e.g., `[AGNT-01]`, `[MODL-02]`)
- Real file reads: tests read actual agent/command files from disk (not mocked copies)
- CJS import strategy: `gsd/bin/lib/core.cjs` exports `MODEL_PROFILES` and `resolveModelInternal` — importable via `require()` or dynamic `import()` from TypeScript

### Integration Points
- `tests/run-all.ts` SUITES array: new test files must be registered here
- `agents/*.md`: read at test time for frontmatter validation
- `gsd/bin/lib/core.cjs`: read at test time for MODEL_PROFILES and resolveModelInternal
- `gsd/templates/planner-subagent-prompt.md` and `gsd/templates/debug-subagent-prompt.md`: read at test time for path resolution checks
- `extensions/gsd/path-resolver.ts`: imported for GsdPathResolver in template tests

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established test conventions.

Key reference points from existing tests:
- `parity-agents.test.ts` verbose error format is the gold standard for diagnostic messages
- `unit-path-rewrite.test.ts` shows how to import and use GsdPathResolver from test code
- PROJECT.md specifies: "Import Pi SDK's `parseFrontmatter()` directly (test what Pi actually sees)"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-wiring-validation*
*Context gathered: 2026-03-05*
