# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Pi Extension with CLI Tooling and Markdown-as-Code Workflow Engine

**Key Characteristics:**
- Extension layer registers commands and events with Pi SDK
- CLI tool (`gsd-tools.cjs`) centralizes all file/state operations
- Workflows, agents, templates, and references are Markdown documents consumed by LLMs
- File-based state machine (`.planning/` directory is the database)
- Zero runtime dependencies — only Node.js built-ins

## Layers

**Extension Layer (`extensions/gsd/`):**
- Purpose: Pi SDK integration — command registration, event handling, path resolution
- Contains: `index.ts` (entrypoint, event subscriptions), `commands.ts` (command discovery/registration), `path-resolver.ts` (GSD path rewriting)
- Depends on: Pi SDK (`@mariozechner/pi-coding-agent`), file system
- Used by: Pi runtime (loaded at startup)

**CLI Tool Layer (`gsd/bin/`):**
- Purpose: Deterministic operations on `.planning/` files — state updates, phase management, git commits, validation
- Contains: `gsd-tools.cjs` (router), `lib/*.cjs` (9 modules: core, state, phase, roadmap, config, verify, template, milestone, frontmatter, init, commands)
- Depends on: Node.js built-ins only (`fs`, `path`, `child_process`)
- Used by: Workflows (via `node gsd-tools.cjs <command>`), agents (same), extension events

**Workflow Layer (`gsd/workflows/`):**
- Purpose: Multi-step procedures that orchestrate the full project lifecycle
- Contains: ~30 `.md` files defining step-by-step processes (new-project, plan-phase, execute-phase, etc.)
- Depends on: CLI tools (for state operations), agents (for LLM-driven work), templates (for output structure)
- Used by: Slash commands (each command references a workflow)

**Agent Layer (`agents/`):**
- Purpose: Specialized LLM agents spawned as subagents with focused roles
- Contains: 11 `.md` agent definitions (planner, executor, researcher, verifier, mapper, roadmapper, debugger, etc.)
- Depends on: Templates (output format), CLI tools (state management)
- Used by: Workflows (spawn agents for specific tasks)

**Command Layer (`commands/gsd/`):**
- Purpose: Slash command definitions that bridge user input to workflows
- Contains: ~30 `.md` files with frontmatter (name, description) and body (workflow invocation)
- Depends on: Workflows (referenced via `@` path includes)
- Used by: Extension (registered as `/gsd:*` commands)

**Template Layer (`gsd/templates/`):**
- Purpose: Document structures that define output format for generated files
- Contains: Templates for PROJECT.md, ROADMAP.md, PLAN.md, SUMMARY.md, STATE.md, research outputs, codebase maps, verification reports
- Depends on: Nothing
- Used by: Agents (follow template structure when writing), CLI tools (template fill command)

**Reference Layer (`gsd/references/`):**
- Purpose: Principle documents and shared knowledge referenced by workflows/agents
- Contains: questioning.md, ui-brand.md, verification-patterns.md, tdd.md, model-profiles.md, etc.
- Depends on: Nothing
- Used by: Workflows and agents (loaded for context)

## Data Flow

**Slash Command Execution:**

1. User types `/gsd:new-project` in Pi
2. Extension handler reads `commands/gsd/new-project.md`
3. Path resolver rewrites `~/.claude/get-shit-done/` → local `gsd/` paths
4. Execution context transformer converts `@path` references to Read instructions
5. Transformed prompt sent as user message to LLM
6. LLM follows workflow from `gsd/workflows/new-project.md`
7. Workflow calls `node gsd-tools.cjs init new-project` for context
8. Workflow spawns agents (planner, researcher, etc.) via subagent tool
9. Agents write artifacts to `.planning/` using templates
10. CLI tools commit artifacts to git

**CLI Tool Invocation:**

1. Workflow/agent runs `node gsd-tools.cjs <command> [args]`
2. `gsd-tools.cjs` routes to appropriate module (`lib/*.cjs`)
3. Module reads/writes `.planning/` files (config.json, STATE.md, ROADMAP.md, etc.)
4. Module outputs JSON result to stdout
5. Calling LLM parses JSON and continues workflow

**State Management:**
- File-based: All state in `.planning/` directory
- STATE.md has dual representation: human-readable Markdown body + machine-readable YAML frontmatter
- Frontmatter auto-synced on every write via `writeStateMd()` in `state.cjs`
- Each CLI tool write is atomic (read → transform → write)

## Key Abstractions

**Path Resolver (`GsdPathResolver`):**
- Purpose: Bridge between Claude Code paths (`~/.claude/get-shit-done/`) and Pi extension paths
- Location: `extensions/gsd/path-resolver.ts`
- Pattern: 4-rule rewrite chain applied to command bodies at invocation time
- Critical for: Making upstream GSD markdown work unchanged in Pi context

**Init Commands:**
- Purpose: Pre-compute all context needed for a workflow in a single CLI call
- Location: `gsd/bin/lib/init.cjs`
- Pattern: Returns JSON with models, file existence, phase info, config values
- Examples: `init new-project`, `init plan-phase 3`, `init execute-phase 5`

**Frontmatter System:**
- Purpose: Structured metadata in Markdown files (PLAN.md, SUMMARY.md, STATE.md)
- Location: `gsd/bin/lib/frontmatter.cjs`
- Pattern: Custom YAML parser (not a dependency), extract/reconstruct/splice/validate operations
- ADR: `docs/adr/001-custom-yaml-parser.md`

**Phase Directory Structure:**
- Purpose: Organize artifacts by phase number
- Location: `.planning/phases/{NN}-{slug}/`
- Pattern: `{NN}-{slug}/` directories containing `{NN}-{plan}-PLAN.md`, `{NN}-{plan}-SUMMARY.md`
- Supports: Integer phases (01, 02), decimal phases (03.1, 03.2), letter suffixes (12A)

## Entry Points

**Extension Entry (`extensions/gsd/index.ts`):**
- Triggers: Pi loads extension at startup via `package.json` `pi.extensions`
- Responsibilities: Initialize path resolver, register commands, subscribe to events

**CLI Entry (`gsd/bin/gsd-tools.cjs`):**
- Triggers: `node gsd-tools.cjs <command>` from bash
- Responsibilities: Route command, execute operation, output JSON

**Command Entry (`commands/gsd/*.md`):**
- Triggers: User types `/gsd:{name}` in Pi
- Responsibilities: Define execution context, reference workflow, inject arguments

## Error Handling

**Strategy:** Graceful degradation with informative error messages

**Patterns:**
- Extension: Silent degradation if `gsd/` or `gsd-tools.cjs` not found (stderr warning, return early)
- CLI tools: `error()` function writes to stderr and exits with code 1
- JSON output: Errors included in result object (`{ error: "message" }`)
- Missing files: Functions return null/empty rather than throwing (e.g., `safeReadFile`, `loadConfig` defaults)
- Git operations: `execGit` catches errors, returns `{ exitCode, stdout, stderr }`

## Cross-Cutting Concerns

**Path Resolution:**
- Centralized in `GsdPathResolver` class
- 4-rule rewrite chain handles all GSD path formats
- Applied at command invocation time (not at registration)

**Configuration:**
- `loadConfig()` in `core.cjs` reads `.planning/config.json` with full defaults
- Supports nested values, workflow subsections, model overrides
- `~/.gsd/defaults.json` for user-level preferences

**Model Resolution:**
- `MODEL_PROFILES` table in `core.cjs` maps agent types → model per profile
- 3 profiles: quality (opus-heavy), balanced (sonnet), budget (haiku)
- Per-agent overrides via `config.json` `model_overrides`

---

*Architecture analysis: 2026-03-05*
*Update when major patterns change*
