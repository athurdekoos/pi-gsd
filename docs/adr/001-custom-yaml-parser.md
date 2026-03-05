# ADR-001: Custom YAML Parser Instead of Standard Library

**Status:** Active (inferred)
**Date inferred:** 2026-03-05

## Context

GSD needs to parse YAML frontmatter in markdown files (STATE.md, PLAN.md, SUMMARY.md, etc.). Standard options include `js-yaml`, `yaml`, or other npm packages.

## Decision

Implement a custom YAML parser in `gsd/bin/lib/frontmatter.cjs:extractFrontmatter()` instead of using a standard library.

## Rationale (inferred)

1. **Zero-dependency constraint** — `gsd/bin/lib/*.cjs` uses only Node.js built-ins. Adding `js-yaml` would be the first npm runtime dependency.
2. **Limited YAML subset** — GSD frontmatter uses simple key-value pairs, inline arrays, multi-line arrays, and 2-level nesting. Full YAML spec features (anchors, multi-line strings, complex types) aren't needed.
3. **Startup performance** — CLI tools are short-lived processes. Avoiding `require('js-yaml')` saves module resolution time.

## Consequences

**Positive:**
- Zero runtime dependencies maintained
- Faster CLI startup
- No npm supply chain risk from YAML parser

**Negative:**
- Custom parser may fail on valid YAML edge cases
- Known limitation: doesn't handle multi-line strings, anchors, or deep nesting (>3 levels)
- Maintenance burden — any YAML format changes require parser updates

## Evidence

- `gsd/bin/lib/frontmatter.cjs:extractFrontmatter()` — 80+ lines of custom parsing
- `.planning/codebase/CONCERNS.md` "Custom YAML Parser" section
- No `js-yaml` or `yaml` in `package.json` dependencies
