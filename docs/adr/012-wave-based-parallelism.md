# ADR-012: Wave-Based Plan Parallelism

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

Phases contain multiple plans. Some plans are independent (can run in parallel); others depend on earlier plans.

## Decision

Plans are assigned to waves via frontmatter (`wave: 1`, `wave: 2`). Plans in the same wave execute in parallel. Waves execute sequentially (wave 1 completes before wave 2 starts).

## Rationale (inferred)

1. **Simple dependency model** — Waves are simpler than a full DAG. No cycle detection or complex scheduling needed.
2. **Planner control** — The gsd-planner assigns waves based on dependencies. No runtime dependency resolution.
3. **Controllable parallelism** — `parallelization: true/false` in config toggles between parallel and sequential within a wave.
4. **Context isolation** — Each subagent gets a fresh context window, avoiding context bloat from accumulated execution state.

## Consequences

- Plans within a wave must be truly independent (no shared files)
- Wave assignment is a planner responsibility — wrong assignments cause conflicts
- Sequential fallback available for debugging (`parallelization: false`)
- Wave number determines execution order, not explicit dependency edges

## Evidence

- `gsd/bin/lib/phase.cjs:cmdPhasePlanIndex()` — groups plans by wave from frontmatter
- `gsd/workflows/execute-phase.md` — "Execute each wave in sequence. Within a wave: parallel if PARALLELIZATION=true"
- `gsd/templates/config.json` — `parallelization.enabled`, `parallelization.plan_level`
- Plan frontmatter: `wave: 1`, `depends_on: []`
