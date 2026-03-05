# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Subagent Testing Suite

**Shipped:** 2026-03-05
**Phases:** 2 | **Plans:** 5 | **Tasks:** 7

### What Was Built
- 105 wiring tests validating all 11 agent definitions, model profiles, and template assembly
- 4 E2E tests proving the full subagent pipeline (spawn → read → write → verify)
- Sentinel-based content verification pattern for LLM output assertions
- Complete registration in unified test runner (17 suites total)

### What Worked
- Wave-based execution kept context lean — orchestrator never exceeded ~15% budget
- gsd-tools CLI handled all state tracking (roadmap progress, requirements marking, commits)
- Single Pi RPC session pattern avoided 2× token cost for E2E tests
- Wiring/E2E split validated — 105 fast free tests + 4 expensive canary tests is ideal coverage/cost ratio
- Plan-level atomic commits created clean git history for traceability

### What Was Inefficient
- Phase 1 requirements (AGNT/MODL/TMPL) were not marked complete during execution — had to fix at milestone completion
- `state advance-plan` failed due to STATE.md format mismatch — manual edits needed
- `state record-metric` couldn't find Performance Metrics section — metrics section format wasn't compatible

### Patterns Established
- Sentinel pattern: `XSENTINEL_` prefix + `Date.now()` for planted markers in LLM test fixtures
- E2E gate: `process.argv.includes("--e2e")` at file top for expensive test gating
- Graceful test dependency: wrap readFile in try/catch when one test depends on another's output
- Same-day milestone: 2 phases, 5 plans executed and verified in ~4.5 hours

### Key Lessons
1. Always call `requirements mark-complete` per plan during execution — don't rely on catching it later
2. STATE.md format must match what gsd-tools expects — test the CLI's state parsing before relying on it
3. E2E subagent tests need generous timeouts (240s turn, 300s process) — don't skimp
4. `config.json` with `commit_docs: false` in temp workspaces prevents gsd-tools commit errors

### Cost Observations
- Model: 100% sonnet (executor_model: inherit, verifier_model: sonnet)
- E2E tests: thinking: off to reduce cost and variation
- Sessions: 3 (Phase 1 execute, Phase 2 execute, milestone complete)
- Notable: Wiring tests are zero-cost (no API calls), E2E tests cost ~1 API round-trip each

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 2 | 5 | Established wave-based execution, sentinel E2E pattern |

### Cumulative Quality

| Milestone | Tests | Test Files | Zero-Dep Additions |
|-----------|-------|-----------|-------------------|
| v1.0 | 109 | 4 | 4 (all test files use only Node built-ins + tsx) |

### Top Lessons (Verified Across Milestones)

1. Mark requirements complete during plan execution, not after
2. Test gsd-tools CLI integration with STATE.md format before relying on automation
