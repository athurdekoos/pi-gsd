# Subagent Testing Suite

## What This Is

A comprehensive test suite that validates pi-gsd's subagent creation, management, and spawning pipeline. Covers three layers: full round-trip e2e spawning via Pi RPC, agent definition validation (frontmatter, tools, structure for all 11 agents), and prompt template assembly verification (path resolution, placeholder filling, context file references).

## Core Value

Prove that when a GSD workflow says "spawn gsd-planner," Pi can actually load the agent, give it the right tools, pass it a correctly-assembled prompt, and get artifacts back — without burning tokens to find out it's broken.

## Current State (v1.0 shipped)

Shipped v1.0 with 856 LOC TypeScript across 4 test files (109 tests total).
All 14 v1 requirements validated. Test suite registered in unified runner (run-all.ts).

## Requirements

### Validated (v1.0)

- ✓ Agent `.md` files exist for 5 core roles (ISOL-02) — pre-existing
- ✓ File isolation between orchestrator/subagent paths (ISOL-01) — pre-existing
- ✓ Agent path parity with upstream (PRTY-11, PRTY-12) — pre-existing
- ✓ System prompt contains subagent mapping instructions (INTG-14) — pre-existing
- ✓ All 11 agent `.md` files parse with Pi SDK parseFrontmatter (AGNT-01) — v1.0
- ✓ Every agent frontmatter has required fields name, description, tools (AGNT-02) — v1.0
- ✓ Agent name matches filename convention (AGNT-03) — v1.0
- ✓ Agent tools field contains canonical Pi tool names (AGNT-04) — v1.0
- ✓ Bidirectional MODEL_PROFILES↔agent coverage (MODL-01, MODL-02) — v1.0
- ✓ Model resolution works for all 33 agent×profile combinations (MODL-03) — v1.0
- ✓ Templates resolve paths correctly (TMPL-01, TMPL-02, TMPL-03) — v1.0
- ✓ Pi spawns gsd-research-synthesizer without Unknown agent error (E2E-01) — v1.0
- ✓ Agent reads input files from workspace (E2E-02) — v1.0
- ✓ Agent writes SUMMARY.md artifact (E2E-03) — v1.0
- ✓ SUMMARY.md contains recognizable content from inputs (E2E-04) — v1.0

### Active (v2 candidates)

- [ ] Template: Filled templates contain valid XML/markdown structure (no unclosed tags, no empty placeholders)
- [ ] Agent tools validated against canonical list (not just present)
- [ ] Model override via config.json model_overrides correctly supersedes profile lookup

### Out of Scope

- Testing agent *behavior* (whether gsd-planner makes good plans) — agent quality, not wiring
- Testing all 11 agents via RPC e2e — too expensive; synthesizer canary is sufficient
- Modifying agent `.md` files or templates — this project only tests them
- Upstream parity (already covered by PRTY-11/12)

## Context

- pi-gsd is a Pi extension with 11 subagent roles defined in `agents/gsd-*.md`
- Agents are registered via `package.json` `pi.agents` pointing to `agents/` directory
- Workflows reference `Task()` which maps to Pi's `subagent` tool via system prompt injection
- Model selection comes from `MODEL_PROFILES` in `gsd/bin/lib/core.cjs` — 3 profiles × 11 agents
- Two prompt templates exist: `planner-subagent-prompt.md` and `debug-subagent-prompt.md`
- Path resolution happens via `GsdPathResolver` which rewrites `~/.claude/get-shit-done/` → local `gsd/` paths
- Existing test harness in `tests/harness/pi-rpc.ts` supports real Pi RPC sessions for e2e tests
- Valid Pi tool names: `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebSearch`, `WebFetch`, plus `mcp__*` patterns
- v1.0 shipped: 4 test files (856 LOC), 109 tests (105 wiring + 4 E2E), registered in run-all.ts (17 suites total)

## Constraints

- **Zero runtime deps**: Tests use only Node.js built-ins + `tsx` (matching existing convention)
- **Test harness**: Must use existing `tests/harness/` infrastructure (MockExtensionAPI, pi-rpc, lifecycle)
- **Naming**: Follow existing `{type}-{area}.test.ts` convention
- **Cost**: RPC tests burn API tokens — keep to minimum (one canary agent, not all 11)
- **Prerequisites**: RPC tests require Pi binary + auth (same as ISOL tests — fail, don't skip)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use `gsd-research-synthesizer` as RPC canary | Lightweight (reads files, writes SUMMARY.md), clear artifact, minimal state needed | ✓ Validated in Phase 2 — all 4 E2E tests pass |
| Split into 2 test files (wiring + e2e) | Wiring tests are fast/free, e2e is slow/costly — different run profiles | ✓ Validated in Phase 1 |
| Validate all 11 agents in wiring tests | Cheap to check, catches drift when new agents added | ✓ 105 tests, all pass |
| Import Pi SDK frontmatter.js directly | Main entry has transitive dep issues; direct utils/frontmatter.js works and is the same function Pi uses | ✓ Phase 1 |
| Single Pi session per e2e test file | Avoids 2× token cost; all tests share session state | ✓ Phase 2 |
| Sentinel pattern for LLM output verification | XSENTINEL_ prefix + Date.now() detects real reads vs hallucination | ✓ Phase 2 |
| 2/4 sentinel threshold for content check | Tolerates LLM synthesis variability while catching wiring failures | ✓ Phase 2 |

---
*Last updated: 2026-03-05 after v1.0 milestone*
