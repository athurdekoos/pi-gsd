# ADR-003: File-Based State Machine (No Database)

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

GSD needs to persist project state across sessions. Options: SQLite, JSON store, key-value DB, or plain files.

## Decision

All project state lives in `.planning/` as markdown and JSON files. No database.

## Rationale (inferred)

1. **Zero dependencies** — No database driver needed. Only `fs.readFileSync`/`writeFileSync`.
2. **Human-readable state** — Anyone can inspect project state by reading markdown files. No query tools needed.
3. **Git-friendly** — Markdown files produce clean diffs. State changes are visible in git history.
4. **LLM-friendly** — The LLM can read and write state using standard Read/Write tools. No database client needed.
5. **Context recovery** — If the LLM's context window resets, re-reading `.planning/` files restores full project context.
6. **Simplicity** — File operations are the simplest possible persistence mechanism.

## Consequences

**Positive:**
- Zero infrastructure requirements
- State is human-readable and git-trackable
- LLM can access state with standard tools
- Works on any system with a filesystem

**Negative:**
- No concurrent access safety (last write wins)
- O(n) directory scans for phase lookup
- No indexing for queries
- Fragile text parsing (regex-based field extraction)
- STATE.md frontmatter sync adds complexity

## Evidence

- `.planning/` directory structure in `gsd/workflows/help.md`
- `gsd/bin/lib/state.cjs:writeStateMd()` — file-based state updates
- `gsd/bin/lib/core.cjs:findPhaseInternal()` — directory scan for phase lookup
- No database drivers in `package.json`
- `.planning/codebase/CONCERNS.md` "File-Based State" section
