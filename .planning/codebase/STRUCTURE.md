# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
pi-gtd/
├── agents/                     # LLM agent role definitions (markdown)
│   ├── gsd-codebase-mapper.md  # Codebase analysis agent
│   ├── gsd-debugger.md         # Systematic debugging agent
│   ├── gsd-executor.md         # Plan execution agent
│   ├── gsd-integration-checker.md  # Cross-phase integration checker
│   ├── gsd-phase-researcher.md # Phase-level research agent
│   ├── gsd-plan-checker.md     # Plan quality checker agent
│   ├── gsd-planner.md          # Plan creation agent
│   ├── gsd-project-researcher.md   # Project-level research agent
│   ├── gsd-research-synthesizer.md # Research synthesis agent
│   ├── gsd-roadmapper.md       # Roadmap creation agent
│   └── gsd-verifier.md         # Verification agent
├── commands/
│   └── gsd/                    # Slash command definitions (markdown with frontmatter)
│       ├── plan-phase.md       # /gsd:plan-phase command
│       ├── execute-phase.md    # /gsd:execute-phase command
│       ├── quick.md            # /gsd:quick command
│       ├── help.md             # /gsd:help command
│       └── ... (30 total)      # All /gsd:* commands
├── extensions/
│   └── gsd/                    # Pi extension (TypeScript)
│       ├── index.ts            # Extension entry point (events + command registration)
│       ├── commands.ts         # Command discovery and handler factory
│       └── path-resolver.ts    # Path rewriting and content transformation
├── gsd/
│   ├── bin/
│   │   ├── gsd-tools.cjs      # CLI router (main entry point for all deterministic ops)
│   │   └── lib/
│   │       ├── core.cjs        # Shared utilities, model profiles, git helpers
│   │       ├── config.cjs      # Config CRUD (ensure, set, get)
│   │       ├── state.cjs       # STATE.md operations + frontmatter sync
│   │       ├── phase.cjs       # Phase CRUD, query, lifecycle operations
│   │       ├── roadmap.cjs     # Roadmap parsing and update operations
│   │       ├── milestone.cjs   # Milestone archival and requirements marking
│   │       ├── verify.cjs      # Verification suite, consistency, health validation
│   │       ├── frontmatter.cjs # YAML frontmatter parsing and CRUD
│   │       ├── template.cjs    # Template selection and fill operations
│   │       ├── commands.cjs    # Standalone utility commands (slug, timestamp, todos, commit, progress)
│   │       └── init.cjs        # Compound init commands for workflow bootstrapping
│   ├── references/             # Reference documentation for agents
│   │   ├── checkpoints.md      # Checkpoint protocol details
│   │   ├── git-integration.md  # Git workflow patterns
│   │   ├── model-profiles.md   # Model selection guide
│   │   ├── questioning.md      # User questioning patterns
│   │   ├── ui-brand.md         # UI/branding guidelines
│   │   └── ... (12 total)
│   ├── templates/              # Document templates
│   │   ├── codebase/           # Codebase map templates (7 files)
│   │   ├── research-project/   # Research output templates
│   │   ├── config.json         # Default project config template
│   │   ├── project.md          # PROJECT.md template
│   │   ├── roadmap.md          # ROADMAP.md template
│   │   ├── state.md            # STATE.md template
│   │   ├── summary.md          # SUMMARY.md template (+ minimal, standard, complex variants)
│   │   └── ... (20+ total)
│   └── workflows/              # Workflow orchestration definitions (markdown)
│       ├── new-project.md      # Project initialization workflow
│       ├── plan-phase.md       # Phase planning workflow
│       ├── execute-phase.md    # Phase execution workflow
│       ├── execute-plan.md     # Single plan execution workflow
│       ├── quick.md            # Quick task workflow
│       ├── map-codebase.md     # Codebase mapping workflow
│       ├── progress.md         # Progress checking workflow
│       └── ... (30+ total)
├── tests/
│   ├── harness/                # Test infrastructure
│   │   ├── mock-api.ts         # MockExtensionAPI for testing
│   │   ├── mock-context.ts     # Mock ExtensionContext
│   │   ├── diagnostic.ts       # Test failure formatting
│   │   └── lifecycle.ts        # Environment save/restore, temp dirs
│   ├── helpers/
│   │   └── upstream-resolver.ts # Upstream path resolution for parity tests
│   ├── run-all.ts              # Test runner (discovers + executes all *.test.ts)
│   ├── compliance.test.ts      # Pi SDK contract validation
│   ├── e2e-smoke.test.ts       # End-to-end smoke tests (--e2e flag)
│   ├── parity-agents.test.ts   # Agent file parity with upstream
│   ├── parity-files.test.ts    # File parity with upstream
│   └── ... (15 test files total)
├── package.json                # Package manifest with pi extension config
└── tsconfig.json               # TypeScript configuration
```

## Directory Purposes

**`agents/`:**
- Purpose: Define LLM agent roles as markdown files with YAML frontmatter
- Contains: 11 agent definitions — each specifies role, tools, philosophy, execution steps
- Key files: `gsd-planner.md` (plan creation), `gsd-executor.md` (plan execution), `gsd-codebase-mapper.md` (codebase analysis)

**`commands/gsd/`:**
- Purpose: Define user-facing `/gsd:*` slash commands
- Contains: 30 markdown files, each with frontmatter (name, description) and body (workflow invocation prompt)
- Key files: `plan-phase.md`, `execute-phase.md`, `quick.md`, `help.md`, `new-project.md`

**`extensions/gsd/`:**
- Purpose: Pi extension entry point — bridges pi runtime with GSD system
- Contains: 3 TypeScript files (index, commands, path-resolver)
- Key files: `index.ts` (factory function exported as default)

**`gsd/bin/`:**
- Purpose: Deterministic CLI operations callable from within LLM agent sessions
- Contains: Main router (`gsd-tools.cjs`) + 11 library modules in `lib/`
- Key files: `gsd-tools.cjs` (80+ subcommands), `lib/core.cjs` (shared utilities)

**`gsd/workflows/`:**
- Purpose: Step-by-step orchestration logic the LLM follows when executing commands
- Contains: 30+ workflow files referenced by command definitions
- Key files: `new-project.md`, `plan-phase.md`, `execute-phase.md`, `quick.md`

**`gsd/templates/`:**
- Purpose: Document templates for consistent artifact generation
- Contains: Templates for all `.planning/` artifacts
- Key files: `summary.md`, `project.md`, `roadmap.md`, `state.md`, `config.json`

**`gsd/references/`:**
- Purpose: Reference documentation loaded by agents when needed
- Contains: Detailed guides for specific concerns
- Key files: `checkpoints.md`, `git-integration.md`, `model-profiles.md`

**`tests/`:**
- Purpose: Compliance, parity, integration, and e2e tests
- Contains: 15 test files + harness infrastructure
- Key files: `run-all.ts` (runner), `compliance.test.ts`, `e2e-smoke.test.ts`

## Key File Locations

**Entry Points:**
- `extensions/gsd/index.ts`: Extension factory — `export default function(pi: ExtensionAPI)`
- `gsd/bin/gsd-tools.cjs`: CLI router — `node gsd/bin/gsd-tools.cjs <command> [args]`
- `tests/run-all.ts`: Test runner entry

**Configuration:**
- `package.json`: Package manifest with `"pi"` field declaring extension and agent paths
- `tsconfig.json`: TypeScript config (`ES2022`, `ESNext`, `bundler` resolution)
- `gsd/templates/config.json`: Default `.planning/config.json` template

**Core Logic:**
- `gsd/bin/lib/core.cjs`: Model profiles, config loading, git utilities, phase search
- `gsd/bin/lib/init.cjs`: Compound init commands for all workflow types
- `gsd/bin/lib/state.cjs`: STATE.md read/write with frontmatter sync
- `extensions/gsd/path-resolver.ts`: 3-stage content transformation pipeline

**Testing:**
- `tests/harness/mock-api.ts`: `MockExtensionAPI` class
- `tests/harness/lifecycle.ts`: `saveEnv()`, `restoreEnv()`, `withTempDir()`

## Naming Conventions

**Files:**
- Agent definitions: `gsd-{role}.md` (kebab-case, e.g., `gsd-plan-checker.md`)
- Commands: `{verb-noun}.md` (kebab-case matching the slash command, e.g., `plan-phase.md` → `/gsd:plan-phase`)
- CLI libraries: `{domain}.cjs` (lowercase, e.g., `state.cjs`, `phase.cjs`)
- Tests: `{scope}-{domain}.test.ts` (e.g., `compliance.test.ts`, `intg-commands.test.ts`)
- Templates: `{artifact-type}.md` (e.g., `summary.md`, `roadmap.md`)

**Directories:**
- Agent/command dirs use singular names: `agents/`, `commands/`
- Workflow/template dirs match their domain: `workflows/`, `templates/`, `references/`

## Where to Add New Code

**New GSD Command:**
1. Create `commands/gsd/{command-name}.md` with frontmatter (name, description)
2. Create corresponding `gsd/workflows/{command-name}.md` with orchestration logic
3. Command auto-discovered by `extensions/gsd/commands.ts` on next load/reload

**New Agent:**
1. Create `agents/gsd-{agent-name}.md` with frontmatter (name, description, tools, color)
2. Reference from workflow files via `Task(subagent_type="gsd-{agent-name}")`
3. Add model mapping in `gsd/bin/lib/core.cjs:MODEL_PROFILES`

**New CLI Subcommand:**
1. Add handler function in appropriate `gsd/bin/lib/{domain}.cjs`
2. Add case in `gsd/bin/gsd-tools.cjs:main()` switch statement
3. Export from module

**New Test:**
1. Create `tests/{scope}-{domain}.test.ts`
2. Follow existing pattern: `testSync()`/`testAsync()` with `node:assert`
3. Auto-discovered by `tests/run-all.ts` glob pattern

**New Template:**
1. Create `gsd/templates/{artifact-type}.md`
2. Reference from agent definitions or workflow files

## Special Directories

**`.planning/` (generated per-project):**
- Purpose: Contains all project state and artifacts for a GSD-managed project
- Generated: Yes — created by `/gsd:new-project` workflow
- Committed: Configurable via `.planning/config.json` `commit_docs` setting

**`node_modules/` (not committed):**
- Purpose: Contains `tsx` and `typescript` devDependencies
- Generated: Yes — via `npm install`
- Committed: No

---

*Structure analysis: 2026-03-05*
