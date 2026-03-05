# Subagent Testing Suite

## What This Is

A comprehensive test suite that validates pi-gsd's subagent creation, management, and spawning pipeline. Covers three layers: full round-trip e2e spawning via Pi RPC, agent definition validation (frontmatter, tools, structure for all 11 agents), and prompt template assembly verification (path resolution, placeholder filling, context file references).

## Core Value

Prove that when a GSD workflow says "spawn gsd-planner," Pi can actually load the agent, give it the right tools, pass it a correctly-assembled prompt, and get artifacts back — without burning tokens to find out it's broken.

## Requirements

### Validated

- ✓ Agent `.md` files exist for 5 core roles (ISOL-02) — existing
- ✓ File isolation between orchestrator/subagent paths (ISOL-01) — existing
- ✓ Agent path parity with upstream (PRTY-11, PRTY-12) — existing
- ✓ System prompt contains subagent mapping instructions (INTG-14) — existing
- ✓ Wiring: All 11 agent `.md` files have valid YAML frontmatter — Phase 1
- ✓ Wiring: Every agent frontmatter has required fields: `name`, `description`, `tools` — Phase 1
- ✓ Wiring: Agent `name` field matches filename convention (`gsd-{slug}`) — Phase 1
- ✓ Wiring: Agent `tools` field contains only valid Pi tool names — Phase 1
- ✓ Wiring: Every agent in `MODEL_PROFILES` table has a corresponding `.md` file and vice versa — Phase 1
- ✓ Wiring: Model profile resolution returns a valid model for all 11 agents × 3 profiles — Phase 1
- ✓ Template: `planner-subagent-prompt.md` fills without broken paths after resolver runs — Phase 1
- ✓ Template: `debug-subagent-prompt.md` fills without broken paths after resolver runs — Phase 1
- ✓ Template: `@` file references in filled templates point to plausible `.planning/` paths — Phase 1

### Active

- [ ] RPC e2e: Pi can spawn `gsd-research-synthesizer` via subagent tool and `SUMMARY.md` artifact appears
- [ ] RPC e2e: Spawned agent receives correct working directory and can read input files
- [ ] RPC e2e: Spawned agent writes output to expected path (not orchestrator's namespace)
- [ ] Template: Filled templates contain valid XML/markdown structure (no unclosed tags, no empty placeholders)

### Out of Scope

- Testing agent *behavior* (whether gsd-planner makes good plans) — that's agent quality, not wiring
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

## Constraints

- **Zero runtime deps**: Tests use only Node.js built-ins + `tsx` (matching existing convention)
- **Test harness**: Must use existing `tests/harness/` infrastructure (MockExtensionAPI, pi-rpc, lifecycle)
- **Naming**: Follow existing `{type}-{area}.test.ts` convention
- **Cost**: RPC tests burn API tokens — keep to minimum (one canary agent, not all 11)
- **Prerequisites**: RPC tests require Pi binary + auth (same as ISOL tests — fail, don't skip)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use `gsd-research-synthesizer` as RPC canary | Lightweight (reads files, writes SUMMARY.md), clear artifact, minimal state needed | — Pending |
| Split into 2 test files (wiring + e2e) | Wiring tests are fast/free, e2e is slow/costly — different run profiles | ✓ Validated in Phase 1 |
| Validate all 11 agents in wiring tests | Cheap to check, catches drift when new agents added | ✓ 105 tests, all pass |
| Import Pi SDK frontmatter.js directly | Main entry has transitive dep issues; direct utils/frontmatter.js works and is the same function Pi uses | ✓ Phase 1 |

---
*Last updated: 2026-03-05 after Phase 1*
