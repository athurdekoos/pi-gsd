# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- TypeScript extension: `camelCase.ts` (e.g., `path-resolver.ts` is an exception — uses kebab-case)
- CommonJS modules: `lowercase.cjs` (e.g., `core.cjs`, `state.cjs`, `frontmatter.cjs`)
- Markdown: `kebab-case.md` for commands/workflows, `UPPERCASE.md` for generated artifacts (e.g., `STATE.md`, `ROADMAP.md`)
- Tests: `{scope}-{domain}.test.ts` (e.g., `compliance.test.ts`, `intg-commands.test.ts`)

**Functions:**
- CLI command handlers: `cmd{Domain}{Action}(cwd, args, raw)` (e.g., `cmdStateUpdate()`, `cmdPhaseAdd()`, `cmdFrontmatterGet()`)
- Internal helpers: `camelCase` (e.g., `loadConfig()`, `findPhaseInternal()`, `resolveModelInternal()`)
- External-facing functions: descriptive verbs (e.g., `registerGsdCommands()`, `buildGsdSystemPromptAddendum()`)

**Variables:**
- Constants: `UPPER_SNAKE_CASE` (e.g., `MODEL_PROFILES`, `VALID_PI_EVENTS`, `FRONTMATTER_SCHEMAS`)
- Local variables: `camelCase` (e.g., `phaseDir`, `configPath`, `normalizedPhase`)

**Types:**
- Interfaces/types imported from Pi SDK: `ExtensionAPI`, `ExtensionContext`
- Internal types: `CommandMeta` in `commands.ts`
- Classes: `PascalCase` (e.g., `GsdPathResolver`, `MockExtensionAPI`)

## Code Style

**Formatting:**
- No auto-formatter configured (no `.prettierrc`, no `.eslintrc`)
- Consistent 2-space indentation throughout
- Single quotes in CommonJS (`gsd/bin/lib/*.cjs`), double quotes in TypeScript (`extensions/gsd/`)
- Semicolons always used

**Linting:**
- No linter configured
- TypeScript `strict: true` in `tsconfig.json` provides type checking

## Import Organization

**Order (TypeScript — `extensions/gsd/`):**
1. Node.js built-ins (`import * as fs from "node:fs"`, `import * as path from "node:path"`)
2. External packages (`import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"`)
3. Local imports (`import { GsdPathResolver } from "./path-resolver.js"`)

**Order (CommonJS — `gsd/bin/lib/`):**
1. Node.js built-ins (`const fs = require('fs')`, `const path = require('path')`)
2. Local imports (`const { loadConfig, output, error } = require('./core.cjs')`)

**Path Aliases:**
- None configured — all imports use relative paths
- Extension files use `.js` extension in imports (TypeScript convention for ESM-compatible output)

## Error Handling

**Patterns:**
- CLI tools: Call `error(message)` from `core.cjs` which writes to stderr and `process.exit(1)`
- Extension load: Graceful degradation — check for required files, write to stderr, `return` (don't crash pi)
- File reads: `safeReadFile()` returns `null` on failure (never throws)
- Git operations: `execGit()` returns `{ exitCode, stdout, stderr }` object (never throws)
- Config loading: `loadConfig()` returns defaults object on any failure (never throws)
- Init commands: Return `null`/`false` for missing optional resources in JSON output

**Anti-patterns to avoid:**
- Never throw exceptions in CLI command handlers — use `error()` for fatal, return status objects for non-fatal
- Never let extension event handlers crash — pi continues but extension behavior is unpredictable

## Logging

**Framework:** None — raw `process.stderr.write()` and `process.stdout.write()`

**Patterns:**
- Fatal errors: `process.stderr.write('Error: ' + message)` via `core.cjs:error()`
- Extension warnings: `process.stderr.write('[pi-gsd] ...')` in `extensions/gsd/index.ts`
- CLI output: JSON to stdout via `core.cjs:output()` (with `--raw` flag for plain text)
- Large output: Write to tmpfile, output `@file:/path` prefix (auto-detected by callers)

## Comments

**When to Comment:**
- Module-level JSDoc comments on every `.cjs` module explaining purpose
- Function-level JSDoc on key exported functions
- Inline comments for non-obvious logic (regex patterns, edge cases)
- `// ─── Section Header ───` dividers in `core.cjs` for logical grouping

**JSDoc/TSDoc:**
- Used on extension entry point and public methods in `path-resolver.ts`
- Used on module exports and key helpers in `gsd/bin/lib/*.cjs`
- Not used for obvious getter/setter patterns

## Function Design

**Size:** Functions generally 10-80 lines. Largest: `cmdPhaseRemove()` ~150 lines (complex renumbering logic)

**Parameters:**
- CLI handlers: `(cwd, ...specific_args, raw)` pattern — `cwd` first, `raw` boolean last
- Init commands: `(cwd, context_arg, raw)` — return comprehensive JSON context
- Internal helpers: Minimal parameters, return structured objects

**Return Values:**
- CLI handlers: Call `output(result, raw)` and never return (output calls `process.exit(0)`)
- Helpers: Return structured objects or `null` for not-found
- Extension event handlers: Return event-specific response objects or `undefined`

## Module Design

**Exports (CommonJS):**
- Each `gsd/bin/lib/*.cjs` exports an object with named functions: `module.exports = { cmdFn1, cmdFn2, helperFn }`
- Prefix convention: `cmd*` for CLI-facing, no prefix for internal helpers

**Exports (TypeScript):**
- `extensions/gsd/index.ts`: Default export function (Pi extension convention)
- `extensions/gsd/commands.ts`: Named export `registerGsdCommands`
- `extensions/gsd/path-resolver.ts`: Named export `GsdPathResolver` class

**Barrel Files:**
- Not used — each module imported directly by path

## Output Protocol

**CLI tools output format:**
- JSON mode (default): `output(result)` → `JSON.stringify` to stdout → `process.exit(0)`
- Raw mode (`--raw`): `output(result, true, rawValue)` → plain string to stdout → `process.exit(0)`
- Large output (>50KB): Write JSON to tmpfile → output `@file:/path` prefix to stdout
- Errors: Always stderr → `process.exit(1)`

---

*Convention analysis: 2026-03-05*
