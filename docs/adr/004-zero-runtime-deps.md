# ADR-004: Zero External Runtime Dependencies

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

`gsd/bin/lib/*.cjs` needs various utilities: YAML parsing, JSON handling, HTTP requests, git operations.

## Decision

Use only Node.js built-ins (`fs`, `path`, `child_process`, `os`). No npm runtime dependencies.

## Rationale (inferred)

1. **No `node_modules` bloat** — Extension packages should be lightweight
2. **No supply chain risk** — No transitive dependency vulnerabilities
3. **Reliable CLI startup** — No module resolution overhead
4. **Portability** — Works with any Node.js 20+ installation

## Consequences

- Custom YAML parser instead of `js-yaml` (see [ADR-001](001-custom-yaml-parser.md))
- Custom HTTP request for Brave Search using `fetch()` (Node.js built-in since v18)
- Shell-out to `git` instead of using a git library (e.g., `simple-git`)

## Evidence

- `package.json` — zero `dependencies`, only `devDependencies` (`tsx`, `typescript`)
- `gsd/bin/lib/core.cjs` — `require('fs')`, `require('path')`, `require('child_process')`
- `.planning/codebase/CONCERNS.md` — "No external runtime dependencies"
