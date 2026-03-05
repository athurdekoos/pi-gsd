# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- `kebab-case.ts` for TypeScript source (e.g., `path-resolver.ts`, `mock-api.ts`)
- `kebab-case.cjs` for CommonJS modules (e.g., `gsd-tools.cjs`, `core.cjs`)
- `kebab-case.md` for Markdown content files
- `UPPERCASE.md` for generated artifact files (e.g., `PLAN.md`, `SUMMARY.md`, `STATE.md`)
- `kebab-case.test.ts` for test files

**Functions:**
- `camelCase` for all functions (e.g., `loadConfig`, `findPhaseInternal`, `writeStateMd`)
- `cmd` prefix for CLI command handlers (e.g., `cmdStateUpdate`, `cmdFindPhase`, `cmdCommit`)
- No special prefix for async functions

**Variables:**
- `camelCase` for variables (e.g., `phaseInfo`, `roadmapContent`, `configPath`)
- `UPPER_SNAKE_CASE` for constants (e.g., `MODEL_PROFILES`, `FRONTMATTER_SCHEMAS`, `VALID_PI_EVENTS`)

**Types:**
- `PascalCase` for interfaces and types (e.g., `CommandMeta`, `ExtensionAPI`)
- No `I` prefix for interfaces
- `GsdPathResolver` class follows PascalCase

## Code Style

**Formatting:**
- 2-space indentation
- Single quotes for strings in TypeScript
- Semicolons required
- No trailing commas enforced
- No Prettier or ESLint config files present — conventions enforced by example

**Linting:**
- No linter configured
- TypeScript strict mode enabled (`"strict": true` in tsconfig.json)
- Code quality maintained through consistent patterns, not tooling

## Import Organization

**TypeScript (ESM):**
1. Node.js built-ins with `node:` protocol (`import * as fs from "node:fs"`)
2. External packages (`import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"`)
3. Relative imports (`import { GsdPathResolver } from "./path-resolver.js"`)
4. Type-only imports use `import type {}` syntax

**CommonJS:**
1. Node.js built-ins (`const fs = require('fs')`)
2. Relative requires from `./lib/` (`const { output, error } = require('./core.cjs')`)

**Pattern:** All CJS modules use destructured require from `core.cjs` for shared utilities.

## Error Handling

**Patterns:**
- CLI tools: `error(message)` writes to stderr and `process.exit(1)` — used for invalid input
- Graceful degradation: Functions return null/defaults for missing files rather than throwing
  - `safeReadFile()` returns null on error
  - `loadConfig()` returns full defaults object on parse failure
  - `execGit()` returns `{ exitCode, stdout, stderr }` on failure (never throws)
- Extension: `process.stderr.write()` + early return for missing prerequisites (no crash)

**Guard Clauses:**
- Validate required arguments at function top with `if (!arg) error('message')`
- File existence checks before reads: `if (!fs.existsSync(path))` → return error result or null

## Logging

**No logging framework.** All output is structured:
- CLI tools output JSON to stdout via `output(result, raw)` helper
- Errors go to stderr via `error(message)` helper
- Extension uses `process.stderr.write()` for degradation warnings
- `--raw` flag strips JSON wrapping for piping: `output(result, raw, rawValue)`

## Comments

**Style:**
- Module-level JSDoc comment at top of each `.cjs` file explaining purpose
- Section headers with box-drawing: `// ─── Section Name ───────────────`
- Inline comments for non-obvious logic (e.g., regex explanations, edge case handling)
- No TODO comments observed

**Documentation:**
- Comprehensive header comments in `gsd-tools.cjs` documenting all commands/subcommands
- ADRs in `docs/adr/` for architectural decisions

## Function Design

**Size:**
- CLI command handlers range from 20-100 lines
- Helper functions extracted for shared logic (e.g., `stateExtractField`, `stateReplaceField`)

**Parameters:**
- `(cwd, ...args, raw)` pattern for CLI commands — cwd is always first, raw flag always last
- Options objects for complex inputs (e.g., `cmdStateRecordMetric(cwd, { phase, plan, duration, tasks, files }, raw)`)

**Return Values:**
- All CLI commands output via `output(result, raw, rawValue)` — never return
- Internal helpers return values directly (null for not-found)

## Module Design

**CJS Modules (`gsd/bin/lib/*.cjs`):**
- Each module exports a set of related functions via `module.exports = { ... }`
- All modules import shared utilities from `core.cjs`
- No circular dependencies — `core.cjs` is leaf, others depend on it
- Cross-module imports: `state.cjs` imported by `phase.cjs`, `verify.cjs`, `milestone.cjs` (for `writeStateMd`)

**Extension TypeScript:**
- Named exports for helper functions
- Default export for extension factory in `index.ts`
- `GsdPathResolver` class exported from `path-resolver.ts`

**Markdown-as-Code:**
- Commands, workflows, agents, templates are all Markdown files
- XML tags used for structured sections within Markdown (e.g., `<role>`, `<task>`, `<process>`)
- YAML frontmatter for metadata (name, description, tools, dependencies)
- `@path` references for file includes

---

*Convention analysis: 2026-03-05*
*Update when patterns change*
