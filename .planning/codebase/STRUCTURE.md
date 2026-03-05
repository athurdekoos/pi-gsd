# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
pi-gsd/
├── extensions/gsd/        # Pi extension entry point (TypeScript, 3 files)
├── commands/gsd/          # /gsd:* slash command definitions (30+ .md files)
├── gsd/                   # GSD runtime resources
│   ├── bin/               # CLI tooling
│   │   ├── gsd-tools.cjs  # CLI router (592 lines)
│   │   └── lib/           # 11 library modules (~5400 lines total)
│   ├── workflows/         # Multi-step orchestration scripts (30+ .md files)
│   ├── templates/         # Document templates
│   │   ├── codebase/      # Codebase map templates (7 files)
│   │   └── research-project/ # Research output templates
│   └── references/        # Reference documentation (13 files)
├── agents/                # Subagent definitions (11 .md files)
├── tests/                 # Test suites
│   ├── harness/           # Test infrastructure (4 files)
│   └── helpers/           # Test helpers (1 file)
├── docs/                  # Project documentation
│   ├── architecture/      # Architecture docs (4 files)
│   ├── flows/             # Flow diagrams (6 files)
│   ├── modules/           # Module docs (6 files)
│   ├── ops/               # Operations docs (4 files)
│   └── adr/               # Architecture Decision Records (12 ADRs)
├── .planning/             # Project state (managed by GSD, gitignored partially)
│   └── codebase/          # Codebase map output
├── package.json           # Project manifest with Pi extension config
└── tsconfig.json          # TypeScript configuration
```

## Directory Purposes

**extensions/gsd/**
- Purpose: Pi Extension SDK integration layer
- Contains: 3 TypeScript files (~400 lines total)
- Key files:
  - `index.ts` - Extension factory (default export), lifecycle event handlers
  - `commands.ts` - Command discovery, frontmatter parsing, handler registration
  - `path-resolver.ts` - `GsdPathResolver` class: 4 rewrite rules, execution context transform, argument injection

**commands/gsd/**
- Purpose: User-facing `/gsd:*` slash command definitions
- Contains: 30+ markdown files with YAML frontmatter
- Key files:
  - `new-project.md` - Initialize a new GSD project
  - `plan-phase.md` - Plan a phase's implementation
  - `execute-phase.md` - Execute a planned phase
  - `map-codebase.md` - Map existing codebase
  - `help.md` - GSD help overview (also bare `/gsd`)
  - `quick.md` - Quick one-off tasks
  - `debug.md` - Debug session workflow

**gsd/bin/**
- Purpose: CLI tooling for deterministic operations
- Contains: `gsd-tools.cjs` (router) + `lib/` directory with 11 modules
- Key files:
  - `gsd-tools.cjs` - CLI entry point and command router (592 lines)
  - `lib/core.cjs` - Shared utilities, model profiles, path/config helpers (483 lines)
  - `lib/state.cjs` - STATE.md operations, progression engine (732 lines)
  - `lib/phase.cjs` - Phase CRUD, lifecycle, renumbering (901 lines)
  - `lib/init.cjs` - Compound init commands for workflow bootstrapping (710 lines)
  - `lib/verify.cjs` - Verification suite and health validation (773 lines)
  - `lib/frontmatter.cjs` - Custom YAML parser and CRUD (299 lines)
  - `lib/commands.cjs` - Standalone utility commands (548 lines)
  - `lib/roadmap.cjs` - Roadmap parsing and update (298 lines)
  - `lib/milestone.cjs` - Milestone lifecycle operations (267 lines)
  - `lib/template.cjs` - Template selection and fill (222 lines)
  - `lib/config.cjs` - Planning config CRUD (162 lines)

**gsd/workflows/**
- Purpose: Multi-step workflow orchestration read by the LLM
- Contains: 30+ markdown workflow files (~11K total lines)
- Key files:
  - `new-project.md` - Full project initialization (1116 lines)
  - `complete-milestone.md` - Milestone completion ceremony (763 lines)
  - `plan-phase.md` - Phase planning orchestration (541 lines)
  - `execute-phase.md` - Phase execution with wave parallelism (449 lines)
  - `execute-plan.md` - Single plan execution (448 lines)
  - `verify-work.md` - Post-execution verification (569 lines)
  - `map-codebase.md` - Codebase mapping orchestration (315 lines)
  - `quick.md` - Quick task workflow (453 lines)

**gsd/templates/**
- Purpose: Document templates for `.planning/` file generation
- Contains: Template markdown files with placeholder variables
- Key files:
  - `state.md` - STATE.md template
  - `project.md` - PROJECT.md template
  - `roadmap.md` - ROADMAP.md template
  - `requirements.md` - REQUIREMENTS.md template
  - `summary.md`, `summary-standard.md`, `summary-complex.md`, `summary-minimal.md` - Summary templates by complexity
  - `codebase/` - 7 codebase map templates (stack, architecture, structure, conventions, testing, integrations, concerns)
  - `research-project/` - 5 research output templates

**gsd/references/**
- Purpose: Reference documentation and guidance for workflows/agents
- Contains: 13 markdown files (~2900 total lines)
- Key files:
  - `checkpoints.md` - Checkpoint protocol reference (776 lines)
  - `verification-patterns.md` - Verification pattern library (612 lines)
  - `tdd.md` - TDD guidance (263 lines)
  - `git-integration.md` - Git workflow reference (248 lines)
  - `model-profiles.md` - Model profile documentation (92 lines)

**agents/**
- Purpose: Specialized LLM agent definitions spawned as subagents
- Contains: 11 markdown agent files (~7500 total lines)
- Key files:
  - `gsd-planner.md` - Phase planning agent (1295 lines)
  - `gsd-debugger.md` - Debug session agent (1246 lines)
  - `gsd-executor.md` - Plan execution agent (479 lines)
  - `gsd-codebase-mapper.md` - Codebase mapping agent (764 lines)
  - `gsd-verifier.md` - Post-execution verification agent (573 lines)
  - `gsd-roadmapper.md` - Roadmap generation agent (642 lines)

**tests/**
- Purpose: Test suites for the extension layer
- Contains: 16 test files + harness + helpers (~4400 total lines)
- Key files:
  - `run-all.ts` - Unified test runner (187 lines)
  - `harness/mock-api.ts` - MockExtensionAPI (Pi API simulator)
  - `harness/mock-context.ts` - Mock execution context
  - `harness/lifecycle.ts` - Environment isolation helpers
  - `harness/diagnostic.ts` - Structured test output formatters

**docs/**
- Purpose: Comprehensive project documentation
- Contains: 30+ files across 5 subdirectories
- Key files:
  - `architecture/overview.md` - 6-layer architecture explanation
  - `architecture/components.md` - Component dependency graph
  - `architecture/data-flow.md` - State management and data flow
  - `ops/testing.md` - Test strategy and patterns
  - `adr/` - 12 Architecture Decision Records

## Key File Locations

**Entry Points:**
- `extensions/gsd/index.ts` - Pi extension entry point (loaded at startup)
- `gsd/bin/gsd-tools.cjs` - CLI tool entry point (called by workflows/agents)

**Configuration:**
- `package.json` - Extension manifest with `pi.extensions` and `pi.agents`
- `tsconfig.json` - TypeScript compiler options (ES2022, strict)
- `gsd/templates/config.json` - Default `.planning/config.json` template

**Core Logic:**
- `extensions/gsd/path-resolver.ts` - Path resolution pipeline (most critical single component)
- `extensions/gsd/commands.ts` - Command discovery and registration
- `gsd/bin/lib/core.cjs` - Shared utilities, model profiles, config loading
- `gsd/bin/lib/state.cjs` - STATE.md dual-representation management
- `gsd/bin/lib/phase.cjs` - Phase lifecycle and renumbering logic

**Testing:**
- `tests/run-all.ts` - Test orchestrator
- `tests/harness/` - Test infrastructure (mock API, mock context, lifecycle, diagnostics)

**Documentation:**
- `docs/README.md` - Documentation index
- `docs/architecture/overview.md` - Architecture overview
- `docs/adr/index.md` - ADR index

## Naming Conventions

**Files:**
- kebab-case.md for commands, workflows, templates, references: `plan-phase.md`, `execute-plan.md`
- kebab-case.ts for extension source: `path-resolver.ts`, `commands.ts`
- kebab-case.cjs for CLI modules: `gsd-tools.cjs`, `core.cjs`
- kebab-case.test.ts for tests with category prefix: `unit-path-rewrite.test.ts`, `intg-commands.test.ts`
- UPPERCASE.md for important state files: `STATE.md`, `ROADMAP.md`, `PROJECT.md`

**Directories:**
- kebab-case for all directories: `commands/gsd/`, `gsd/bin/lib/`
- Number-prefixed for phases: `01-foundation/`, `02-core/`

**Special Patterns:**
- `gsd-` prefix for agent files: `gsd-planner.md`, `gsd-executor.md`
- `*-PLAN.md`, `*-SUMMARY.md` for phase artifacts: `01-01-PLAN.md`, `01-01-SUMMARY.md`
- Category prefix for test files: `unit-*`, `intg-*`, `parity-*`, `e2e-*`

## Where to Add New Code

**New Slash Command:**
- Definition: `commands/gsd/{command-name}.md` (with YAML frontmatter)
- Workflow: `gsd/workflows/{command-name}.md` (if multi-step)
- Tests: Add parity test entry if tracking upstream sync
- Registration: Automatic (command discovery scans `commands/gsd/*.md`)

**New Agent:**
- Definition: `agents/gsd-{agent-name}.md` (with YAML frontmatter)
- Model profile: Add entry to `MODEL_PROFILES` table in `gsd/bin/lib/core.cjs`
- Reference: Update `docs/modules/agents.md`

**New CLI Command:**
- Library module: `gsd/bin/lib/{module}.cjs` (add function)
- Router entry: Add `case` to switch in `gsd/bin/gsd-tools.cjs`
- Export: Add to `module.exports` in the library module

**New Template:**
- Template file: `gsd/templates/{name}.md`
- If codebase template: `gsd/templates/codebase/{name}.md`
- Usage: Referenced by agents/workflows that generate documents

**New Test:**
- Test file: `tests/{category}-{name}.test.ts`
- Registration: Add to `SUITES` array in `tests/run-all.ts`
- Harness: Import from `tests/harness/` for mocks and utilities

**New Documentation:**
- Architecture: `docs/architecture/{topic}.md`
- ADR: `docs/adr/{NNN}-{title}.md` + update `docs/adr/index.md`
- Module: `docs/modules/{module}.md`
- Operations: `docs/ops/{topic}.md`
- Flow: `docs/flows/{flow}.md`

## Special Directories

**.planning/**
- Purpose: Project state directory managed by GSD workflows
- Generated: Yes (created by `/gsd:new-project`, `/gsd:map-codebase`)
- Committed: Partially (codebase map committed, other state varies per config)

**gsd/bin/lib/**
- Purpose: CLI library modules (11 files) — internal to gsd-tools
- Generated: No (hand-written CommonJS)
- Committed: Yes (source of truth for CLI operations)

---

*Structure analysis: 2026-03-05*
*Update when directory structure changes*
