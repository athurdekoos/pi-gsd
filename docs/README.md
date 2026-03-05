# pi-gtd Engineering Documentation

> **Audience:** Mid-level software engineer working on pi-gtd and/or pi-coding-agent.
> **Goal:** Accurate mental model, safe modification, clear integration contracts.

## What This Repo Is

**pi-gtd** (published as `pi-gsd`) is a [Pi coding agent](https://github.com/badlogic/pi-mono) extension that implements the **GSD (Get Shit Done)** spec-driven development system. It converts markdown workflow definitions into executable LLM agent sequences — turning a single `/gsd:new-project` command into a multi-step orchestration pipeline that researches, plans, executes, and verifies software projects.

**In one sentence:** pi-gtd is a prompt orchestration engine that gives an LLM a structured methodology for building software, with file-based state, parallel agent execution, and atomic git commits.

## Doc Map

| Document | What's In It |
|----------|-------------|
| **Architecture** ||
| [overview.md](architecture/overview.md) | System purpose, C4 Context/Container views, glossary |
| [components.md](architecture/components.md) | Module decomposition, dependency graph, hotspots |
| [data-flow.md](architecture/data-flow.md) | State schema, persistence, data pipelines |
| [integration-pi-coding-agent.md](architecture/integration-pi-coding-agent.md) | Pi SDK contracts, event hooks, command protocol |
| **Flows** ||
| [startup.md](flows/startup.md) | Extension load → command registration → event wiring |
| [command-invocation.md](flows/command-invocation.md) | User types `/gsd:X` → LLM follows workflow |
| [new-project.md](flows/new-project.md) | Full project initialization pipeline |
| [plan-and-execute.md](flows/plan-and-execute.md) | Phase planning → wave execution → verification |
| [state-management.md](flows/state-management.md) | STATE.md read/write/sync lifecycle |
| [gsd-tools-cli.md](flows/gsd-tools-cli.md) | CLI router, command dispatch, output protocol |
| **Modules** ||
| [extension-layer.md](modules/extension-layer.md) | `extensions/gsd/` — TypeScript Pi extension |
| [cli-tooling.md](modules/cli-tooling.md) | `gsd/bin/` — deterministic CLI operations |
| [commands.md](modules/commands.md) | `commands/gsd/` — slash command definitions |
| [workflows.md](modules/workflows.md) | `gsd/workflows/` — orchestration logic |
| [agents.md](modules/agents.md) | `agents/` — LLM agent roles |
| [templates-and-refs.md](modules/templates-and-refs.md) | `gsd/templates/` + `gsd/references/` |
| **Ops** ||
| [running-locally.md](ops/running-locally.md) | Prerequisites, setup, env vars |
| [testing.md](ops/testing.md) | Test organization, running, writing tests |
| [debugging.md](ops/debugging.md) | Common failure modes, where to look |
| [deployment.md](ops/deployment.md) | Package distribution as Pi extension |
| **Cross-Cutting** ||
| [security-reliability.md](security-reliability.md) | Secrets, trust boundaries, failure modes |
| **ADRs** ||
| [adr/index.md](adr/index.md) | Architectural Decision Records (inferred) |

## Reading Paths

### 🏃 30 Minutes — "What Is This?"

1. This file (you're here)
2. [Architecture Overview](architecture/overview.md) — C4 views, subsystem map
3. [Integration with Pi](architecture/integration-pi-coding-agent.md) — how pi-gtd plugs into pi
4. [Startup Flow](flows/startup.md) — what happens when pi loads the extension

### 🚶 2 Hours — "I Need to Modify Something"

All of the 30-minute path, plus:

5. [Components](architecture/components.md) — module boundaries and dependency graph
6. [Data Flow](architecture/data-flow.md) — state schema and persistence
7. [Command Invocation Flow](flows/command-invocation.md) — how `/gsd:X` becomes LLM behavior
8. [CLI Tooling Module](modules/cli-tooling.md) — the `gsd-tools.cjs` reference
9. [Testing](ops/testing.md) — how to verify your changes
10. [Security & Reliability](security-reliability.md) — what not to break

### 🔬 Deep Dive — "I Own This Codebase"

Everything above, plus all remaining docs. Read the module references for your area of focus, then the ADRs for design rationale.

## Key Concepts (Quick Glossary)

| Term | Meaning |
|------|---------|
| **GSD** | Get Shit Done — the spec-driven development methodology |
| **Phase** | A unit of work in the roadmap (e.g., "Phase 1: Foundation") |
| **Plan** | An executable PLAN.md file within a phase — the LLM's task list |
| **Wave** | A parallelization group — plans in the same wave execute simultaneously |
| **Orchestrator** | The LLM following a workflow `.md` file — coordinates subagents |
| **Subagent** | A spawned LLM agent (gsd-planner, gsd-executor, etc.) with a focused role |
| **gsd-tools** | The Node.js CLI that handles deterministic operations (file I/O, git, config) |
| **`.planning/`** | The project state directory — all GSD state lives here as files |
| **Path Resolver** | Rewrites legacy `~/.claude/get-shit-done/` paths to the actual install location |

## Repo Structure at a Glance

```
pi-gtd/
├── extensions/gsd/          # Pi extension (TypeScript) — entry point
│   ├── index.ts              # Extension factory, event hooks
│   ├── commands.ts           # Command discovery and registration
│   └── path-resolver.ts      # Path rewriting pipeline
├── commands/gsd/             # 30 slash command definitions (markdown)
├── agents/                   # 11 LLM agent role definitions (markdown)
├── gsd/
│   ├── bin/                  # CLI tooling (CommonJS)
│   │   ├── gsd-tools.cjs    # CLI router (80+ commands)
│   │   └── lib/              # 11 library modules
│   ├── workflows/            # 30+ orchestration workflows (markdown)
│   ├── templates/            # Document templates
│   └── references/           # Reference documentation for agents
├── tests/                    # 16 test suites
│   ├── harness/              # Mock Pi API + test utilities
│   └── *.test.ts             # Unit, integration, parity, compliance, E2E
├── .planning/                # GSD project state (for this repo itself)
│   └── codebase/             # Codebase map artifacts
├── package.json              # pi-gsd extension package
└── tsconfig.json             # TypeScript configuration
```
