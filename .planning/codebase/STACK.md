# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript 5.x - Extension layer (`extensions/gsd/*.ts`) and all test files (`tests/*.test.ts`)
- CommonJS JavaScript - CLI tooling (`gsd/bin/gsd-tools.cjs`, `gsd/bin/lib/*.cjs`)

**Secondary:**
- Markdown - Workflow engine, agent definitions, command definitions, templates, references (~80% of content by file count)
- JSON - Configuration (`package.json`, `tsconfig.json`, `.planning/config.json`)

## Runtime

**Environment:**
- Node.js (ES2022 target) - All executable code
- No browser runtime (CLI/extension tool only)
- Pi coding agent host runtime - Extension loaded by Pi at startup

**Package Manager:**
- npm (implied by `package.json`, no `package-lock.json` observed)
- Lockfile: Not present

## Frameworks

**Core:**
- Pi Extension SDK (`@mariozechner/pi-coding-agent`) - Host runtime API for registering commands and lifecycle events

**Testing:**
- Custom test runner (`tests/run-all.ts`) - No jest/mocha/vitest
- `node:assert` (strict mode) - Assertion library
- `tsx` 4.x - TypeScript execution without build step

**Build/Dev:**
- TypeScript 5.x - Type checking and compilation (`tsconfig.json`)
- `tsx` 4.x - Direct TypeScript execution for tests and development

## Key Dependencies

**Critical:**
- `@mariozechner/pi-coding-agent` (peer) - Pi Extension SDK; provides `ExtensionAPI` type and runtime hooks
- `tsx` ^4.0.0 (dev) - TypeScript execution for tests

**Infrastructure:**
- Node.js built-ins only for CLI tooling (`fs`, `path`, `child_process`, `os`) - Zero external runtime dependencies (ADR-004)

## Configuration

**Environment:**
- `GSD_HOME` - Set automatically by `GsdPathResolver` constructor at extension load time; points to `gsd/` directory
- No `.env` files required
- Optional: `BRAVE_API_KEY` for web research via `gsd-tools.cjs websearch`

**Build:**
- `tsconfig.json` - ES2022 target, ESNext modules, bundler resolution, strict mode
- `package.json` - Defines `pi.extensions` and `pi.agents` entry points for Pi discovery

**Project-Level:**
- `.planning/config.json` - Per-project GSD settings (model profile, commit behavior, branching strategy, feature flags)
- Config cascade: hardcoded defaults → `~/.gsd/defaults.json` → `.planning/config.json`

## Platform Requirements

**Development:**
- Any platform with Node.js and Pi coding agent installed
- `git` binary required for commit operations
- No Docker or external services needed

**Production:**
- Runs as a Pi coding agent extension (loaded via `package.json` → `pi.extensions`)
- Requires Pi coding agent host (`@mariozechner/pi-coding-agent`)
- No standalone deployment — embedded in the Pi process

---

*Stack analysis: 2026-03-05*
*Update after major dependency changes*
