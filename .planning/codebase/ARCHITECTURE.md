# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Prompt-driven orchestration system — a Pi extension that converts markdown workflow definitions into executable LLM agent sequences.

**Key Characteristics:**
- **Extension-as-bridge:** TypeScript extension layer (`extensions/gsd/`) bridges between Pi coding agent runtime and GSD workflow engine
- **Markdown-as-code:** Agents (`agents/*.md`), commands (`commands/gsd/*.md`), and workflows (`gsd/workflows/*.md`) are all markdown files that become LLM prompts
- **CLI tooling layer:** `gsd-tools.cjs` provides deterministic operations (file I/O, git, config) called from within agent prompts via `node gsd/bin/gsd-tools.cjs <command>`
- **File-based state machine:** `.planning/` directory tree IS the project state — no database, no process memory
- **Orchestrator pattern:** Workflow `.md` files define multi-step orchestrations that spawn subagents via Pi's Task/subagent mechanism

## Layers

**Layer 1: Pi Extension (TypeScript)**
- Purpose: Register commands, inject system prompt, rewrite paths
- Location: `extensions/gsd/`
- Contains: `index.ts` (entry), `commands.ts` (command registration), `path-resolver.ts` (path rewriting)
- Depends on: Pi coding agent SDK (`@mariozechner/pi-coding-agent`)
- Used by: Pi runtime (loaded at startup via `package.json` `"pi"` field)

**Layer 2: Command Definitions (Markdown)**
- Purpose: Define user-facing `/gsd:*` slash commands with frontmatter metadata
- Location: `commands/gsd/*.md`
- Contains: 30 command files (e.g., `plan-phase.md`, `execute-phase.md`, `quick.md`)
- Depends on: `extensions/gsd/commands.ts` for discovery and registration
- Used by: Pi runtime (commands registered at extension load)

**Layer 3: Workflow Engine (Markdown)**
- Purpose: Define multi-step orchestration logic that the LLM follows
- Location: `gsd/workflows/*.md`
- Contains: 30+ workflow files defining step-by-step processes
- Depends on: `gsd/bin/gsd-tools.cjs` for deterministic operations
- Used by: LLM (read via `<execution_context>` blocks in command definitions)

**Layer 4: Agent Definitions (Markdown)**
- Purpose: Define specialized LLM agent roles with instructions, constraints, and templates
- Location: `agents/*.md`
- Contains: 11 agent definitions (planner, executor, verifier, debugger, etc.)
- Depends on: Workflow context provided by orchestrator
- Used by: Pi subagent system (spawned by workflows via Task/subagent tool)

**Layer 5: CLI Tooling (CommonJS)**
- Purpose: Deterministic operations — config, state, git, validation, scaffolding
- Location: `gsd/bin/gsd-tools.cjs`, `gsd/bin/lib/*.cjs`
- Contains: 11 library modules with 80+ commands
- Depends on: Node.js built-ins only (`fs`, `path`, `child_process`, `os`)
- Used by: Workflows and agents via `node gsd/bin/gsd-tools.cjs <command>`

**Layer 6: Templates & References (Markdown)**
- Purpose: Provide document templates and reference documentation for agents
- Location: `gsd/templates/`, `gsd/references/`
- Contains: Document templates (summary, plan, state, etc.), reference guides (checkpoints, git, model profiles)
- Depends on: Nothing
- Used by: Agent definitions reference these for consistent document generation

## Data Flow

**Command Invocation Flow:**
1. User types `/gsd:plan-phase 3`
2. Pi runtime matches registered command → `extensions/gsd/commands.ts:handler()`
3. Handler reads `commands/gsd/plan-phase.md`, strips frontmatter
4. `GsdPathResolver.transform()` rewrites paths → transforms `<execution_context>` → injects args
5. Transformed markdown sent as user message via `pi.sendUserMessage()`
6. LLM reads the workflow instruction, follows steps, calls tools/subagents

**State Management:**
- All state lives in `.planning/` directory tree as markdown/JSON files
- `gsd-tools.cjs` provides atomic read/update operations on state files
- STATE.md has YAML frontmatter synced on every write (`writeStateMd()` in `gsd/bin/lib/state.cjs`)
- Config lives in `.planning/config.json` with defaults from `~/.gsd/defaults.json`

**Agent Spawning Flow:**
1. Workflow markdown instructs LLM: `Task(subagent_type="gsd-planner", ...)`
2. Pi maps to subagent tool call with agent from `agents/gsd-planner.md`
3. Subagent reads plan context, executes, writes artifacts directly to `.planning/`
4. Orchestrator reads confirmations/results from subagent output

## Key Abstractions

**GsdPathResolver:**
- Purpose: Bridge between GSD's canonical paths and actual installation location
- Location: `extensions/gsd/path-resolver.ts`
- Pattern: 3-stage transform pipeline (rewritePaths → transformExecutionContext → injectArguments)
- Critical because: GSD was originally designed for `~/.claude/get-shit-done/` — resolver makes it work as a Pi extension at any install path

**gsd-tools.cjs Init Commands:**
- Purpose: Single-call context assembly for each workflow type
- Location: `gsd/bin/lib/init.cjs`
- Pattern: `init <workflow> [args]` returns JSON with all context a workflow needs (models, config, paths, state)
- Examples: `init execute-phase 3`, `init plan-phase 5`, `init quick "description"`, `init map-codebase`

**YAML Frontmatter:**
- Purpose: Machine-readable metadata in markdown files
- Location: `gsd/bin/lib/frontmatter.cjs`
- Pattern: Custom YAML parser (not a full YAML spec — handles nested objects, arrays, key-value pairs)
- Used by: PLAN.md, SUMMARY.md, VERIFICATION.md, STATE.md for structured data extraction

**Model Profile Resolution:**
- Purpose: Map agent types to model names based on quality/balanced/budget profile
- Location: `gsd/bin/lib/core.cjs:MODEL_PROFILES` table + `resolveModelInternal()`
- Pattern: Lookup table with per-agent override support via `config.model_overrides`

## Entry Points

**Extension Load:**
- Location: `extensions/gsd/index.ts:export default function(pi)`
- Triggers: Pi startup when package is installed
- Responsibilities: Initialize path resolver, register commands, subscribe to events

**CLI Tool:**
- Location: `gsd/bin/gsd-tools.cjs:main()`
- Triggers: `node gsd/bin/gsd-tools.cjs <command> [args]` from bash
- Responsibilities: Route to command handlers in `gsd/bin/lib/*.cjs`

**Test Runner:**
- Location: `tests/run-all.ts`
- Triggers: `npx tsx tests/run-all.ts`
- Responsibilities: Discover and execute all `*.test.ts` files

## Error Handling

**Strategy:** Fail-fast with descriptive messages. No retry logic.

**Patterns:**
- `gsd/bin/lib/core.cjs:error(message)` — Write to stderr and `process.exit(1)`
- Extension graceful degradation: If `gsd/` or `gsd/bin/gsd-tools.cjs` missing, writes to stderr and returns (extension does not crash pi)
- Init commands return `null`/`false` fields rather than throwing when optional resources missing
- `safeReadFile()` returns `null` on failure, never throws

## Cross-Cutting Concerns

**Logging:** stderr only for fatal errors. No structured logging.
**Validation:** `gsd/bin/lib/verify.cjs` provides plan structure validation, phase completeness checks, reference resolution, commit verification, health checks
**Authentication:** None — delegates to pi runtime and external tool CLIs

---

*Architecture analysis: 2026-03-05*
