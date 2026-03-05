# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** 6-Layer Extension Architecture (Markdown-as-Code)

**Key Characteristics:**
- Pi coding agent extension — no standalone runtime
- Markdown-as-code: workflows and agents are markdown files read by the LLM as instructions
- Deterministic/non-deterministic split: LLMs handle reasoning, `gsd-tools.cjs` handles file I/O and state
- File-based state machine: all project state in `.planning/` directory
- Zero external runtime dependencies (ADR-004)

## Layers

**Layer 1 — Pi Extension (TypeScript):**
- Purpose: Register commands, hook lifecycle events, resolve paths
- Location: `extensions/gsd/index.ts`, `extensions/gsd/commands.ts`, `extensions/gsd/path-resolver.ts`
- Contains: Extension factory, command discovery, path rewriting pipeline, event handlers
- Depends on: Pi Extension SDK (`@mariozechner/pi-coding-agent`)
- Used by: Pi host runtime (loaded at startup)

**Layer 2 — Command Definitions (Markdown):**
- Purpose: User-facing `/gsd:*` slash command definitions with YAML frontmatter metadata
- Location: `commands/gsd/*.md` (30+ files)
- Contains: Command name, description, argument hints, execution context references to workflows
- Depends on: Path resolver for `@`-path resolution
- Used by: Extension layer (discovered, registered, transformed at invocation)

**Layer 3 — Workflow Engine (Markdown):**
- Purpose: Multi-step orchestration logic the LLM follows step-by-step
- Location: `gsd/workflows/*.md` (30+ files, 11K total lines)
- Contains: Step-by-step instructions, decision trees, subagent spawn directives, gsd-tools calls
- Depends on: CLI tooling for deterministic ops, agents for delegated work, templates for document generation
- Used by: Commands (via `<execution_context>` blocks referencing workflow files)

**Layer 4 — Agent Definitions (Markdown):**
- Purpose: Specialized LLM agent roles spawned as subagents
- Location: `agents/*.md` (11 files, 7.5K total lines)
- Contains: Role definition, process steps, templates, critical rules
- Depends on: CLI tooling, templates/references
- Used by: Workflows (spawn agents via Pi subagent tool)

**Layer 5 — CLI Tooling (CommonJS):**
- Purpose: All deterministic operations — file I/O, git, config, state management
- Location: `gsd/bin/gsd-tools.cjs` (router, 592 lines) + `gsd/bin/lib/*.cjs` (11 modules, ~5400 lines)
- Contains: 80+ commands organized into state, phase, roadmap, verify, frontmatter, template, milestone, config, init modules
- Depends on: Node.js built-ins only (`fs`, `path`, `child_process`, `os`)
- Used by: Workflows and agents (via `node gsd-tools.cjs <command>`)

**Layer 6 — Templates & References (Markdown/JSON):**
- Purpose: Document templates and reference documentation
- Location: `gsd/templates/*.md`, `gsd/templates/codebase/*.md`, `gsd/references/*.md`
- Contains: Template structures with placeholders, philosophy documents, configuration guides
- Depends on: Nothing (passive, read-only)
- Used by: Agents (read templates when generating documents), workflows (reference docs for guidance)

## Data Flow

**Command Invocation Flow:**

1. User types `/gsd:plan-phase 3` in Pi
2. Extension layer (`commands.ts`) re-reads `commands/gsd/plan-phase.md` from disk (hot-reload)
3. `GsdPathResolver.transform()` applies 3-stage pipeline: rewrite paths → transform `<execution_context>` → inject arguments
4. Transformed markdown sent as user message via `pi.sendUserMessage()`
5. LLM reads the workflow referenced in `<execution_context>` (e.g., `gsd/workflows/plan-phase.md`)
6. LLM follows workflow steps: calls `gsd-tools.cjs init plan-phase 3` for context, spawns `gsd-planner` subagent
7. Subagent writes `PLAN.md` to `.planning/phases/03-*/`
8. Orchestrator commits via `gsd-tools.cjs commit`

**State Management:**
- All state in `.planning/` directory — markdown and JSON files
- `STATE.md` uses dual representation: YAML frontmatter (machine-readable) + markdown body (human-readable), kept in sync by `state.cjs`
- Config cascade: hardcoded defaults → `~/.gsd/defaults.json` → `.planning/config.json`
- No in-memory state across sessions; each session reconstructs from files

**Init Command Pattern:**
- `gsd-tools.cjs init <workflow> [args]` assembles all context a workflow needs into a single JSON payload
- Avoids multiple sequential tool calls at workflow start
- Examples: `init execute-phase 3`, `init plan-phase 2`, `init new-project`

## Key Abstractions

**Path Resolver:**
- Purpose: Bridge GSD's canonical paths (from Claude Code origins) to actual Pi installation
- Implementation: `extensions/gsd/path-resolver.ts` → `GsdPathResolver` class
- Pattern: 3-stage transform pipeline (rewrite → context transform → argument injection)
- Critical: If this breaks, all commands fail

**Command-as-User-Message (ADR-011):**
- Purpose: Convert markdown command files into LLM prompts
- Implementation: `extensions/gsd/commands.ts` → `registerGsdCommands()`
- Pattern: Read `.md`, strip frontmatter, transform paths, send as user message

**Init Compound Commands:**
- Purpose: Assemble all context a workflow needs in one call
- Implementation: `gsd/bin/lib/init.cjs` (710 lines)
- Pattern: Each `init <workflow>` function gathers config, state, phase info, model resolution into a single JSON blob

**Frontmatter Engine:**
- Purpose: Parse/serialize YAML frontmatter in markdown files (custom parser, ADR-001)
- Implementation: `gsd/bin/lib/frontmatter.cjs` (299 lines)
- Pattern: `extractFrontmatter()` / `reconstructFrontmatter()` — handles nested objects, arrays, inline arrays

## Entry Points

**Extension Entry:**
- Location: `extensions/gsd/index.ts` (default export function)
- Triggers: Pi loads extension at startup via `package.json` → `pi.extensions`
- Responsibilities: Initialize path resolver, register commands, subscribe to 3 lifecycle events

**CLI Entry:**
- Location: `gsd/bin/gsd-tools.cjs` (shebang `#!/usr/bin/env node`)
- Triggers: `node gsd-tools.cjs <command> [args]` from within LLM-executed workflows
- Responsibilities: Route to appropriate library module, output JSON to stdout

**Command Discovery:**
- Location: `extensions/gsd/commands.ts` → `registerGsdCommands()`
- Triggers: Extension load (called from `index.ts`)
- Responsibilities: Scan `commands/gsd/*.md`, parse frontmatter, register each as Pi command

## Error Handling

**Strategy:** Fail-fast with structured error output

**Patterns:**
- CLI tooling: `error()` function writes to stderr and calls `process.exit(1)` — no retry logic, no partial results
- Extension layer: `try/catch` with `ctx.ui.notify()` for user-facing errors, `process.stderr.write()` for initialization failures
- Graceful degradation: Extension checks for `gsd/` directory and `gsd-tools.cjs` existence before registering commands; silently skips if missing (ADR-008)
- Workflows: LLM checks `gsd-tools` exit codes and handles failures in markdown instructions

## Cross-Cutting Concerns

**Logging:**
- stderr for errors and initialization messages (`[pi-gsd]` prefix)
- stdout for structured JSON output from CLI commands
- No logging framework; `console.log`/`console.error` not used in production code

**Validation:**
- Frontmatter schema validation via `gsd-tools.cjs frontmatter validate` (plan, summary, verification schemas)
- `gsd-tools.cjs validate consistency` checks phase numbering and disk/roadmap sync
- `gsd-tools.cjs validate health` checks `.planning/` integrity with optional `--repair`

**Model Selection:**
- Per-agent model resolution via `MODEL_PROFILES` table in `gsd/bin/lib/core.cjs`
- 3 profiles: quality (opus-heavy), balanced (mixed), budget (haiku-heavy)
- Profile set in `.planning/config.json` → `model_profile` field

---

*Architecture analysis: 2026-03-05*
*Update when major patterns change*
