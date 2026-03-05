# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript 5.x — Extension code (`extensions/gsd/`), test suite (`tests/`)
- JavaScript (CommonJS) — Runtime CLI tooling (`gsd/bin/`)
- Markdown — Agent definitions (`agents/`), command definitions (`commands/gsd/`), workflows (`gsd/workflows/`), templates (`gsd/templates/`), references (`gsd/references/`)

**Secondary:**
- YAML (embedded) — Frontmatter in `.md` files parsed by `gsd/bin/lib/frontmatter.cjs`
- JSON — Configuration (`package.json`, `.planning/config.json`, template `gsd/templates/config.json`)

## Runtime

**Environment:**
- Node.js 20+ (uses `node:fs`, `node:path`, `node:child_process`, `node:assert`)
- Pi coding agent (`@mariozechner/pi-coding-agent`) — host runtime that loads the extension

**Package Manager:**
- npm
- Lockfile: not present (devDependencies only — `tsx`, `typescript`)

## Frameworks

**Core:**
- Pi Extension SDK (`@mariozechner/pi-coding-agent`) — Extension API used by `extensions/gsd/index.ts`
  - Events: `before_agent_start`, `tool_call`, `session_start`
  - APIs: `pi.on()`, `pi.registerCommand()`, `pi.sendUserMessage()`

**Testing:**
- Node.js built-in `node:assert` — All test files
- Custom test harness (`tests/harness/`) — mock API, lifecycle helpers, diagnostics
- `tsx` 4.x — TypeScript execution for tests (no compilation step)

**Build/Dev:**
- TypeScript 5.x — Type checking only (`tsconfig.json` with `target: ES2022`, `module: ESNext`)
- `tsx` — Direct `.ts` execution for tests
- No bundler — Extension loaded via `jiti` by pi runtime (TypeScript runs directly)

## Key Dependencies

**Critical:**
- `@mariozechner/pi-coding-agent` — Host runtime providing `ExtensionAPI` type and event system. Extension entry point (`extensions/gsd/index.ts`) imports this. Not listed in `package.json` — provided by the pi runtime at load time.

**Infrastructure:**
- `tsx` ^4.0.0 (devDependency) — Run TypeScript tests without compilation
- `typescript` ^5.0.0 (devDependency) — Type checking

**Runtime (zero npm dependencies):**
- `gsd/bin/gsd-tools.cjs` and all `gsd/bin/lib/*.cjs` use only Node.js built-ins (`fs`, `path`, `child_process`, `os`)
- The extension code (`extensions/gsd/`) uses only Node.js built-ins (`fs`, `path`)
- No external runtime dependencies — fully self-contained

## Configuration

**Environment:**
- `GSD_HOME` — Set by `GsdPathResolver` constructor in `extensions/gsd/path-resolver.ts` to `{packageRoot}/gsd/`
- `BRAVE_API_KEY` (optional) — Enables web search via `gsd-tools.cjs websearch` command
- `~/.gsd/brave_api_key` (optional) — Alternative file-based Brave Search key
- `~/.gsd/defaults.json` (optional) — User-level default config for new projects

**Build:**
- `tsconfig.json` — `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict: true`
- No build step required — TypeScript compiled on-the-fly by pi's `jiti` loader

**Project-level config:**
- `.planning/config.json` — Per-project GSD settings (model profile, workflow toggles, branching strategy, parallelization)
- Created by `gsd/bin/lib/config.cjs:cmdConfigEnsureSection()` with defaults from `gsd/templates/config.json` merged with `~/.gsd/defaults.json`

## Platform Requirements

**Development:**
- Node.js 20+
- Pi coding agent installed (`@mariozechner/pi-coding-agent`)
- Git (for commit operations via `gsd-tools.cjs commit`)

**Production:**
- Installed as a Pi extension package via `package.json` `"pi"` field
- No separate deployment — runs inside the pi coding agent process

---

*Stack analysis: 2026-03-05*
