# ADR-005: Path Resolver Bridge Pattern for Portability

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

GSD was originally designed for Claude Code with paths like `~/.claude/get-shit-done/`. When ported to Pi as an extension, these paths needed to resolve to the actual package installation location.

## Decision

Implement `GsdPathResolver` with a 4-rule rewrite pipeline that translates canonical paths to the actual `gsdHome` path at runtime. Workflows and agents keep their original path references.

## Rationale (inferred)

1. **Minimize workflow changes** — 30+ workflow files and 11 agent files use canonical paths. Rewriting all of them is error-prone.
2. **Single point of translation** — All path resolution goes through one class with a well-defined pipeline.
3. **Supports hot-reload** — Path resolution happens at invocation time, not build time.

## Consequences

- Every path in markdown files goes through 4 regex replacements on every command invocation
- New path forms require adding a new rewrite rule (order matters)
- `.planning/codebase/CONCERNS.md` identifies this as "Dual Path System" tech debt
- Upstream changes to canonical paths require updating the resolver

## Evidence

- `extensions/gsd/path-resolver.ts:rewritePaths()` — 4 regex rules
- All `gsd/workflows/*.md` files use `$HOME/.claude/get-shit-done/` or `$GSD_HOME/`
- `.planning/codebase/CONCERNS.md` "Dual Path System" section
