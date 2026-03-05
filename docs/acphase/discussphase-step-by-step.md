# `/gsd:discuss-phase` — Step-by-Step Walkthrough

> What actually happens between the **User**, the **AI (LLM)**, and the **Pi Coding Agent** when you type `/gsd:discuss-phase 1` and press Enter.

---

## Table of Contents

- [Overview](#overview)
- [The Players](#the-players)
- [Phase 1: Command Invocation](#phase-1-command-invocation)
- [Phase 2: LLM Reads Referenced Files](#phase-2-llm-reads-referenced-files)
- [Phase 3: Initialize — gsd-tools init phase-op](#phase-3-initialize--gsd-tools-init-phase-op)
- [Phase 4: Check for Existing Context](#phase-4-check-for-existing-context)
- [Phase 5: Load Prior Context](#phase-5-load-prior-context)
- [Phase 6: Scout Codebase](#phase-6-scout-codebase)
- [Phase 7: Analyze Phase & Identify Gray Areas](#phase-7-analyze-phase--identify-gray-areas)
- [Phase 8: Present Gray Areas](#phase-8-present-gray-areas)
- [Phase 9: Deep-Dive Discussions](#phase-9-deep-dive-discussions)
- [Phase 10: Write CONTEXT.md](#phase-10-write-contextmd)
- [Phase 11: Commit & Update State](#phase-11-commit--update-state)
- [Phase 12: Auto-Advance or Next Steps](#phase-12-auto-advance-or-next-steps)
- [Summary: Who Does What](#summary-who-does-what)

---

## Overview

`/gsd:discuss-phase` is the bridge between roadmap and planning. Its job is to extract **implementation decisions** from the user — the things a researcher and planner need to know to do their jobs without asking the user again.

The flow is:
1. Load all prior context (project, requirements, earlier phases)
2. Scout the codebase for reusable patterns
3. Identify "gray areas" — decisions that could go multiple ways
4. Let the user pick which areas to discuss
5. Deep-dive each selected area until satisfied
6. Write CONTEXT.md capturing every decision

Unlike `/gsd:new-project` which spawns subagents, discuss-phase is primarily a **conversation between the LLM and the user**, with tool calls for reading project files, scanning the codebase, and writing the output.

```
User types /gsd:discuss-phase 1
  → Pi transforms command template, sends to LLM
    → LLM reads workflow + template files
      → LLM runs gsd-tools init phase-op 1 (Bash)
        → LLM reads PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files
          → LLM scans codebase (Bash/Read/Grep)
            → LLM analyzes phase, identifies gray areas
              → LLM ↔ User: discuss each selected area
                → LLM writes CONTEXT.md (Write)
                  → LLM commits + updates state (Bash)
```

---

## The Players

| Player | What It Is | Role in This Flow |
|--------|-----------|-------------------|
| **User** | The human at the keyboard | Answers questions about HOW they want things implemented, selects gray areas to discuss, provides vision and preferences |
| **Pi Coding Agent** | The TUI runtime | Transforms the command template, routes messages, executes tools (Read, Write, Bash, Grep), manages the session |
| **AI (LLM)** | Claude (the language model) | Follows the workflow, reads context, analyzes the phase, asks smart questions, synthesizes decisions into CONTEXT.md |
| **gsd-tools.cjs** | Node.js CLI utility | Initializes phase context (`init phase-op`), commits files, updates STATE.md, reads config |
| **Context7 MCP** | External documentation lookup | (Optional) Fetches current library documentation when gray areas involve technology choices |

---

## Phase 1: Command Invocation

> **When:** User types `/gsd:discuss-phase 1`  
> **Players:** User → Pi → Extension Handler → LLM

### Step 1.1 — User Types the Command

```
> /gsd:discuss-phase 1
```

Pi recognizes this as a registered extension command (`gsd:discuss-phase`).

### Step 1.2 — Handler Re-reads the Command File

The handler re-reads `commands/gsd/discuss-phase.md` from disk (supports hot-reload).

The raw command file has:
```yaml
---
name: gsd:discuss-phase
description: Gather phase context through adaptive questioning before planning
argument-hint: "<phase> [--auto]"
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion, Task,
                mcp__context7__resolve-library-id, mcp__context7__query-docs]
---
```

Followed by `<objective>`, `<execution_context>`, `<context>`, `<process>`, and `<success_criteria>` blocks.

### Step 1.3 — Transform Pipeline (3 Stages)

The handler calls `resolver.transform(body, "1")`:

**Stage 1: `rewritePaths()`**
```
@~/.claude/get-shit-done/workflows/discuss-phase.md
  → @/home/mia/dev/pi-gsd/gsd/workflows/discuss-phase.md

@~/.claude/get-shit-done/templates/context.md
  → @/home/mia/dev/pi-gsd/gsd/templates/context.md
```

**Stage 2: `transformExecutionContext()`**
```xml
<execution_context>
IMPORTANT: Read each of these files using the Read tool before proceeding:
- /home/mia/dev/pi-gsd/gsd/workflows/discuss-phase.md
- /home/mia/dev/pi-gsd/gsd/templates/context.md
</execution_context>
```

**Stage 3: `injectArguments("1")`**
```
Phase number: $ARGUMENTS  →  Phase number: 1
```

### Step 1.4 — Send to LLM

```typescript
pi.sendUserMessage(transformed);
```

The fully-transformed markdown is sent to the LLM as a user message. The LLM receives detailed workflow instructions with the phase number `1` injected.

---

## Phase 2: LLM Reads Referenced Files

> **When:** LLM's first actions  
> **Players:** LLM → Pi (Read tool) → Filesystem

The LLM sees the execution context telling it to read 2 files, and calls the **Read** tool for each:

| # | File | What It Contains | Purpose |
|---|------|-----------------|---------|
| 1 | `gsd/workflows/discuss-phase.md` | The full multi-step workflow with all discussion logic, scope guardrails, gray area identification rules, and auto-advance handling | ~25KB — the complete "playbook" |
| 2 | `gsd/templates/context.md` | CONTEXT.md template with examples for visual features, CLI tools, and organization tasks | ~7KB — shows what good output looks like |

**What happens technically:**
1. LLM generates: `Read({ path: "/home/mia/dev/pi-gsd/gsd/workflows/discuss-phase.md" })`
2. Pi reads the file from disk, returns contents
3. LLM generates: `Read({ path: "/home/mia/dev/pi-gsd/gsd/templates/context.md" })`
4. Pi reads the file from disk, returns contents

After these 2 reads, the LLM has ~32KB of workflow instructions and examples in context. It now knows:
- How to identify gray areas by domain type
- The scope guardrail rules (no scope creep)
- How to structure the discussion (4 questions per area, then check)
- What good CONTEXT.md output looks like (3 worked examples)
- The auto-advance chain if `--auto` is present

---

## Phase 3: Initialize — gsd-tools init phase-op

> **When:** LLM begins executing the workflow  
> **Players:** LLM → Pi (Bash tool) → gsd-tools.cjs → Filesystem

### Step 3.1 — LLM Runs the Init Command

The workflow's first step instructs the LLM to run:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "1")
```

The LLM calls the **Bash** tool. Pi's `tool_call` event fires and prepends `export GSD_HOME=...` to ensure path resolution.

### Step 3.2 — gsd-tools.cjs Executes `cmdInitPhaseOp()`

This function does significant work:

1. **Loads config** from `.planning/config.json` (mode, depth, commit_docs, brave_search)
2. **Finds the phase** — searches `.planning/phases/` for a directory matching phase number `1`
   - Looks for directories like `01-foundation/`, `1-setup/`, etc.
   - If no directory found, falls back to ROADMAP.md to check if the phase exists there (might not have a directory yet)
3. **Inspects the phase directory** (if it exists) for existing artifacts:
   - Looks for `*-CONTEXT.md` or `CONTEXT.md`
   - Looks for `*-RESEARCH.md`
   - Looks for `*-PLAN.md` files (and counts them)
   - Looks for `*-VERIFICATION.md`
4. **Returns JSON** to stdout

### Step 3.3 — LLM Parses the JSON

Pi returns the bash output to the LLM. The JSON gives the LLM everything it needs to make routing decisions:

```json
{
  "commit_docs": true,
  "brave_search": false,

  "phase_found": true,
  "phase_dir": ".planning/phases/01-foundation",
  "phase_number": "1",
  "phase_name": "foundation",
  "phase_slug": "foundation",
  "padded_phase": "01",

  "has_research": false,
  "has_context": false,
  "has_plans": false,
  "has_verification": false,
  "plan_count": 0,

  "roadmap_exists": true,
  "planning_exists": true,

  "state_path": ".planning/STATE.md",
  "roadmap_path": ".planning/ROADMAP.md",
  "requirements_path": ".planning/REQUIREMENTS.md"
}
```

### Step 3.4 — LLM Makes Routing Decisions

Based on the JSON:

| Field | Value | Decision |
|-------|-------|----------|
| `phase_found = false` | — | Error: "Phase X not found. Use `/gsd:progress`." Exit. |
| `phase_found = true` | ✓ | Continue |
| `has_context = true` | — | Offer update/view/skip (see Phase 4) |
| `has_context = false, has_plans = true` | — | Warn that plans exist without user context |
| `has_context = false, has_plans = false` | ✓ | Normal path — proceed to load prior context |

---

## Phase 4: Check for Existing Context

> **When:** After init, if `has_context` is true  
> **Players:** LLM ↔ User

### If CONTEXT.md Already Exists

The LLM asks the user inline:

> "Phase 1 already has context. What do you want to do?"
> 1. **Update it** — Review and revise existing context
> 2. **View it** — Show me what's there
> 3. **Skip** — Use existing context as-is

- **Update** → LLM reads the existing CONTEXT.md via **Read** tool, then continues to analyze_phase with it loaded
- **View** → LLM reads and displays the file, then offers update/skip again
- **Skip** → Exit the workflow entirely

### If Plans Exist Without Context

If `has_plans = true` but `has_context = false` (plans were created without user discussion), the LLM warns:

> "Phase 1 already has 3 plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
> 1. **Continue and replan after** — Capture context, then run `/gsd:plan-phase 1` to replan
> 2. **View existing plans** — Show plans before deciding
> 3. **Cancel** — Skip discuss-phase

### If Neither (Normal Path)

Proceed directly to Phase 5.

---

## Phase 5: Load Prior Context

> **When:** Normal path — no existing CONTEXT.md  
> **Players:** LLM → Pi (Read tool, Bash tool) → Filesystem

This is a critical step. The LLM loads **all prior context** so it doesn't re-ask questions that were already answered in earlier phases.

### Step 5.1 — Read Project-Level Files

The LLM uses the **Read** tool (or **Bash** with `cat`) to read up to 3 files:

| File | What the LLM Extracts |
|------|----------------------|
| `.planning/PROJECT.md` | Vision, core value, principles, constraints, non-negotiables |
| `.planning/REQUIREMENTS.md` | Acceptance criteria, must-haves, REQ-IDs mapped to this phase |
| `.planning/STATE.md` | Current progress, session notes, any flags |

### Step 5.2 — Find and Read Prior CONTEXT.md Files

The LLM uses the **Bash** tool to find all prior context files:

```bash
find .planning/phases -name "*-CONTEXT.md" 2>/dev/null | sort
```

Pi executes this and returns a list like:
```
.planning/phases/01-foundation/01-CONTEXT.md
.planning/phases/02-auth/02-CONTEXT.md
```

For each CONTEXT.md where the phase number is **less than** the current phase, the LLM reads it via the **Read** tool and extracts:
- **Decisions** — locked preferences (e.g., "card-based layout, not timeline")
- **Specifics** — particular references (e.g., "I want it like Twitter's new posts indicator")
- **Patterns** — user tendencies (e.g., "consistently prefers minimal UI")

### Step 5.3 — LLM Builds Internal Prior Decisions Summary

The LLM internally structures what it found:

```
<prior_decisions>
## Project-Level
- Core value: Simple, fast task management
- Constraint: Must work offline-first

## From Prior Phases
### Phase 1: Foundation
- Chose SQLite for local storage
- Decided on card-based UI pattern

### Phase 2: Authentication
- Email/password only, no OAuth
- Sessions expire after 30 days
</prior_decisions>
```

**This is NOT written to a file** — it's kept in the LLM's context for use in subsequent steps. It prevents re-asking decided questions and lets the LLM annotate gray areas with "You already chose X in Phase 2."

---

## Phase 6: Scout Codebase

> **When:** After loading prior context  
> **Players:** LLM → Pi (Bash tool, Read tool, Grep tool) → Filesystem

The LLM does a lightweight scan of existing code to understand what's already built. This informs gray area identification — "You already have a Card component" changes what needs to be discussed.

### Step 6.1 — Check for Codebase Maps

```bash
ls .planning/codebase/*.md 2>/dev/null
```

**If codebase maps exist** (from `/gsd:map-codebase`): The LLM reads the most relevant ones — typically `CONVENTIONS.md`, `STRUCTURE.md`, `STACK.md` — via the **Read** tool.

**If no codebase maps**: The LLM does targeted scanning.

### Step 6.2 — Targeted Codebase Grep (if no maps)

The LLM extracts key terms from the phase goal (e.g., Phase "Post Feed" → terms "post", "card", "list", "feed") and runs searches:

```bash
# Find files related to phase terms
grep -rl "post\|card\|list" src/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10

# Check existing component structure
ls src/components/ 2>/dev/null
ls src/hooks/ 2>/dev/null
ls src/lib/ src/utils/ 2>/dev/null
```

The LLM then reads the 3-5 most relevant files via the **Read** tool to understand existing patterns.

### Step 6.3 — LLM Builds Internal Code Context

The LLM internally notes:
- **Reusable assets**: existing components, hooks, utilities
- **Established patterns**: how the codebase handles state management, styling, data fetching
- **Integration points**: where new code would connect (routes, nav, providers)
- **Creative options**: approaches the existing architecture enables or constrains

**This is NOT written to a file** — it's context for the discussion phase.

---

## Phase 7: Analyze Phase & Identify Gray Areas

> **When:** After codebase scouting  
> **Players:** LLM → Pi (Bash tool, Read tool) → Filesystem

### Step 7.1 — Read Phase Description from ROADMAP.md

The LLM uses the **Bash** tool or **Read** tool to extract the phase section:

```bash
node "/home/mia/dev/pi-gsd/gsd/bin/gsd-tools.cjs" roadmap get-phase 1
```

Or reads the full ROADMAP.md and finds Phase 1's section. This gives the LLM:
- Phase name and goal
- Requirements mapped to this phase (REQ-IDs)
- Success criteria

### Step 7.2 — LLM Determines Domain Type

The workflow teaches the LLM to categorize what's being built:

| If the phase is... | Gray areas focus on... |
|--------------------|----------------------|
| Something users **SEE** | Layout, density, interactions, states |
| Something users **CALL** | Responses, errors, auth, versioning |
| Something users **RUN** | Output format, flags, modes, error handling |
| Something users **READ** | Structure, tone, depth, flow |
| Something being **ORGANIZED** | Criteria, grouping, naming, exceptions |

### Step 7.3 — LLM Cross-References Prior Decisions

Before generating gray areas, the LLM checks `<prior_decisions>`:
- If "infinite scroll" was decided in Phase 2 → don't ask about loading behavior
- If "card-based UI" was decided in Phase 1 → annotate layout options with this

### Step 7.4 — LLM Generates 3-4 Gray Areas

The LLM generates **phase-specific** gray areas (not generic categories). Examples:

For "Post Feed" phase:
- Layout style (cards vs timeline vs grid)
- Content ordering (chronological vs algorithmic)
- Post metadata (what info per post)
- Empty state behavior

For "Database Backup CLI" phase:
- Output format (JSON vs table vs plain)
- Flag design (short vs long, required vs optional)
- Progress reporting (silent vs progress bar)
- Error recovery (fail fast vs retry)

**No tools are called during analysis** — this is pure LLM reasoning using the context it has loaded.

---

## Phase 8: Present Gray Areas

> **When:** After analysis  
> **Players:** LLM ↔ User

### Step 8.1 — LLM Displays Phase Boundary

The LLM states the scope clearly:

```
Phase 1: Foundation
Domain: Project setup, database schema, and core data models

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)

**Carrying forward from earlier phases:**
- SQLite for local storage (Phase 0 decision)
- Card-based UI pattern (Phase 0 decision)
```

### Step 8.2 — LLM Presents Multi-Select Choice

The LLM asks the user to select which gray areas to discuss. Each option is annotated with code context and prior decisions where relevant:

> "Which areas do you want to discuss for Foundation?"
> 
> ☐ **Data model design** — How should entities relate? What fields matter?  
>   *(No existing schema — greenfield)*
> 
> ☐ **File/folder structure** — Monorepo, flat, or feature-based?  
>   *(You already have src/components/ and src/lib/ — suggests feature-based)*
> 
> ☐ **Configuration approach** — Env vars, config file, or both?  
>   *(No existing config pattern found)*
> 
> ☐ **Development workflow** — Hot reload, testing setup, linting?  
>   *(.eslintrc exists with basic rules)*

The user selects one or more options.

**Key insight:** The LLM does NOT include a "skip" or "you decide" option. The user ran this command because they want to discuss — give them real choices.

---

## Phase 9: Deep-Dive Discussions

> **When:** After user selects gray areas  
> **Players:** LLM ↔ User, optionally LLM → Pi (Context7 MCP tools)

This is the heart of the command — a structured conversation about each selected gray area.

### Step 9.1 — For Each Selected Area: Ask 4 Questions

The LLM follows a **"4 questions, then check"** rhythm for each area.

**Example: User selected "Data model design"**

The LLM announces:
> "Let's talk about **Data model design**."

Then asks 4 questions, one at a time, using structured options:

**Question 1:**
> "How should tasks relate to projects?"
> 1. Tasks belong to exactly one project (simple hierarchy)
> 2. Tasks can belong to multiple projects (many-to-many)
> 3. Tasks are standalone, optionally grouped (flat + tags)
> 4. Other — let me explain

**Question 2** (informed by Q1 answer):
> "What fields should a task have?"
> 1. Minimal — title, status, due date
> 2. Standard — title, description, status, priority, due date, assignee
> 3. Rich — all standard + tags, attachments, subtasks, custom fields
> 4. Other

**Question 3:**
> "How should task status work?"
> 1. Simple — open/closed
> 2. Kanban — todo/in-progress/done
> 3. Custom — user-defined status values
> 4. Other

**Question 4:**
> "How should task ordering work within a project?"
> 1. Manual drag-and-drop ordering
> 2. Automatic by priority, then due date
> 3. User's choice — can switch between sort modes
> 4. Other

### Step 9.2 — LLM Checks: More or Next?

After 4 questions, the LLM asks:
> "More questions about Data model design, or move to next area?"
> 1. More questions
> 2. Next area

- **More questions** → Ask 4 more, then check again
- **Next area** → Move to the next selected gray area

### Step 9.3 — Context7 for Library Choices (Optional)

When a gray area involves technology selection (e.g., "Which ORM should we use?"), the LLM may call **Context7 MCP tools** to fetch current library documentation:

1. `mcp__context7__resolve-library-id({ libraryName: "prisma" })` → gets the library ID
2. `mcp__context7__query-docs({ libraryId: "...", query: "schema definition" })` → gets current docs

This lets the LLM present **informed options** rather than relying on training data:
> "For the ORM, Prisma 6.x now supports edge runtimes natively. Options:"
> 1. Prisma — type-safe, great DX, established in your stack
> 2. Drizzle — SQL-first, lighter weight, good for edge

### Step 9.4 — Scope Creep Handling

If the user suggests something outside the phase boundary, the LLM redirects:

> User: "Should we also add search and filtering?"

> LLM: "Search and filtering sounds like a new capability — that belongs in its own phase. I'll note it for the roadmap backlog.
>
> Back to Data model design: How should tasks relate to each other?"

The LLM tracks deferred ideas internally for inclusion in CONTEXT.md.

### Step 9.5 — After All Selected Areas: Final Check

Once all initially-selected areas are discussed, the LLM summarizes what was captured and asks:

> "We've discussed Data model design, File structure, and Configuration. Which gray areas remain unclear?"
> 1. Explore more gray areas
> 2. I'm ready for context

- **Explore more** → LLM identifies 2-4 new gray areas based on what was learned, presents them, user selects, loop again
- **Ready** → Proceed to write CONTEXT.md

---

## Phase 10: Write CONTEXT.md

> **When:** User says they're ready  
> **Players:** LLM → Pi (Bash tool, Write tool) → Filesystem

### Step 10.1 — Create Phase Directory (if needed)

If `phase_dir` from init was null (phase exists in roadmap but no directory yet), the LLM creates it:

```bash
mkdir -p ".planning/phases/01-foundation"
```

### Step 10.2 — LLM Synthesizes CONTEXT.md

The LLM writes the file using the template from `gsd/templates/context.md`. The content sections match what was actually discussed — no generic categories.

```markdown
# Phase 1: Foundation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Project setup, database schema, and core data models.
Users can create projects and tasks with relationships.

</domain>

<decisions>
## Implementation Decisions

### Data Model Design
- Tasks belong to exactly one project (simple hierarchy)
- Task fields: title, description, status, priority, due date, assignee
- Status: kanban-style (todo, in-progress, done)
- Manual drag-and-drop ordering within a project

### File Structure
- Feature-based folders (src/features/tasks/, src/features/projects/)
- Shared components in src/components/ui/
- Database layer in src/db/

### Configuration
- Environment variables for secrets (DB_URL, API keys)
- config.ts for app defaults (page size, timeout values)
- .env.example checked into git

### Claude's Discretion
- Exact migration file naming convention
- Test file organization
- TypeScript strict mode settings

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Card component (src/components/ui/Card.tsx): shadow/rounded variants
- useLocalStorage hook: could adapt for settings

### Established Patterns
- Tailwind CSS for styling
- React Query for data fetching

### Integration Points
- App router in src/app/layout.tsx
- Database provider needed in layout

</code_context>

<specifics>
## Specific Ideas

- "Tasks should feel like Linear issues — clean, fast to create"
- "I want keyboard shortcuts for creating tasks (Cmd+N)"

</specifics>

<deferred>
## Deferred Ideas

- Search and filtering — future phase
- Task templates — add to backlog

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-05*
```

### Step 10.3 — LLM Writes the File

LLM calls the **Write** tool:

```
Write({
  path: ".planning/phases/01-foundation/01-CONTEXT.md",
  content: "# Phase 1: Foundation - Context\n..."
})
```

Pi writes the file to disk.

---

## Phase 11: Commit & Update State

> **When:** After CONTEXT.md is written  
> **Players:** LLM → Pi (Bash tool) → gsd-tools.cjs → Git + STATE.md

### Step 11.1 — Git Commit CONTEXT.md

The LLM calls the **Bash** tool:

```bash
node "/home/mia/dev/pi-gsd/gsd/bin/gsd-tools.cjs" commit \
  "docs(01): capture phase context" \
  --files ".planning/phases/01-foundation/01-CONTEXT.md"
```

`gsd-tools.cjs` runs `git add` + `git commit` for the specified file. This creates an atomic commit — if the session crashes, the context decisions are preserved.

### Step 11.2 — Update STATE.md

The LLM calls the **Bash** tool:

```bash
node "/home/mia/dev/pi-gsd/gsd/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase 1 context gathered" \
  --resume-file ".planning/phases/01-foundation/01-CONTEXT.md"
```

`gsd-tools.cjs:cmdStateRecordSession()` updates STATE.md:
- Sets `Last session` to current ISO timestamp
- Sets `Stopped At` to "Phase 1 context gathered"
- Sets `Resume File` to the CONTEXT.md path

### Step 11.3 — Commit STATE.md

```bash
node "/home/mia/dev/pi-gsd/gsd/bin/gsd-tools.cjs" commit \
  "docs(state): record phase 1 context session" \
  --files .planning/STATE.md
```

---

## Phase 12: Auto-Advance or Next Steps

> **When:** After commit  
> **Players:** LLM → Pi (Bash tool) → possibly LLM ↔ Plan-Phase workflow

### Path A: Auto-Advance (--auto mode)

If the user ran `/gsd:discuss-phase 1 --auto` or the project config has `workflow.auto_advance = true`:

#### Step 12A.1 — LLM Checks Auto Config

```bash
AUTO_CFG=$(node "/home/mia/dev/pi-gsd/gsd/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
```

#### Step 12A.2 — LLM Displays Auto-Advance Banner

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Launching plan-phase...
```

#### Step 12A.3 — LLM Invokes plan-phase

The LLM launches `/gsd:plan-phase 1 --auto` as the next workflow in the chain. This keeps the discuss → plan → execute pipeline flowing without user intervention.

The auto-advance chain uses a flat invocation model (Skill tool, not nested subagents) to avoid deep agent nesting issues.

#### Step 12A.4 — LLM Handles Return

Depending on what plan-phase returns:
- **PHASE COMPLETE** → Full chain succeeded (discuss → plan → execute). Show completion.
- **PLANNING COMPLETE** → Planning done but execution didn't finish. Show continue command.
- **PLANNING INCONCLUSIVE** → Planning needs input. Stop chain.
- **GAPS FOUND** → Execution found gaps. Stop chain.

### Path B: Interactive Mode (Normal)

If no `--auto` flag:

#### Step 12B.1 — LLM Shows Summary

```
Created: .planning/phases/01-foundation/01-CONTEXT.md

## Decisions Captured

### Data Model Design
- Tasks belong to one project, kanban status, manual ordering

### File Structure
- Feature-based folders, shared components in ui/

## Noted for Later
- Search and filtering — future phase
- Task templates — add to backlog
```

#### Step 12B.2 — LLM Shows Next Steps

```
## ▶ Next Up

**Phase 1: Foundation** — Project setup and core data models

/gsd:plan-phase 1

/clear first → fresh context window

---

Also available:
- /gsd:plan-phase 1 --skip-research — plan without research
- Review/edit CONTEXT.md before continuing
```

---

## Summary: Who Does What

### Pi Coding Agent (the runtime)

| Action | How | When |
|--------|-----|------|
| Routes `/gsd:discuss-phase` to handler | Extension command registration | User types command |
| Transforms command template | `GsdPathResolver.transform()` — 3 stages | Command invocation |
| Sends transformed prompt to LLM | `pi.sendUserMessage()` | After transform |
| Executes Read tool calls | Reads files from disk | LLM reads workflow, context files, codebase |
| Executes Bash tool calls | Runs shell commands | LLM runs gsd-tools, git, grep, find, ls |
| Executes Write tool calls | Writes files to disk | LLM writes CONTEXT.md |
| Executes Grep tool calls | Searches file contents | LLM scouts codebase |
| Prepends GSD_HOME to bash | `tool_call` event handler | Before bash commands with GSD refs |
| Routes Context7 MCP calls | MCP tool proxy | LLM queries library docs |

### AI (LLM) — The Orchestrator

| Action | Tool Used | When |
|--------|-----------|------|
| Reads workflow + template files | **Read** (2 calls) | First thing |
| Runs `gsd-tools init phase-op 1` | **Bash** | Initialize step |
| Reads PROJECT.md, REQUIREMENTS.md, STATE.md | **Read** (up to 3 calls) | Load prior context |
| Finds prior CONTEXT.md files | **Bash** (`find`) | Load prior context |
| Reads prior CONTEXT.md files | **Read** (N calls, one per prior phase) | Load prior context |
| Checks for codebase maps | **Bash** (`ls`) | Scout codebase |
| Reads codebase map files | **Read** (1-3 calls) | Scout codebase |
| Scans for relevant code files | **Bash** (`grep`, `ls`) | Scout codebase |
| Reads relevant source files | **Read** (3-5 calls) | Scout codebase |
| Reads phase from ROADMAP.md | **Bash** (`roadmap get-phase`) or **Read** | Analyze phase |
| Identifies gray areas | None — pure reasoning | Analyze phase |
| Presents gray areas to user | None — inline text | Present gray areas |
| Asks discussion questions | None — inline text | Deep-dive discussions |
| Queries library documentation | **Context7 MCP** tools | Library-choice gray areas |
| Redirects scope creep | None — inline text | During discussions |
| Writes CONTEXT.md | **Write** | After discussions complete |
| Creates phase directory | **Bash** (`mkdir -p`) | If directory doesn't exist |
| Commits CONTEXT.md | **Bash** → `gsd-tools commit` | After writing |
| Updates STATE.md | **Bash** → `gsd-tools state record-session` | After commit |
| Commits STATE.md | **Bash** → `gsd-tools commit` | After state update |
| Checks auto-advance config | **Bash** → `gsd-tools config-get` | Final routing |
| Shows next steps | None — inline text | End of workflow |

### gsd-tools.cjs (CLI Utility)

| Command | What It Does |
|---------|-------------|
| `init phase-op 1` | Loads config, finds phase directory, checks for existing artifacts, returns JSON context |
| `roadmap get-phase 1` | Extracts Phase 1's section from ROADMAP.md |
| `commit "msg" --files f1` | `git add` + `git commit` specific files |
| `state record-session --stopped-at "..." --resume-file "..."` | Updates STATE.md with session timestamp and resume info |
| `config-get workflow.auto_advance` | Reads a config value from `.planning/config.json` |
| `config-set workflow.auto_advance true` | Writes a config value to `.planning/config.json` |

### Context7 MCP (Optional)

| Tool | What It Does | When Used |
|------|-------------|-----------|
| `mcp__context7__resolve-library-id` | Looks up a library's Context7 ID by name | LLM needs current docs for a technology choice |
| `mcp__context7__query-docs` | Queries library documentation by topic | LLM wants to present informed options about a library |

### User (The Human)

| Action | When |
|--------|------|
| Types `/gsd:discuss-phase 1` | Start |
| (If existing context) Chooses update/view/skip | Phase 4 |
| Selects gray areas to discuss (multi-select) | Phase 8 |
| Answers 4+ questions per area | Phase 9 |
| Says "more questions" or "next area" | Phase 9 checkpoints |
| Says "explore more" or "ready for context" | Phase 9 final check |
| Reviews summary and next steps | Phase 12 |

---

## Artifacts Created

| Artifact | File | When |
|----------|------|------|
| Phase context | `.planning/phases/01-foundation/01-CONTEXT.md` | After discussions |
| Updated state | `.planning/STATE.md` (modified) | After context committed |

Both are committed atomically to git so decisions persist even if the session crashes.

---

## Key Differences from `/gsd:new-project`

| Aspect | `new-project` | `discuss-phase` |
|--------|--------------|-----------------|
| **Subagents** | Spawns 6 subagents (researchers, synthesizer, roadmapper) | Spawns **none** — this is a conversation workflow |
| **User interaction** | Light (approve/reject at gates) | Heavy (the whole point is deep discussion) |
| **Prior context** | None (first command) | Loads PROJECT.md + REQUIREMENTS.md + all prior CONTEXT.md files |
| **Codebase awareness** | Only brownfield detection | Active codebase scouting (grep, file reads) |
| **Scope guardrail** | Defines scope | Enforces scope (redirects creep) |
| **Output** | 5+ files across `.planning/` | Single file: `XX-CONTEXT.md` |
| **Tools used** | Read, Write, Bash, subagent | Read, Write, Bash, Grep, optionally Context7 MCP |
| **Downstream** | Feeds into discuss-phase | Feeds into plan-phase (researcher + planner read CONTEXT.md) |
