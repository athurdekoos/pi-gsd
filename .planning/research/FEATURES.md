# Feature Research

**Domain:** Subagent testing for Pi extension
**Researched:** 2025-03-05
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Tests You Must Have)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All 11 agent `.md` files have valid frontmatter | Pi silently skips agents with missing `name`/`description` — invisible failure | LOW | Use Pi SDK's `parseFrontmatter()` to test what Pi actually sees |
| Agent `name` matches filename convention | Mismatch = agent registered under wrong name, `subagent({agent: "gsd-planner"})` fails | LOW | Filename `gsd-planner.md` → frontmatter `name: gsd-planner` |
| All agents in `MODEL_PROFILES` have `.md` files | Missing file = `resolveModelInternal()` returns a model for a ghost agent | LOW | Bidirectional: profiles → files AND files → profiles |
| Model resolution works for all 11 × 3 profiles | Returns valid model string, not undefined/null | LOW | Test `resolveModelInternal()` directly from core.cjs |
| Prompt templates fill without broken paths | `$GSD_HOME/`, `@~/.claude/get-shit-done/` must resolve | LOW | Run `GsdPathResolver.rewritePaths()` on template content |

### Differentiators (High-Value Tests)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Full RPC e2e: spawn `gsd-research-synthesizer` and verify artifact | Proves entire pipeline: Pi → subagent tool → agent loads → runs → writes file | HIGH | Requires auth, burns tokens, ~60-90s per run |
| Agent `tools` field contains only valid Pi tool names | Invalid tool name = Pi ignores it silently or errors at runtime | MEDIUM | Need canonical tool name list from Pi |
| Template `@` references resolve to paths that exist in `.planning/` structure | Broken file refs = agent spawns but can't read context | MEDIUM | Validate against `.planning/` directory conventions |

### Anti-Features (Don't Build These)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Test every agent via RPC e2e | "Test all 11 for completeness" | 11× cost, 11× time, most failures caught by wiring tests | One canary (synthesizer) + wiring for all 11 |
| Test agent *behavior* quality | "Does planner make good plans?" | Nondeterministic LLM output, not a wiring concern | Manual evaluation, separate test domain |
| Test Pi SDK internals | "Does parseFrontmatter work?" | Not our code, not our bug | Trust Pi SDK, test our files against its contract |

## Feature Dependencies

```
Agent frontmatter validation
    └──requires──> Pi SDK parseFrontmatter (import)

Model profile coverage check
    └──requires──> core.cjs MODEL_PROFILES + resolveModelInternal (import)

Template path resolution
    └──requires──> GsdPathResolver (import from extension)

RPC e2e spawning
    └──requires──> Agent frontmatter valid (table stakes pass first)
    └──requires──> Pi binary + auth
    └──requires──> Input files exist in temp workspace
```

## MVP Definition

### Launch With (v1)

- [x] All 11 agents validated (frontmatter, name, tools)
- [x] MODEL_PROFILES ↔ agent files bidirectional check
- [x] Model resolution for all 11 × 3 profiles
- [x] Template path resolution
- [x] One RPC e2e canary (gsd-research-synthesizer)

### Defer

- [ ] Agent tool name validation against Pi canonical list — needs research on where Pi defines valid tools
- [ ] Template XML structure validation — nice-to-have, lower risk

## Sources

- Pi SDK `agents.ts`: `loadAgentsFromDir()` skips agents without `name`/`description`
- Pi SDK `index.ts`: subagent tool passes `--tools` and `--model` to spawned `pi` process
- Pi SDK `agents.ts`: `parseFrontmatter()` from `@mariozechner/pi-coding-agent`
- `gsd/bin/lib/core.cjs`: `MODEL_PROFILES`, `resolveModelInternal()`

---
*Feature research for: subagent testing*
*Researched: 2025-03-05*
