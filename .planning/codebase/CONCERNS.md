# Codebase Concerns

**Analysis Date:** 2026-03-05

## Tech Debt

**Custom YAML parser limitations:**
- Issue: `gsd/bin/lib/frontmatter.cjs` has a hand-rolled YAML parser that handles only common patterns (key-value, arrays, 2-level nesting)
- Why: Zero runtime dependencies policy (ADR-001: `docs/adr/001-custom-yaml-parser.md`)
- Impact: Complex YAML features unsupported — multi-line strings, anchors/aliases, deeply nested objects may parse incorrectly
- Fix approach: Acceptable tradeoff per ADR — extend parser only as needed for new frontmatter patterns

**Path resolution complexity:**
- Issue: 4-rule rewrite chain in `extensions/gsd/path-resolver.ts` rewrites `~/.claude/get-shit-done/` → local paths
- Files: `extensions/gsd/path-resolver.ts`, `extensions/gsd/index.ts` (system prompt injection adds 6th path variant)
- Why: Upstream GSD markdown was written for Claude Code's `~/.claude/` convention
- Impact: New path patterns in upstream GSD require adding rewrite rules; easy to miss a pattern
- Fix approach: Covered by unit tests in `tests/unit-path-rewrite.test.ts` — add test for each new pattern

**Monolithic CLI router:**
- Issue: `gsd/bin/gsd-tools.cjs` is a ~350-line switch statement routing to library modules
- Why: Started small, grew organically as commands were added
- Impact: Hard to read, no auto-discovery of new commands
- Fix approach: Low priority — the router is stable and rarely changes

## Known Bugs

**None documented from code analysis.** Test suite coverage appears comprehensive.

## Security Considerations

**Secret scanning in codebase maps:**
- Risk: `gsd-codebase-mapper` agents could accidentally include API keys, tokens, or credentials found in source code when writing analysis documents to `.planning/codebase/`
- Current mitigation: `map-codebase.md` workflow includes grep-based secret scanning step before committing
- Files: `gsd/workflows/map-codebase.md` (scan_for_secrets step)
- Recommendations: Pattern list in workflow should be kept current with new secret formats

**Git commit of sensitive config:**
- Risk: `.planning/config.json` is committed to git by default, could contain sensitive model overrides or API references
- Current mitigation: `commit_docs: false` option adds `.planning/` to `.gitignore`; no actual secrets stored in config
- Recommendations: Adequate — config.json contains only preferences, not credentials

**execSync shell injection:**
- Risk: `execGit()` in `core.cjs` constructs shell commands from user input (phase names, commit messages)
- Current mitigation: Arguments are shell-escaped via single-quote wrapping with internal quote escaping
- Files: `gsd/bin/lib/core.cjs` (`execGit` function)
- Recommendations: Current escaping is reasonable; monitor for edge cases

## Performance Bottlenecks

**No significant bottlenecks identified.** CLI tools operate on local files with low latency. Key observations:

- `loadConfig()` reads and parses `config.json` on every CLI invocation — negligible cost
- `findPhaseInternal()` scans `.planning/phases/` directory — fast for typical project sizes (<100 phases)
- `syncStateFrontmatter()` rebuilds full YAML frontmatter on every STATE.md write — acceptable for file sizes seen

## Fragile Areas

**STATE.md field extraction via regex:**
- Files: `gsd/bin/lib/state.cjs` (`stateExtractField`, `stateReplaceField`)
- Why fragile: Relies on regex matching `**Field:** value` or `Field: value` patterns in Markdown
- Common failures: Adding new section headers or formatting changes can break field extraction
- Safe modification: Dual-format handling (bold and plain) already in place; test with both formats
- Test coverage: `cmdStateSnapshot` exercises field extraction; add tests for new field patterns

**Roadmap phase section extraction:**
- Files: `gsd/bin/lib/roadmap.cjs` (`cmdRoadmapGetPhase`), `gsd/bin/lib/core.cjs` (`getRoadmapPhaseInternal`)
- Why fragile: Regex-based extraction of phase sections from ROADMAP.md depends on consistent heading format (`### Phase N: Name`)
- Common failures: Non-standard heading formats, missing sections referenced in summary list
- Safe modification: `cmdRoadmapGetPhase` has fallback for malformed roadmaps (checklist-only phases)
- Test coverage: Roadmap analysis covered by integration tests

**Phase directory naming assumptions:**
- Files: `gsd/bin/lib/core.cjs` (`searchPhaseInDir`, `findPhaseInternal`, `normalizePhaseName`)
- Why fragile: Phase operations assume `{NN}-{slug}` directory naming with regex parsing
- Common failures: Non-standard directory names, mixed integer/decimal/letter phases
- Safe modification: `normalizePhaseName` handles integers, decimals, letter suffixes; `comparePhaseNum` handles sorting
- Test coverage: Phase operations tested; edge cases for unusual numbering schemes may need more coverage

## Scaling Limits

**Phase count:**
- Current capacity: Directory scanning assumes <100 phases (linear scan)
- Limit: Performance degrades with hundreds of phase directories
- Symptoms at limit: Slow `find-phase` and `roadmap analyze` commands
- Scaling path: Unlikely to hit — projects rarely exceed 20-30 phases before milestone completion resets

**ROADMAP.md file size:**
- Current capacity: Full-text regex operations on roadmap content
- Limit: Very large roadmaps (>100KB) may cause regex backtracking
- Scaling path: Milestone archiving moves old phases to `milestones/` directory

## Dependencies at Risk

**Pi SDK (`@mariozechner/pi-coding-agent`):**
- Risk: Extension API is a peer dependency — SDK changes could break event subscriptions or command registration
- Impact: All 3 event handlers and command registration would fail
- Mitigation: Compliance tests (`tests/compliance.test.ts`) validate against known valid events; runtime tests verify real Pi integration

**`tsx` (devDependency):**
- Risk: Test runner depends on tsx for TypeScript execution
- Impact: Tests would not run (core extension unaffected — no build step needed)
- Mitigation: Low risk — tsx is actively maintained, widely used

## Test Coverage Gaps

**CLI tool edge cases:**
- What's not tested: Individual `gsd-tools.cjs` commands with complex input combinations
- Risk: Rare argument patterns could produce unexpected results
- Priority: Medium
- Difficulty to test: Each command needs fixture data in temp directories

**Agent markdown parsing:**
- What's not tested: Whether agent definitions are valid (correct frontmatter schema, well-formed XML tags)
- Risk: Malformed agent definitions silently fail when spawned
- Priority: Low — agents are manually authored and stable
- Note: `parity-agents.test.ts` checks agent ↔ model profile mapping but not content validity

---

*Concerns audit: 2026-03-05*
*Update as issues are fixed or new ones discovered*
