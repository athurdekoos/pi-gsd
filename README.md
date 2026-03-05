# pi-gtd

**Spec-driven development for [Pi coding agent](https://github.com/badlogic/pi-mono).** Give your LLM a structured methodology for building software — from research to roadmap to execution to verification — with file-based state, parallel agent execution, and atomic git commits.

```
You: /gsd:new-project Build a real-time multiplayer chess app
 Pi: Researching domain… generating requirements… building roadmap…
     → PROJECT.md, REQUIREMENTS.md, ROADMAP.md created in .planning/

You: /gsd:plan-phase 1
 Pi: Creating execution plans for Phase 1: Foundation…
     → 3 plans created, grouped into 2 waves

You: /gsd:execute-phase 1
 Pi: Executing wave 1 (2 plans in parallel)… wave 2 (1 plan)…
     → 7 commits, 3 summaries, phase complete

You: /gsd:verify-work 1
 Pi: Verifying Phase 1 goals against actual implementation…
     → All success criteria met ✓
```

## What It Does

pi-gtd turns a single command into a multi-step orchestration pipeline. Instead of the LLM freestyling an approach, it follows a structured lifecycle:

1. **Research** — domain exploration, tech stack analysis, pitfall identification
2. **Plan** — break phases into executable plans with verification criteria
3. **Execute** — parallel subagent execution with atomic git commits per task
4. **Verify** — goal-backward verification that the work actually meets requirements

All project state lives in `.planning/` as markdown and JSON files — no database, no ephemeral memory. Context survives across sessions.

## Install

### Prerequisites

- **[Pi coding agent](https://github.com/badlogic/pi-mono)** (latest)
- **Node.js** 20+
- **Git**

### Setup

```bash
git clone git@github.com:athurdekoos/pi-gtd.git
cd pi-gtd
```

Register as a Pi package — add to your Pi `settings.json`:

```json
{
  "packages": ["/path/to/pi-gtd"]
}
```

Verify it works:

```bash
pi
# then type:
/gsd:help
```

### Optional: Brave Search for research workflows

```bash
export BRAVE_API_KEY="your-api-key"
# or
mkdir -p ~/.gsd && echo "your-api-key" > ~/.gsd/brave_api_key
```

## Commands

31 slash commands organized by workflow stage:

### Project Setup
| Command | Description |
|---------|-------------|
| `/gsd:new-project` | Initialize project — research → requirements → roadmap |
| `/gsd:map-codebase` | Map existing codebase for brownfield projects |
| `/gsd:settings` | Configure workflow toggles and preferences |
| `/gsd:set-profile` | Switch model profile (quality / balanced / budget) |

### Planning & Execution
| Command | Description |
|---------|-------------|
| `/gsd:discuss-phase` | Articulate vision before planning |
| `/gsd:research-phase` | Deep domain research for a phase |
| `/gsd:plan-phase` | Create detailed execution plans |
| `/gsd:execute-phase` | Execute all plans in a phase (parallel waves) |
| `/gsd:verify-work` | Verify phase goals against implementation |
| `/gsd:quick` | Execute small ad-hoc tasks outside the phase system |

### Roadmap Management
| Command | Description |
|---------|-------------|
| `/gsd:add-phase` | Add phase to end of roadmap |
| `/gsd:insert-phase` | Insert phase between existing phases |
| `/gsd:remove-phase` | Remove phase and renumber |
| `/gsd:progress` | Show status, route to next action |

### Milestones
| Command | Description |
|---------|-------------|
| `/gsd:new-milestone` | Start a new milestone |
| `/gsd:complete-milestone` | Archive completed milestone |
| `/gsd:audit-milestone` | Audit milestone completion |
| `/gsd:plan-milestone-gaps` | Create phases for audit gaps |

### Session Management
| Command | Description |
|---------|-------------|
| `/gsd:resume-work` | Resume from a previous session |
| `/gsd:pause-work` | Create context handoff for later |
| `/gsd:debug` | Systematic debugging with persistent state |

### Maintenance
| Command | Description |
|---------|-------------|
| `/gsd:health` | Check `.planning/` integrity |
| `/gsd:cleanup` | Archive old phase directories |
| `/gsd:add-tests` | Add tests for existing code |
| `/gsd:add-todo` | Capture ideas as todos |
| `/gsd:check-todos` | List and work on pending todos |
| `/gsd:help` | Show command reference |

## Architecture

pi-gtd has 6 layers:

```
┌──────────────────────────────────────────────────────┐
│  Extension Layer          TypeScript                  │
│  Registers commands, hooks Pi events, resolves paths  │
├──────────────────────────────────────────────────────┤
│  Command Definitions      Markdown + YAML frontmatter │
│  31 /gsd:* slash commands                             │
├──────────────────────────────────────────────────────┤
│  Workflow Engine           Markdown                    │
│  33 multi-step orchestration scripts                  │
├──────────────────────────────────────────────────────┤
│  Agent Definitions         Markdown                   │
│  11 specialized LLM roles                             │
├──────────────────────────────────────────────────────┤
│  CLI Tooling               Node.js (CommonJS)         │
│  80+ deterministic commands (gsd-tools.cjs)           │
├──────────────────────────────────────────────────────┤
│  Templates & References    Markdown + JSON            │
│  Document templates and reference docs                │
└──────────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Markdown as code** — workflows and agents are markdown files the LLM follows as instructions. Non-engineers can read and modify system behavior.
- **File-based state** — all project state lives in `.planning/` as files. No database, no in-memory state across sessions. Context recovery is always possible.
- **Deterministic / non-deterministic split** — LLMs handle reasoning (planning, coding, verification). `gsd-tools.cjs` handles everything deterministic (file I/O, git, config).
- **Zero runtime dependencies** — the CLI uses only Node.js built-ins. No `node_modules` at runtime.
- **Atomic commits** — every meaningful unit of work produces a git commit.

### Agents

| Agent | Role |
|-------|------|
| `gsd-planner` | Creates execution plans from roadmap phases |
| `gsd-executor` | Implements plans — writes code, runs tests |
| `gsd-verifier` | Goal-backward verification of completed work |
| `gsd-plan-checker` | Reviews plans for quality before execution |
| `gsd-project-researcher` | Domain research for new projects |
| `gsd-phase-researcher` | Focused research for specific phases |
| `gsd-research-synthesizer` | Synthesizes research into actionable context |
| `gsd-roadmapper` | Generates phased roadmaps from requirements |
| `gsd-codebase-mapper` | Maps existing codebases for brownfield projects |
| `gsd-debugger` | Systematic debugging with hypothesis tracking |
| `gsd-integration-checker` | Verifies cross-phase integration |

### Project State (`.planning/`)

```
.planning/
├── PROJECT.md          # Vision and high-level requirements
├── ROADMAP.md          # Phase structure with goals and success criteria
├── REQUIREMENTS.md     # Scoped requirements with REQ-IDs
├── STATE.md            # Living project memory (position, decisions, blockers)
├── config.json         # Workflow preferences and model profile
├── research/           # Domain research outputs
├── codebase/           # Codebase map (brownfield projects)
└── phases/             # Per-phase execution artifacts
    └── 01-foundation/
        ├── 01-01-PLAN.md
        ├── 01-01-SUMMARY.md
        └── ...
```

## Development

```bash
# Install dev dependencies (tests only)
npm install

# Type-check
npx tsc --noEmit

# Run all tests
npx tsx tests/run-all.ts

# Run a single test
npx tsx tests/compliance.test.ts

# Test a gsd-tools command
node gsd/bin/gsd-tools.cjs generate-slug "Hello World"

# Reload after changes (in a running Pi session)
/reload
```

## Documentation

Full engineering docs in [`docs/`](docs/README.md):

- **[Architecture](docs/architecture/overview.md)** — system purpose, C4 views, layer diagram
- **[Components](docs/architecture/components.md)** — module decomposition, dependency graph
- **[Data Flow](docs/architecture/data-flow.md)** — state schema, persistence, config cascade
- **[Flows](docs/flows/)** — startup, command invocation, plan-and-execute, state management
- **[Modules](docs/modules/)** — extension layer, CLI tooling, commands, workflows, agents, templates
- **[Ops](docs/ops/)** — running locally, testing, debugging, deployment
- **[ADRs](docs/adr/index.md)** — 12 architectural decision records
- **[Security & Reliability](docs/security-reliability.md)** — trust boundaries, failure modes

## License

MIT
