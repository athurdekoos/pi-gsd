# Project Research Summary

**Project:** Subagent Testing Suite
**Domain:** LLM agent pipeline testing for Pi extension
**Researched:** 2025-03-05
**Confidence:** HIGH

## Executive Summary

Pi-gsd's subagent pipeline has a clear contract: workflows reference `Task()` which maps to Pi's `subagent` tool, which discovers agent `.md` files via `parseFrontmatter()`, spawns a `pi` process with `--model` and `--tools` from frontmatter, and collects artifacts. The current test suite validates file isolation and path parity but doesn't verify the actual contract — that agents are discoverable, loadable, and spawnable.

The testing approach splits into two tiers: **wiring tests** (fast, free, catch 90% of failures) and **one e2e canary** (expensive, proves the full pipeline). Wiring tests import Pi SDK's `parseFrontmatter()` and `core.cjs`'s `MODEL_PROFILES`/`resolveModelInternal()` directly. The e2e test uses the existing `pi-rpc` harness to spawn a real Pi session and trigger `gsd-research-synthesizer` via the subagent tool.

Critical pitfalls to guard against: Pi silently skips agents with invalid frontmatter (no error, no warning), `MODEL_PROFILES` can drift from actual agent files, and agent name-to-filename mismatches cause "Unknown agent" errors that only surface at runtime.

## Key Findings

### Recommended Stack

No new dependencies needed. Use existing `node:assert` + `tsx` + `pi-rpc` harness. Import `parseFrontmatter` from Pi SDK and `MODEL_PROFILES`/`resolveModelInternal` from `core.cjs` directly.

### Expected Features

**Must have (table stakes):**
- All 11 agent frontmatter validation (name, description, tools)
- Agent name ↔ filename convention check
- MODEL_PROFILES ↔ agent files bidirectional coverage
- Model resolution for 11 agents × 3 profiles
- Template path resolution (no residual upstream paths)

**Should have (differentiator):**
- RPC e2e canary: spawn `gsd-research-synthesizer`, verify `SUMMARY.md` artifact

### Architecture Approach

Two test files following existing conventions:
1. `unit-subagent-wiring.test.ts` — fast, no API calls, imports directly
2. `e2e-subagent-spawn.test.ts` — real Pi RPC, token cost, auth required

### Critical Pitfalls

1. **Silent agent skipping** — Pi drops agents without `name`/`description`, no error
2. **MODEL_PROFILES drift** — New agents added to filesystem but not to code table (or vice versa)
3. **Nondeterministic e2e assertions** — Assert structure and existence, not exact LLM content
4. **Agent name ≠ filename** — Workflows use name, Pi uses filename for discovery

## Implications for Roadmap

### Phase 1: Wiring Tests (unit-subagent-wiring.test.ts)
**Rationale:** Fast, free, catches most real breakage. No external dependencies.
**Delivers:** Frontmatter validation, model coverage, template resolution
**Addresses:** Table stakes features — all 11 agents validated
**Avoids:** Silent agent skipping, MODEL_PROFILES drift, name/filename mismatch

### Phase 2: E2e Subagent Spawn (e2e-subagent-spawn.test.ts)
**Rationale:** Proves the full pipeline works end-to-end. Requires Phase 1 to pass first.
**Delivers:** Real subagent spawn, artifact verification
**Addresses:** Differentiator — proves Pi can actually load and run our agents
**Avoids:** Flaky nondeterministic assertions, agentScope discovery issues

### Phase Ordering Rationale

- Phase 1 before Phase 2: wiring must be valid before e2e is meaningful
- Phase 1 is independent, fast to implement and run
- Phase 2 depends on understanding the e2e test setup from Phase 1's findings

### Research Flags

- **Phase 2:** May need investigation into how Pi discovers agents registered via `package.json` `pi.agents` vs. filesystem `~/.pi/agent/agents/`. The e2e test workspace needs agents available.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools already in project, no new deps |
| Features | HIGH | Clear contract from Pi SDK source code |
| Architecture | HIGH | Follows established test patterns in project |
| Pitfalls | HIGH | Derived from Pi SDK source code analysis |

**Overall confidence:** HIGH

### Gaps to Address

- Valid Pi tool name list: Need to determine canonical set to validate agent `tools` field against. May need to hardcode known-good list from Pi source.
- Agent discovery in temp workspaces: Need to verify how `-e extensions/gsd` + `pi.agents` registration works for temp workspace e2e tests.

## Sources

### Primary (HIGH confidence)
- Pi SDK `agents.ts` — agent discovery contract, parseFrontmatter usage
- Pi SDK `examples/extensions/subagent/index.ts` — subagent tool implementation
- `gsd/bin/lib/core.cjs` — MODEL_PROFILES table, resolveModelInternal()
- Existing pi-gsd test files — established patterns

---
*Research completed: 2025-03-05*
*Ready for roadmap: yes*
