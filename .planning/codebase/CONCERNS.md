# Codebase Concerns

**Analysis Date:** 2026-03-05

## Tech Debt

**Custom YAML Parser:**
- Issue: `gsd/bin/lib/frontmatter.cjs:extractFrontmatter()` implements a custom YAML parser instead of using a standard library (e.g., `js-yaml`)
- Files: `gsd/bin/lib/frontmatter.cjs`
- Impact: May fail on valid YAML edge cases (multi-line strings, anchors, complex nesting >3 levels). The custom parser handles basic key-value, arrays, and 2-level nesting but has known limitations.
- Fix approach: Consider replacing with `js-yaml` for more robust parsing, or document exact YAML subset supported

**Dual Path System:**
- Issue: GSD was originally designed for `~/.claude/get-shit-done/` (Claude Code) and path-resolver rewrites 4 different path patterns to the actual install location
- Files: `extensions/gsd/path-resolver.ts`, all workflow `.md` files, all agent `.md` files
- Impact: Every markdown file uses `$GSD_HOME/` or `@~/.claude/get-shit-done/` paths that must be rewritten at runtime. New content must remember to use the canonical path form.
- Fix approach: Consider updating all markdown files to use a simpler path convention, reducing the 4-rule rewrite to 1

**No Package Lock:**
- Issue: No `package-lock.json` committed
- Files: `package.json`
- Impact: `npm install` may produce different dependency trees across environments. Low risk since only devDependencies (`tsx`, `typescript`).
- Fix approach: Commit `package-lock.json`

## Known Bugs

**None identified from static analysis.**

## Security Considerations

**Secret Exposure in Generated Documents:**
- Risk: Codebase mapper agents could accidentally include secrets from `.env` files in `.planning/codebase/` documents, which get committed to git
- Files: `agents/gsd-codebase-mapper.md` (has `<forbidden_files>` section), `gsd/workflows/map-codebase.md` (has `scan_for_secrets` step)
- Current mitigation: Agent instructions include forbidden file list; workflow includes grep-based secret scanning before commit
- Recommendations: Secret scanning could be more robust — current regex misses some patterns

**Brave API Key Storage:**
- Risk: Brave Search API key stored in plaintext at `~/.gsd/brave_api_key`
- Files: `gsd/bin/lib/init.cjs`, `gsd/bin/lib/config.cjs`
- Current mitigation: File is in user home directory, not in project
- Recommendations: Consider using OS keychain or encrypted storage

**Git Commit of Planning Artifacts:**
- Risk: `.planning/` directory may contain sensitive information (research results, internal decisions, todos)
- Files: `gsd/bin/lib/commands.cjs:cmdCommit()`
- Current mitigation: `commit_docs: false` config option + gitignore check via `isGitIgnored()`
- Recommendations: Default should perhaps be `false` for new projects, or at minimum warn on first commit

## Performance Bottlenecks

**Synchronous File Operations:**
- Problem: All `gsd/bin/lib/*.cjs` modules use `fs.readFileSync()` and `fs.writeFileSync()` exclusively
- Files: All `gsd/bin/lib/*.cjs`
- Cause: CLI tool runs as short-lived process — async overhead not justified
- Improvement path: Not a concern for CLI usage pattern. Would matter if used as a library.

**Full File Re-read on Every State Update:**
- Problem: `writeStateMd()` reads, parses, rebuilds frontmatter, and writes the entire `STATE.md` on every update
- Files: `gsd/bin/lib/state.cjs:writeStateMd()`, `buildStateFrontmatter()`
- Cause: STATE.md frontmatter sync requires full parse to keep YAML frontmatter in sync with markdown body
- Improvement path: STATE.md is typically <5KB — not a real bottleneck, but the pattern would be expensive if file grew large

## Fragile Areas

**Phase Renumbering (`cmdPhaseRemove`):**
- Files: `gsd/bin/lib/phase.cjs:cmdPhaseRemove()`
- Why fragile: Renames directories AND files AND updates ROADMAP.md references AND STATE.md — multi-file atomic operation with regex-based text replacement
- Safe modification: Test with multiple phase types (integer, decimal, letter-suffix) before changing
- Test coverage: Limited — parity tests cover existence but not behavior

**Roadmap Parsing:**
- Files: `gsd/bin/lib/roadmap.cjs`, `gsd/bin/lib/core.cjs:getRoadmapPhaseInternal()`
- Why fragile: Depends on specific markdown heading patterns (`### Phase N: Name`), checkbox patterns, table formats. User-edited ROADMAP.md may not match expected format.
- Safe modification: Add regex validation tests for all expected patterns
- Test coverage: No dedicated roadmap parsing tests found

**STATE.md Field Extraction:**
- Files: `gsd/bin/lib/state.cjs:stateExtractField()`, `stateReplaceField()`
- Why fragile: Uses regex to find `**Field:** value` or `Field: value` patterns. Both bold and plain formats must be supported. Adding new field formats would require updating all extraction logic.
- Safe modification: Always use `writeStateMd()` for writes (maintains frontmatter sync)
- Test coverage: `unit-frontmatter.test.ts` covers parsing but not field extraction from STATE.md body

**Path Resolver Transform Pipeline:**
- Files: `extensions/gsd/path-resolver.ts`
- Why fragile: Order of 4 rewrite rules matters (Rule 1 before Rule 3 to prevent `@~` partial match). Changing one rule may break others.
- Safe modification: Tests exist in `path-resolver.test.ts` and `unit-path-rewrite.test.ts` — run after any changes
- Test coverage: Good — dedicated test file covers all 4 rules

## Scaling Limits

**File-Based State:**
- Current capacity: Works well for projects with <100 phases, <500 plans
- Limit: `readdirSync()` + file parsing on every init call. O(n) directory scans for phase lookup.
- Scaling path: For very large projects, consider an index file or SQLite for state

**Single-Process CLI:**
- Current capacity: `gsd-tools.cjs` spawns, runs, exits — designed for short-lived invocations
- Limit: Each invocation re-reads config, state, and roadmap from disk
- Scaling path: Current design is correct for CLI usage pattern — no change needed

## Dependencies at Risk

**No external runtime dependencies** — the codebase uses only Node.js built-ins.

**DevDependencies:**
- `tsx` — Actively maintained, low risk
- `typescript` — Stable, low risk

**Host dependency:**
- `@mariozechner/pi-coding-agent` — Primary dependency. Changes to Pi Extension API (event names, handler signatures, registerCommand interface) would require updates. Compliance tests (`compliance.test.ts`) validate the contract.

## Missing Critical Features

**No Automated Tests for gsd-tools.cjs:**
- Problem: The 80+ commands in `gsd-tools.cjs` have no dedicated unit tests — only parity tests checking file existence
- Blocks: Safe refactoring of CLI tool logic
- Priority: High — core business logic untested

**No Schema Validation for Config:**
- Problem: `.planning/config.json` parsed with basic JSON.parse — no validation against expected schema
- Blocks: Detecting invalid config early
- Priority: Medium — `loadConfig()` falls back to defaults gracefully, but invalid keys silently ignored

## Test Coverage Gaps

**gsd-tools.cjs CLI Commands:**
- What's not tested: All `gsd/bin/lib/*.cjs` command handlers (state, phase, roadmap, milestone, verify operations)
- Files: `gsd/bin/lib/state.cjs`, `gsd/bin/lib/phase.cjs`, `gsd/bin/lib/roadmap.cjs`, `gsd/bin/lib/milestone.cjs`, `gsd/bin/lib/verify.cjs`
- Risk: Regressions in state management, phase operations, or roadmap parsing would go undetected
- Priority: High

**Workflow Markdown Logic:**
- What's not tested: Workflow files are markdown instructions for LLMs — can't be traditionally unit-tested
- Files: `gsd/workflows/*.md`
- Risk: Workflow steps may reference nonexistent gsd-tools commands or use wrong argument formats
- Priority: Medium — reference validation (`verify references`) partially addresses this

**Agent Behavior:**
- What's not tested: Agent markdown definitions define LLM behavior — not testable with traditional unit tests
- Files: `agents/*.md`
- Risk: Agent instructions may be contradictory or reference outdated patterns
- Priority: Low — agents are instructions, not code

---

*Concerns audit: 2026-03-05*
