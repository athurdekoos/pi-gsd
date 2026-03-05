# `/gsd:new-project` — Step-by-Step Walkthrough

> What actually happens between the **User**, the **AI (LLM)**, and the **Pi Coding Agent** when you type `/gsd:new-project` and press Enter.

---

## Table of Contents

- [Overview](#overview)
- [The Three Players](#the-three-players)
- [Phase 0: Extension Startup (happens once at Pi launch)](#phase-0-extension-startup)
- [Phase 1: Command Invocation](#phase-1-command-invocation)
- [Phase 2: LLM Receives the Prompt](#phase-2-llm-receives-the-prompt)
- [Phase 3: LLM Reads Referenced Files](#phase-3-llm-reads-referenced-files)
- [Phase 4: Setup — gsd-tools init](#phase-4-setup--gsd-tools-init)
- [Phase 5: Deep Questioning](#phase-5-deep-questioning)
- [Phase 6: Write PROJECT.md](#phase-6-write-projectmd)
- [Phase 7: Workflow Preferences](#phase-7-workflow-preferences)
- [Phase 8: Research (Optional)](#phase-8-research-optional)
- [Phase 9: Define Requirements](#phase-9-define-requirements)
- [Phase 10: Create Roadmap](#phase-10-create-roadmap)
- [Phase 11: Done](#phase-11-done)
- [Summary: Who Does What](#summary-who-does-what)

---

## Overview

`/gsd:new-project` is GSD's longest command. It takes a user from "I have an idea" to a fully planned project with research, requirements, and a phased roadmap. The whole flow involves:

1. **Pi** transforming a command template into a prompt
2. **The LLM** following workflow instructions, calling tools, asking questions
3. **gsd-tools.cjs** (a Node.js CLI) doing project state management
4. **Subagents** (separate LLM sessions) doing research and roadmap creation

```
User types → Pi transforms → LLM follows workflow → Tools execute → Subagents spawn
     ↑                                                                        |
     └────────── User answers questions, approves artifacts ←──────────────────┘
```

---

## The Three Players

| Player | What It Is | Role in This Flow |
|--------|-----------|-------------------|
| **User** | The human at the keyboard | Types `/gsd:new-project`, answers questions, approves artifacts |
| **Pi Coding Agent** | The TUI runtime (terminal app) | Handles commands, routes messages, provides tools (Read, Write, Bash, Edit), manages the session, runs extensions |
| **AI (LLM)** | Claude (the language model) | Receives the transformed prompt, follows the workflow instructions, calls tools, asks the user questions, generates project documents |

Additional players that appear later:
| Player | Role |
|--------|------|
| **gsd-tools.cjs** | Node.js CLI utility — handles config loading, git commits, model resolution, project state. Called by the LLM via the Bash tool. |
| **Subagents** | Independent LLM sessions spawned by the orchestrator LLM. Each gets its own system prompt (from an agent `.md` file) and runs a focused task (research, roadmap creation). Called via the `subagent` tool. |

---

## Phase 0: Extension Startup

> **When:** Once, when Pi starts up  
> **Players:** Pi ↔ Extension code (TypeScript)

Before you ever type `/gsd:new-project`, the GSD extension has already loaded. Here's what happened at Pi startup:

### Step 0.1 — Pi Discovers the Extension

Pi finds the GSD extension via the project's `package.json`:
```json
{ "pi": { "extensions": ["extensions/gsd"], "agents": ["agents"] } }
```
Pi loads `extensions/gsd/index.ts` using [jiti](https://github.com/unjs/jiti) (TypeScript runs without compilation).

### Step 0.2 — Path Resolver Initializes

`GsdPathResolver` constructor runs:
- Calculates `packageRoot` (project root, e.g., `/home/mia/dev/pi-gsd`)
- Sets `gsdHome` = `{packageRoot}/gsd`
- Sets `process.env.GSD_HOME` = gsdHome

### Step 0.3 — Graceful Degradation Checks

Extension checks that `gsd/` directory and `gsd/bin/gsd-tools.cjs` exist. If either is missing, it logs to stderr and returns — no commands are registered. Pi continues without GSD.

### Step 0.4 — Command Registration

`registerGsdCommands()` reads every `.md` file in `commands/gsd/`:
- Parses YAML frontmatter (name, description, argument-hint)
- Registers each file as a Pi command via `pi.registerCommand("gsd:slug", { handler })`
- For `new-project.md` → registers `/gsd:new-project`

**At this point, 33+ commands** like `/gsd:new-project`, `/gsd:plan-phase`, `/gsd:progress` are available.

### Step 0.5 — Event Handlers Registered

Three event handlers are attached:
1. **`before_agent_start`** — Injects GSD context into the system prompt (only when `.planning/` exists)
2. **`tool_call`** — Prepends `export GSD_HOME=...` to bash commands that reference GSD
3. **`session_start`** — Shows "GSD ●" status indicator (only when `.planning/STATE.md` exists)

---

## Phase 1: Command Invocation

> **When:** User types `/gsd:new-project` and presses Enter  
> **Players:** User → Pi → Extension Handler → LLM

### Step 1.1 — User Types the Command

```
> /gsd:new-project
```

Pi's input handler recognizes this as an extension command (starts with `/gsd:`).

### Step 1.2 — Pi Routes to Command Handler

Pi looks up the registered handler for `gsd:new-project` and calls it:
```typescript
handler("", ctx)  // args="" (no arguments passed)
```

### Step 1.3 — Handler Re-reads the Command File

The handler re-reads `commands/gsd/new-project.md` from disk on every invocation (hot-reload support — you can edit the file, run `/reload`, and it picks up changes).

The raw command file looks like:
```markdown
---
name: gsd:new-project
description: Initialize a new project with deep context gathering...
argument-hint: "[--auto]"
allowed-tools: [Read, Bash, Write, Task, AskUserQuestion]
---
<context>
**Flags:**
- `--auto` — Automatic mode...
</context>

<objective>
Initialize a new project through unified flow: questioning → research → ...
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/new-project.md
@~/.claude/get-shit-done/references/questioning.md
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/templates/project.md
@~/.claude/get-shit-done/templates/requirements.md
</execution_context>

<process>
Execute the new-project workflow from @~/.claude/get-shit-done/workflows/new-project.md end-to-end.
</process>
```

### Step 1.4 — Transform Pipeline (3 Stages)

The handler calls `resolver.transform(body, args)` which applies three transformations in order:

**Stage 1: `rewritePaths()`** — Rewrites GSD-specific path patterns to actual installed paths:
```
@~/.claude/get-shit-done/workflows/new-project.md
  ↓
@/home/mia/dev/pi-gsd/gsd/workflows/new-project.md
```

**Stage 2: `transformExecutionContext()`** — Converts `@path` lines inside `<execution_context>` blocks into explicit Read instructions for the LLM:
```xml
<execution_context>
@/home/mia/dev/pi-gsd/gsd/workflows/new-project.md
@/home/mia/dev/pi-gsd/gsd/references/questioning.md
...
</execution_context>
```
becomes:
```xml
<execution_context>
IMPORTANT: Read each of these files using the Read tool before proceeding:
- /home/mia/dev/pi-gsd/gsd/workflows/new-project.md
- /home/mia/dev/pi-gsd/gsd/references/questioning.md
- /home/mia/dev/pi-gsd/gsd/references/ui-brand.md
- /home/mia/dev/pi-gsd/gsd/templates/project.md
- /home/mia/dev/pi-gsd/gsd/templates/requirements.md
</execution_context>
```

**Stage 3: `injectArguments()`** — Replaces `$ARGUMENTS` with the user's arguments (empty string here, or `"--auto"` if auto mode).

### Step 1.5 — Send to LLM as User Message

The handler calls:
```typescript
pi.sendUserMessage(transformed);
```

Pi delivers the fully-transformed markdown as a **user message** to the LLM. From the LLM's perspective, it looks like the user just sent a detailed, structured prompt.

**Key insight:** The `/gsd:new-project` command itself does NOT execute any workflow logic. It just transforms a template and sends it to the LLM. The LLM does all the actual work.

---

## Phase 2: LLM Receives the Prompt

> **When:** Immediately after Phase 1  
> **Players:** Pi → LLM

### Step 2.1 — System Prompt Context

Before the LLM processes the user message, Pi's `before_agent_start` event fires. If `.planning/` already exists (it won't for a brand-new project), it would inject GSD context into the system prompt with:
- File locations (gsd runtime, tools, workflows)
- Path resolution rules
- Tool name mappings (Task → subagent, AskUserQuestion → ask inline)
- gsd-tools usage patterns

For a brand-new project, `.planning/` doesn't exist yet, so this injection is skipped. The LLM operates with Pi's default system prompt plus whatever's in the transformed command message.

### Step 2.2 — LLM Reads the Instructions

The LLM receives the transformed prompt and sees:
1. An `<objective>` telling it what to create
2. An `<execution_context>` telling it to read 5 files before starting
3. A `<process>` telling it to follow `new-project.md` end-to-end

---

## Phase 3: LLM Reads Referenced Files

> **When:** LLM's first actions  
> **Players:** LLM → Pi (Read tool) → Filesystem

The LLM sees "IMPORTANT: Read each of these files using the Read tool before proceeding" and calls the **Read** tool for each file:

### Files Read (5 tool calls)

| # | File | What It Contains | Size |
|---|------|-----------------|------|
| 1 | `gsd/workflows/new-project.md` | The full 9-step workflow with all decision gates, agent spawn templates, and commit commands | ~34KB |
| 2 | `gsd/references/questioning.md` | Questioning philosophy, techniques, anti-patterns | ~3KB |
| 3 | `gsd/references/ui-brand.md` | Visual patterns — banners, checkpoints, progress indicators | ~4KB |
| 4 | `gsd/templates/project.md` | PROJECT.md template with section guidelines | ~4KB |
| 5 | `gsd/templates/requirements.md` | REQUIREMENTS.md template | ~3KB |

**What happens technically:**
1. LLM generates a tool call: `Read({ path: "/home/mia/dev/pi-gsd/gsd/workflows/new-project.md" })`
2. Pi executes the Read tool — reads the file from disk
3. Pi returns the file contents to the LLM as a tool result
4. LLM incorporates the content into its context

After reading all 5 files, the LLM has ~48KB of workflow instructions, templates, and guidelines in its context window. **It now knows the entire workflow and begins executing it.**

---

## Phase 4: Setup — gsd-tools init

> **When:** LLM begins Step 1 of the workflow  
> **Players:** LLM → Pi (Bash tool) → gsd-tools.cjs → Filesystem

### Step 4.1 — LLM Runs the Init Command

The workflow says to run:
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init new-project)
```

The LLM calls the **Bash** tool with this command. Before execution, Pi's `tool_call` event handler fires and prepends `export GSD_HOME=...` to ensure the path resolves correctly.

### Step 4.2 — gsd-tools.cjs Executes

`gsd-tools.cjs` routes to `init.cjs:cmdInitNewProject()` which:
1. Loads project config (or defaults if none exists)
2. Resolves AI models for researcher, synthesizer, roadmapper agents
3. Detects existing code (scans for `.ts`, `.py`, `.go`, etc. files)
4. Checks for `package.json`, `requirements.txt`, `Cargo.toml` etc.
5. Checks if `.planning/PROJECT.md` already exists
6. Checks if `.planning/codebase/` exists (codebase map)
7. Checks if `.git/` exists
8. Returns JSON to stdout

### Step 4.3 — LLM Parses the JSON Result

Pi returns the bash stdout to the LLM. The JSON contains everything the LLM needs:

```json
{
  "researcher_model": "sonnet",
  "synthesizer_model": "sonnet",
  "roadmapper_model": "sonnet",
  "project_exists": false,
  "has_codebase_map": false,
  "has_existing_code": false,
  "needs_codebase_map": false,
  "has_git": false,
  "project_path": ".planning/PROJECT.md"
}
```

### Step 4.4 — LLM Makes Decisions Based on Init Data

- `project_exists = true` → Error out, suggest `/gsd:progress`
- `has_git = false` → LLM runs `git init` via Bash tool
- `needs_codebase_map = true` → Offer brownfield mapping (Step 2 of workflow)

---

## Phase 5: Deep Questioning

> **When:** After setup completes (interactive mode only)  
> **Players:** LLM ↔ User (back and forth conversation)

### Step 5.1 — LLM Displays Stage Banner

The LLM outputs a formatted banner (following `ui-brand.md` patterns):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► QUESTIONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 5.2 — LLM Asks "What do you want to build?"

The LLM asks an open-ended question inline (not a tool call — just text in its response). **No tool is used here.** The LLM simply writes the question and waits.

### Step 5.3 — User Responds

The user types their answer. Pi sends it to the LLM as the next user message in the conversation.

### Step 5.4 — LLM Follows Up

Based on what the user said, the LLM asks follow-up questions. It uses the `questioning.md` reference for techniques:
- Challenge vagueness ("What do you mean by 'fast'?")
- Make abstract concrete ("Walk me through using this")
- Surface assumptions ("What's already decided?")

The LLM may present options to help the user think. In Claude Code, this would use `AskUserQuestion`. In Pi, the LLM simply asks inline with structured choices and waits for the user to respond.

### Step 5.5 — Decision Gate: Ready?

When the LLM feels it has enough context, it asks:

> "I think I understand what you're after. Ready to create PROJECT.md?"
> 1. Create PROJECT.md — Let's move forward
> 2. Keep exploring — I want to share more

If "Keep exploring" → loop back to more questions.  
If "Create PROJECT.md" → proceed to Phase 6.

**Key insight:** This entire phase is pure LLM ↔ User conversation. No tools are called. The LLM is using its own judgment (guided by `questioning.md`) to have a natural conversation.

---

## Phase 6: Write PROJECT.md

> **When:** After user approves creation  
> **Players:** LLM → Pi (Write tool, Bash tool) → Filesystem → Git

### Step 6.1 — LLM Synthesizes Context

The LLM takes everything gathered during questioning and synthesizes it into a structured document following the `project.md` template. This includes:
- What This Is (2-3 sentences)
- Core Value (one thing that must work)
- Requirements (Active list, Out of Scope)
- Context, Constraints, Key Decisions

### Step 6.2 — LLM Writes the File

LLM calls the **Write** tool:
```
Write({ path: ".planning/PROJECT.md", content: "# [Project Name]\n\n## What This Is\n..." })
```

Pi creates `.planning/` directory if needed and writes the file to disk.

### Step 6.3 — LLM Commits to Git

LLM calls the **Bash** tool:
```bash
node "/home/mia/dev/pi-gsd/gsd/bin/gsd-tools.cjs" commit "docs: initialize project" --files .planning/PROJECT.md
```

`gsd-tools.cjs` runs `git add .planning/PROJECT.md && git commit -m "docs: initialize project"`. This creates an atomic commit — if context is lost, the artifact persists.

---

## Phase 7: Workflow Preferences

> **When:** After PROJECT.md is committed  
> **Players:** LLM ↔ User

### Step 7.1 — Round 1: Core Settings (4 questions)

The LLM presents structured choices about how the project should work:

1. **Mode** — YOLO (auto-approve) vs Interactive (confirm at each step)
2. **Depth** — Quick (3-5 phases) vs Standard (5-8) vs Comprehensive (8-12)
3. **Execution** — Parallel vs Sequential plans
4. **Git Tracking** — Commit planning docs or keep local-only

### Step 7.2 — Round 2: Workflow Agents (4 questions)

1. **Research** — Research before planning each phase?
2. **Plan Check** — Verify plans will achieve goals?
3. **Verifier** — Verify work after each phase?
4. **AI Models** — Balanced / Quality / Budget model selection

### Step 7.3 — LLM Creates config.json

LLM calls **Write** tool to create `.planning/config.json`:
```json
{
  "mode": "yolo",
  "depth": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
```

### Step 7.4 — LLM Commits config.json

Via **Bash** tool → `gsd-tools.cjs commit "chore: add project config" --files .planning/config.json`

---

## Phase 8: Research (Optional)

> **When:** After config, if user chose "Research first"  
> **Players:** LLM (orchestrator) → Pi (subagent tool) → 4 Researcher LLMs → Synthesizer LLM

This is where GSD gets interesting — **the orchestrator LLM spawns independent AI agents**.

### Step 8.1 — LLM Displays Research Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning 4 researchers in parallel...
  → Stack research
  → Features research
  → Architecture research
  → Pitfalls research
```

### Step 8.2 — LLM Spawns 4 Parallel Researcher Subagents

The LLM uses the **subagent** tool to spawn 4 independent LLM sessions. Each subagent:
- Gets the `gsd-project-researcher` agent definition (from `agents/gsd-project-researcher.md`)
- Receives a specific research question and output file path
- Has access to Read, Write, Bash, and web search tools
- Runs independently in its own context window

**What the subagent tool does technically:**
1. Pi creates a new LLM session with the agent's system prompt
2. Pi sends the task prompt as the first user message
3. The subagent LLM runs autonomously — reads files, does web searches, writes output
4. When the subagent completes, Pi returns the result to the orchestrator LLM

The 4 researchers investigate:

| Researcher | Question | Output File |
|-----------|----------|-------------|
| Stack | "What's the standard 2025 stack for [domain]?" | `.planning/research/STACK.md` |
| Features | "What features do [domain] products have?" | `.planning/research/FEATURES.md` |
| Architecture | "How are [domain] systems structured?" | `.planning/research/ARCHITECTURE.md` |
| Pitfalls | "What do [domain] projects commonly get wrong?" | `.planning/research/PITFALLS.md` |

### Step 8.3 — Synthesizer Subagent

After all 4 researchers complete, the orchestrator spawns a `gsd-research-synthesizer` subagent:
- Reads all 4 research files
- Creates `.planning/research/SUMMARY.md` (unified findings, roadmap implications)
- Commits all research files to git

### Step 8.4 — Research Results Shown to User

The orchestrator LLM displays key findings:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stack: React + Next.js + Prisma + PostgreSQL
Table Stakes: Auth, CRUD, search, notifications
Watch Out For: N+1 queries, auth token management
```

---

## Phase 9: Define Requirements

> **When:** After research (or immediately if research skipped)  
> **Players:** LLM ↔ User → Pi (Write tool, Bash tool)

### Step 9.1 — LLM Presents Features by Category

If research exists, the LLM reads `FEATURES.md` and presents features organized by category, distinguishing table stakes vs differentiators:

```
## Authentication
**Table stakes:** Sign up, login, password reset, sessions
**Differentiators:** Magic links, OAuth, 2FA

## Content Management
**Table stakes:** Create posts, edit posts, delete posts
**Differentiators:** Rich editor, drafts, scheduled publishing
```

### Step 9.2 — User Scopes Each Category

For each category, the LLM asks the user to select which features are in v1 (multi-select). The user picks from the list.

### Step 9.3 — LLM Generates REQUIREMENTS.md

The LLM creates a structured requirements document with REQ-IDs:

```markdown
## v1 Requirements

### Authentication
- [ ] **AUTH-01**: User can create account with email/password
- [ ] **AUTH-02**: User can log in and stay logged in across sessions
```

### Step 9.4 — User Reviews and Approves

The LLM shows the full requirements list and asks "Does this capture what you're building?"

### Step 9.5 — LLM Commits

Via **Bash** tool → `gsd-tools.cjs commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md`

---

## Phase 10: Create Roadmap

> **When:** After requirements approved  
> **Players:** LLM (orchestrator) → Pi (subagent tool) → Roadmapper LLM → User

### Step 10.1 — LLM Spawns Roadmapper Subagent

The orchestrator spawns a `gsd-roadmapper` subagent that:
1. Reads `PROJECT.md`, `REQUIREMENTS.md`, `research/SUMMARY.md`, `config.json`
2. Derives phases from requirements (not arbitrary structure)
3. Maps every v1 requirement to exactly one phase (100% coverage)
4. Creates 2-5 observable success criteria per phase
5. Writes `ROADMAP.md`, `STATE.md`, updates `REQUIREMENTS.md` traceability
6. Returns summary to orchestrator

### Step 10.2 — Orchestrator Presents Roadmap

The orchestrator reads the created `ROADMAP.md` and presents it to the user:

```
## Proposed Roadmap

**6 phases** | **24 requirements mapped** | All v1 requirements covered ✓

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 1 | Foundation | Project setup and core data models | AUTH-01, DB-01 |
| 2 | Authentication | User accounts and sessions | AUTH-02, AUTH-03 |
...
```

### Step 10.3 — User Approves or Adjusts

- **Approve** → commit and continue
- **Adjust phases** → orchestrator re-spawns roadmapper with revision instructions
- **Review full file** → shows raw ROADMAP.md

### Step 10.4 — LLM Commits Roadmap

Via **Bash** tool → `gsd-tools.cjs commit "docs: create roadmap (6 phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md`

---

## Phase 11: Done

> **When:** After roadmap committed  
> **Players:** LLM → User

### Step 11.1 — Completion Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**My Awesome App**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Config         | `.planning/config.json`     |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**6 phases** | **24 requirements** | Ready to build ✓
```

### Step 11.2 — Next Steps

The LLM tells the user what to do next:
```
Phase 1: Foundation — set up project skeleton and data models

/gsd:discuss-phase 1 — gather context and clarify approach
```

---

## Summary: Who Does What

### Pi Coding Agent (the runtime)

| Action | How | When |
|--------|-----|------|
| Loads the GSD extension | Auto-discovery via `package.json` | Pi startup |
| Registers `/gsd:*` commands | `pi.registerCommand()` for each `.md` file | Pi startup |
| Transforms command template | `GsdPathResolver.transform()` — 3-stage pipeline | User types `/gsd:new-project` |
| Sends transformed prompt to LLM | `pi.sendUserMessage(transformed)` | After transform |
| Executes Read tool calls | Reads files from disk, returns contents | When LLM calls Read |
| Executes Bash tool calls | Runs shell commands, returns stdout/stderr | When LLM calls Bash |
| Executes Write tool calls | Writes files to disk | When LLM calls Write |
| Spawns subagents | Creates new LLM sessions with agent prompts | When LLM calls subagent tool |
| Injects GSD_HOME into bash | `tool_call` event handler | Before bash commands with GSD refs |
| Shows GSD status indicator | `session_start` event handler | When `.planning/STATE.md` exists |

### AI (LLM) — The Orchestrator

| Action | Tool Used | When |
|--------|-----------|------|
| Reads workflow & reference files | **Read** tool (5 calls) | First thing after receiving prompt |
| Runs `gsd-tools init new-project` | **Bash** tool | Step 1: Setup |
| Initializes git repo | **Bash** tool (`git init`) | If `has_git = false` |
| Asks user questions | None — inline text | Steps 3, 5, 7, 9 |
| Writes PROJECT.md | **Write** tool | Step 4 |
| Commits artifacts | **Bash** tool → `gsd-tools.cjs commit` | After each major artifact |
| Writes config.json | **Write** tool | Step 5 |
| Spawns 4 researcher subagents | **subagent** tool | Step 6 (research) |
| Spawns synthesizer subagent | **subagent** tool | Step 6 (after researchers) |
| Writes REQUIREMENTS.md | **Write** tool | Step 7 |
| Spawns roadmapper subagent | **subagent** tool | Step 8 |
| Presents results to user | None — inline text | Throughout |

### gsd-tools.cjs (CLI Utility)

| Action | Command | What It Does |
|--------|---------|-------------|
| Bootstrap project context | `init new-project` | Resolves models, detects existing code, checks git state, returns JSON |
| Commit planning docs | `commit "msg" --files f1 f2` | `git add` + `git commit` specific files |
| Persist config settings | `config-set key value` | Updates `.planning/config.json` |

### Subagents (Spawned LLM Sessions)

| Agent | System Prompt | Task | Output |
|-------|-------------|------|--------|
| `gsd-project-researcher` ×4 | `agents/gsd-project-researcher.md` | Research stack/features/arch/pitfalls | `.planning/research/*.md` |
| `gsd-research-synthesizer` ×1 | `agents/gsd-research-synthesizer.md` | Synthesize 4 research files | `.planning/research/SUMMARY.md` |
| `gsd-roadmapper` ×1 | `agents/gsd-roadmapper.md` | Create phased roadmap from requirements | `.planning/ROADMAP.md`, `STATE.md` |

### User (The Human)

| Action | When |
|--------|------|
| Types `/gsd:new-project` | Start |
| Answers "What do you want to build?" | Questioning phase |
| Answers follow-up questions | Questioning phase |
| Says "Create PROJECT.md" when ready | Decision gate |
| Selects workflow preferences | Config phase |
| Chooses research yes/no | Research decision |
| Selects v1 features per category | Requirements scoping |
| Approves requirements list | Requirements approval |
| Approves or adjusts roadmap | Roadmap approval |

---

## Artifacts Created

By the end of `/gsd:new-project`, these files exist on disk with atomic git commits:

```
.planning/
├── PROJECT.md          ← Project context (what, why, who, constraints)
├── config.json         ← Workflow settings (mode, depth, agents)
├── REQUIREMENTS.md     ← Scoped v1 requirements with REQ-IDs
├── ROADMAP.md          ← Phased plan with requirement mappings
├── STATE.md            ← Project memory (current phase, decisions, blockers)
└── research/           ← (if research selected)
    ├── STACK.md        ← Technology recommendations
    ├── FEATURES.md     ← Feature categorization
    ├── ARCHITECTURE.md ← System structure
    ├── PITFALLS.md     ← Common mistakes
    └── SUMMARY.md      ← Synthesized findings
```

Each artifact is committed to git immediately after creation, so nothing is lost if the session crashes.
