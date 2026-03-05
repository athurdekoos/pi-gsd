# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
pi-gsd/
├── agents/                 # LLM agent definitions (11 agents)
├── commands/               # Slash command definitions
│   └── gsd/               # /gsd:* commands (~30 .md files)
├── docs/                   # Developer documentation
│   ├── adr/               # Architecture Decision Records (12 ADRs)
│   ├── architecture/      # Architecture docs
│   ├── flows/             # Data flow documentation
│   ├── modules/           # Module-level docs
│   ├── ops/               # Operations (debugging, deployment, testing)
│   └── security-reliability.md
├── extensions/             # Pi extension source
│   └── gsd/               # Extension entrypoint + helpers (3 .ts files)
├── gsd/                    # GSD runtime resources
│   ├── bin/               # CLI tooling
│   │   ├── gsd-tools.cjs  # Main CLI router
│   │   └── lib/           # 11 CJS library modules
│   ├── references/        # Principle documents (~14 .md files)
│   ├── templates/         # Output templates
│   │   ├── codebase/     # Codebase map templates (7 files)
│   │   └── research-project/ # Research output templates (5 files)
│   └── workflows/         # Multi-step workflow definitions (~30 .md files)
├── tests/                  # Test suite
│   ├── harness/           # Custom test harness (5 files)
│   ├── helpers/           # Test helpers
│   └── *.test.ts          # Test files (~19 suites)
├── package.json            # Pi extension manifest
└── tsconfig.json           # TypeScript configuration
```

## Directory Purposes

**`agents/`:**
- Purpose: Specialized LLM agent definitions spawned as subagents
- Contains: 11 `.md` files with frontmatter (name, description, tools, color) and role/instruction body
- Key files: `gsd-planner.md`, `gsd-executor.md`, `gsd-roadmapper.md`, `gsd-codebase-mapper.md`, `gsd-verifier.md`
- Pattern: `gsd-{role}.md`

**`commands/gsd/`:**
- Purpose: Slash command definitions registered as `/gsd:{name}`
- Contains: ~30 `.md` files with YAML frontmatter and execution body
- Key files: `new-project.md`, `plan-phase.md`, `execute-phase.md`, `progress.md`, `help.md`
- Pattern: `{command-name}.md` → `/gsd:{command-name}`

**`extensions/gsd/`:**
- Purpose: Pi extension integration layer (entrypoint, command registration, path resolution)
- Contains: 3 TypeScript files
- Key files: `index.ts` (extension factory), `commands.ts` (command discovery/registration), `path-resolver.ts` (path rewriting)

**`gsd/bin/`:**
- Purpose: CLI tooling — all deterministic file operations
- Contains: `gsd-tools.cjs` (router, ~350 lines) + `lib/` with 11 CJS modules
- Key files: `lib/core.cjs` (shared utils, model profiles), `lib/state.cjs` (STATE.md operations), `lib/phase.cjs` (phase CRUD), `lib/init.cjs` (compound init commands)
- Subdirectories: `lib/` (all library modules)

**`gsd/workflows/`:**
- Purpose: Multi-step procedures that define the full project lifecycle
- Contains: ~30 `.md` files with XML-tagged process steps
- Key files: `new-project.md`, `plan-phase.md`, `execute-phase.md`, `map-codebase.md`, `verify-phase.md`

**`gsd/references/`:**
- Purpose: Shared knowledge documents referenced by workflows and agents
- Contains: ~14 `.md` files
- Key files: `questioning.md` (project questioning guide), `ui-brand.md` (visual patterns), `verification-patterns.md`, `model-profiles.md`, `tdd.md`

**`gsd/templates/`:**
- Purpose: Document templates defining output structure
- Contains: ~20 `.md` template files + subdirectories
- Key files: `project.md`, `roadmap.md`, `requirements.md`, `state.md`, `summary.md`
- Subdirectories: `codebase/` (7 mapping templates), `research-project/` (5 research templates)

**`tests/`:**
- Purpose: Comprehensive test suite with custom harness
- Contains: ~19 test files + harness infrastructure
- Key files: `run-all.ts` (unified runner), `compliance.test.ts`, `e2e-smoke.test.ts`
- Subdirectories: `harness/` (MockExtensionAPI, lifecycle utilities, diagnostics), `helpers/`

**`docs/`:**
- Purpose: Developer documentation
- Contains: Architecture docs, ADRs, flow diagrams, module docs, ops guides
- Subdirectories: `adr/` (12 architecture decision records), `architecture/`, `flows/`, `modules/`, `ops/`

## Key File Locations

**Entry Points:**
- `extensions/gsd/index.ts` - Pi extension factory (loaded at startup)
- `gsd/bin/gsd-tools.cjs` - CLI tool entry (invoked via `node gsd-tools.cjs`)

**Configuration:**
- `package.json` - Extension manifest with `pi.extensions` and `pi.agents`
- `tsconfig.json` - TypeScript compiler options (ES2022, strict)
- `gsd/templates/config.json` - Default config template

**Core Logic:**
- `gsd/bin/lib/core.cjs` - Shared utilities, model profiles, git helpers, phase utilities
- `gsd/bin/lib/state.cjs` - STATE.md read/write/sync, frontmatter generation
- `gsd/bin/lib/phase.cjs` - Phase CRUD (add, insert, remove, complete, find)
- `gsd/bin/lib/init.cjs` - Compound init commands for all workflows
- `gsd/bin/lib/frontmatter.cjs` - YAML frontmatter parser/serializer
- `gsd/bin/lib/roadmap.cjs` - ROADMAP.md parsing and updates
- `gsd/bin/lib/verify.cjs` - Verification suite (plans, summaries, consistency, health)
- `gsd/bin/lib/milestone.cjs` - Milestone completion and requirements tracking
- `gsd/bin/lib/template.cjs` - Template selection and fill operations
- `gsd/bin/lib/config.cjs` - Config CRUD (ensure, set, get)
- `gsd/bin/lib/commands.cjs` - Standalone utility commands (slug, timestamp, commit, search)

**Testing:**
- `tests/run-all.ts` - Unified test runner (19 suites)
- `tests/harness/mock-api.ts` - MockExtensionAPI for testing
- `tests/harness/lifecycle.ts` - Temp directories, env snapshots
- `tests/harness/diagnostic.ts` - Test result formatting

## Naming Conventions

**Files:**
- `kebab-case.md` for all Markdown files (commands, workflows, agents, templates, references)
- `kebab-case.ts` for TypeScript source files
- `kebab-case.cjs` for CommonJS modules
- `UPPERCASE.md` for generated project artifacts (PLAN.md, SUMMARY.md, STATE.md, ROADMAP.md)
- `kebab-case.test.ts` for test files

**Directories:**
- `kebab-case` for all directories
- Prefix pattern in `.planning/phases/`: `{NN}-{slug}/` (e.g., `01-setup/`, `03.1-hotfix/`)

**Special Patterns:**
- `gsd-{role}.md` for agent definitions
- `{command-name}.md` for slash commands
- `{NN}-{plan}-PLAN.md` / `{NN}-{plan}-SUMMARY.md` for phase artifacts
- Frontmatter fields use `snake_case` or `kebab-case` depending on context

## Where to Add New Code

**New Slash Command:**
- Definition: `commands/gsd/{command-name}.md`
- Workflow: `gsd/workflows/{command-name}.md`
- Tests: `tests/parity-files.test.ts` (checks command ↔ workflow parity)

**New Agent:**
- Definition: `agents/gsd-{role}.md`
- Model profile: Add row to `MODEL_PROFILES` in `gsd/bin/lib/core.cjs`
- Tests: `tests/parity-agents.test.ts` (checks agent ↔ model profile parity)

**New CLI Tool Command:**
- Router: Add case in `gsd/bin/gsd-tools.cjs` main switch
- Implementation: Add function in appropriate `gsd/bin/lib/*.cjs` module
- Init compound: If workflow needs it, add `cmdInit*` in `gsd/bin/lib/init.cjs`

**New Template:**
- Template: `gsd/templates/{name}.md` or `gsd/templates/{category}/{name}.md`

**New Reference:**
- Document: `gsd/references/{name}.md`

**New Test:**
- Test file: `tests/{category}-{name}.test.ts`
- Register in: `tests/run-all.ts` SUITES array

## Special Directories

**`.planning/` (generated, per-project):**
- Purpose: Project state and artifacts — created by `/gsd:new-project`
- Source: Generated by CLI tools and agents during workflow execution
- Committed: Configurable via `config.json` `commit_docs` flag

**`gsd/bin/lib/` (source):**
- Purpose: CJS library modules loaded by gsd-tools.cjs
- Pattern: Each module exports functions, loaded via `require()`
- Critical: These are the ground truth for all `.planning/` file operations

---

*Structure analysis: 2026-03-05*
*Update when directory structure changes*
