# Roadmap: Subagent Testing Suite

## Overview

Two-phase project to build comprehensive subagent tests for pi-gsd. Phase 1 creates fast, free wiring validation tests that catch 90% of breakage (frontmatter, model profiles, templates). Phase 2 adds one expensive e2e canary test that proves the full Pi → subagent → artifact pipeline works end-to-end.

## Phases

- [ ] **Phase 1: Wiring Validation** - Fast unit tests for agent definitions, model profiles, and template assembly
- [ ] **Phase 2: E2e Subagent Spawn** - Real Pi RPC test spawning gsd-research-synthesizer and verifying artifacts

## Phase Details

### Phase 1: Wiring Validation
**Goal**: Validate that all 11 agent definitions are correctly structured, model profile resolution works for every agent×profile combination, and prompt templates resolve paths properly — all without API calls.
**Depends on**: Nothing (first phase)
**Requirements**: AGNT-01, AGNT-02, AGNT-03, AGNT-04, MODL-01, MODL-02, MODL-03, TMPL-01, TMPL-02, TMPL-03
**Success Criteria** (what must be TRUE):
  1. All 11 agent `.md` files pass frontmatter validation with Pi SDK's parser
  2. Every agent name matches its filename, every agent has name + description + tools
  3. MODEL_PROFILES and agent files have 1:1 coverage (no ghosts, no orphans)
  4. `resolveModelInternal()` returns valid model for all 33 combinations (11×3)
  5. Both prompt templates have zero residual upstream paths after resolver runs
**Plans**: 3 plans

Plans:
- [ ] 01-01: Agent frontmatter validation tests (AGNT-01 through AGNT-04)
- [ ] 01-02: Model profile coverage and resolution tests (MODL-01 through MODL-03)
- [ ] 01-03: Template path resolution tests (TMPL-01 through TMPL-03)

### Phase 2: E2e Subagent Spawn
**Goal**: Prove the full subagent pipeline works: Pi loads gsd-research-synthesizer, spawns it via the subagent tool, agent reads input files, writes SUMMARY.md artifact.
**Depends on**: Phase 1 (wiring must be valid before e2e is meaningful)
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04
**Success Criteria** (what must be TRUE):
  1. Pi's subagent tool successfully invokes gsd-research-synthesizer (no "Unknown agent" error)
  2. Spawned agent reads all 4 input research files from workspace
  3. SUMMARY.md artifact exists at `.planning/research/SUMMARY.md` after agent completes
  4. SUMMARY.md is non-empty and contains recognizable markers from input files
**Plans**: 2 plans

Plans:
- [ ] 02-01: Create e2e test scaffolding with workspace setup and agent spawning tests (E2E-01, E2E-02)
- [ ] 02-02: Add artifact verification tests and register in run-all.ts (E2E-03, E2E-04)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Wiring Validation | 0/3 | Not started | - |
| 2. E2e Subagent Spawn | 0/2 | Not started | - |
