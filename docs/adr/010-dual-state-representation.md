# ADR-010: Dual STATE.md Representation (Frontmatter + Body)

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

STATE.md needs to be readable by both machines (CLI tools) and humans/LLMs. Options: separate JSON + markdown files, or a single file with both representations.

## Decision

STATE.md has YAML frontmatter (machine-readable) and a markdown body (human/LLM-readable). `writeStateMd()` keeps them in sync by parsing the body and rebuilding frontmatter on every write.

## Rationale (inferred)

1. **Single source of truth** — One file, not two that might drift
2. **Machine access** — `state json` returns frontmatter for fast parsing
3. **Human access** — LLM reads the markdown body naturally
4. **Git-friendly** — One file to track in version control

## Consequences

- Every STATE.md write triggers a full parse + rebuild cycle
- Body format changes can break frontmatter sync silently
- `writeStateMd()` must be the only write path (invariant)
- Adds complexity vs. two separate files

## Evidence

- `gsd/bin/lib/state.cjs:writeStateMd()` — strips frontmatter, parses body, rebuilds, writes
- `gsd/bin/lib/state.cjs:buildStateFrontmatter()` — body → frontmatter extraction
- `gsd/bin/lib/state.cjs:cmdStateJson()` — returns frontmatter as JSON
