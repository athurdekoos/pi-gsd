# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript 5.x - Extension layer (`extensions/gsd/`), all test files (`tests/`)

**Secondary:**
- JavaScript (CommonJS) - CLI tooling (`gsd/bin/`), all `.cjs` library modules

## Runtime

**Environment:**
- Node.js 20.x (LTS) - required for `node:` protocol imports and ES2022 features
- No browser runtime (CLI extension only)

**Package Manager:**
- npm - no lockfile committed (extension distributes via Pi package system)

## Frameworks

**Core:**
- Pi Coding Agent SDK (`@mariozechner/pi-coding-agent`) - Extension API, event system, command registration
- No web framework (pure CLI/extension)

**Testing:**
- Custom test harness (no framework) - `tests/harness/` provides MockExtensionAPI, lifecycle utilities, diagnostic formatting
- `tsx` 4.x - TypeScript execution without build step
- Node.js `assert` module for assertions

**Build/Dev:**
- TypeScript 5.x compiler (`tsc`) - type checking only, tsx handles execution
- `tsx` 4.x - Test runner and development execution

## Key Dependencies

**Critical (devDependencies only — zero runtime deps):**
- `tsx` ^4.0.0 - TypeScript execution for tests
- `typescript` ^5.0.0 - Type checking

**Runtime Built-ins:**
- `node:fs` - File system operations (config, state, phase management)
- `node:path` - Path resolution across extension/CLI/workflow layers
- `node:child_process` - Git operations (`execSync`), process spawning
- `node:assert` - Test assertions

**Pi SDK (peer dependency):**
- `@mariozechner/pi-coding-agent` - ExtensionAPI type, event system, command registration

## Configuration

**Environment:**
- No environment variables required for core operation
- Optional: `BRAVE_API_KEY` for web search in research workflows
- Optional: `~/.gsd/brave_api_key` file as alternative to env var
- `GSD_HOME` set automatically by path resolver at extension load

**Build:**
- `tsconfig.json` - ES2022 target, ESNext modules, bundler resolution, strict mode
- No build step required (tsx handles TypeScript directly)

**Project Configuration:**
- `.planning/config.json` - Per-project workflow preferences (model profile, commit docs, parallelization)
- `~/.gsd/defaults.json` - User-level global defaults (optional)
- `package.json` `pi` field - Extension and agent registration

## Platform Requirements

**Development:**
- Any platform with Node.js 20+
- Git required for commit operations
- Pi coding agent installed (`@mariozechner/pi-coding-agent`)

**Distribution:**
- Installed as Pi extension via `pi.extensions` in `package.json`
- Agents registered via `pi.agents` in `package.json`
- No compilation needed — tsx runs TypeScript directly

---

*Stack analysis: 2026-03-05*
*Update after major dependency changes*
