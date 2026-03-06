# Implementation Plan: User-Defined Acceptance Criteria for GSD

> **Strategy:** Dedicated `/gsd:define-ac` command (Strategy 2 from `possible_ac_for_gsd.md`)  
> **Goal:** Users define testable acceptance criteria before planning. The executor MUST verify these pass before declaring done.  
> **Status:** Ready for implementation  
> **Created:** 2026-03-05  
> **Principle:** AC is mandatory. Every phase goes through AC definition before planning. No skip, no bypass.

---

## What Are Acceptance Criteria? (For the Human at the Keyboard)

Before diving into the implementation, here's what AC means for **you** — the person using GSD.

### The Problem AC Solves

Without acceptance criteria, this happens:
1. You say "build me a task manager"
2. The AI builds *something*
3. You look at it and say "that's not what I meant"

The AI decided what "done" looks like. You didn't. AC flips that.

### What AC Actually Is

**Acceptance criteria are your finish line.** They're concrete, testable statements that say: *"I will consider this phase done when these specific things are true."*

They use a simple format:
- **GIVEN** — the starting condition
- **WHEN** — what happens
- **THEN** — what you expect to see

**Example:**
> GIVEN I'm logged in, WHEN I click "New Task" and type a title, THEN a task appears in my list with status "todo"

That's it. No jargon. Just: "here's what I expect to happen."

### Why AC Is Mandatory in GSD

AC is not optional. Every phase requires it. Here's why:

1. **You define "done", not the AI.** The AI is good at building. It's bad at reading your mind. AC is how you tell it what success looks like.

2. **It's the contract.** The planner maps your AC to specific tasks. The executor verifies your AC after building. The verifier checks your AC as the source of truth. Without AC, all of those agents are guessing.

3. **It protects you from drift.** Phase by phase, without a clear finish line, the project can drift from what you actually wanted. AC anchors every phase to your intent.

4. **It catches problems early.** When you write AC, you're forced to think about what you actually care about. "Tasks should work" isn't an AC. "Tasks persist after page refresh" is. That specificity catches ambiguity before any code is written.

### What Happens During `/gsd:define-ac`

1. The AI reads your project context and proposes 5-10 acceptance criteria
2. You review each one — edit the wording, change the priority, add your own, remove ones you don't care about
3. You organize them into three tiers:
   - **Must Pass** — The phase fails without these. Non-negotiable.
   - **Should Pass** — Important but won't block delivery. Logged as warnings if they fail.
   - **Nice to Have** — Polish. Checked and logged, never blocks.
4. The approved AC is saved and becomes the contract for everything downstream

**You are always in control.** The AI proposes, you decide. Every criterion is yours.

### The 30-Second Version

> AC = your definition of "done", written before planning starts, enforced during execution, verified at the end. You write it. The AI follows it.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Plan 1: gsd-tools Infrastructure](#plan-1-gsd-tools-infrastructure)
- [Plan 2: AC Template & Command](#plan-2-ac-template--command)
- [Plan 3: define-ac Workflow](#plan-3-define-ac-workflow)
- [Plan 4: Planner AC Integration](#plan-4-planner-ac-integration)
- [Plan 5: Executor AC Enforcement](#plan-5-executor-ac-enforcement)
- [Plan 6: Verifier & UAT AC Integration](#plan-6-verifier--uat-ac-integration)
- [Plan 7: Auto-Advance Chain Update](#plan-7-auto-advance-chain-update)
- [Dependency Graph](#dependency-graph)
- [File Inventory](#file-inventory)
- [Verification Checklist](#verification-checklist)

---

## Architecture Overview

### Data Flow

```
User defines AC ──► AC.md (artifact) ──► Planner reads AC ──► PLAN.md tasks map to AC-IDs
                                    ──► Executor runs verify commands per AC
                                    ──► Verifier uses AC as primary source of truth
                                    ──► UAT derives test list from AC (not SUMMARY.md)
```

### Workflow Position

AC is a **mandatory gate**. Planning cannot proceed without it.

```
/gsd:discuss-phase 1    ← decisions (CONTEXT.md)
         │
         ▼
/gsd:define-ac 1         ← acceptance criteria (AC.md)   ◄── REQUIRED
         │
         ▼ ════════════════════════════════════════════
         ║  AC GATE — plan-phase BLOCKS without AC.md  ║
         ▼ ════════════════════════════════════════════
/gsd:plan-phase 1        ← plans (PLAN.md files) — HARD GATE: requires AC.md
         │
         ▼
/gsd:execute-phase 1     ← execution — AC verify commands enforced per plan
         │
         ▼
/gsd:verify-work 1       ← UAT — tests derived from AC.md, not SUMMARY.md
```

### AC.md File Location

```
.planning/phases/01-foundation/
  ├── 01-CONTEXT.md          ← existing (decisions)
  ├── 01-AC.md               ← NEW (acceptance criteria)
  ├── 01-RESEARCH.md         ← existing (research)
  ├── 01-01-PLAN.md          ← existing (plans)
  └── 01-01-SUMMARY.md       ← existing (execution results)
```

### AC Tiers

| Tier | Executor Behavior | Meaning |
|------|-------------------|---------|
| **Must Pass** | Fix loop (max 3 attempts), blocks SUMMARY.md creation if still failing | Non-negotiable — phase is not done without these |
| **Should Pass** | Logged as warning in SUMMARY.md, execution continues | Important but won't block delivery |
| **Nice to Have** | Checked, result logged, never blocks | Polish and edge cases |

---

## Plan 1: gsd-tools Infrastructure

> **Wave:** 1 (no dependencies)  
> **Files modified:** `gsd/bin/lib/core.cjs`, `gsd/bin/lib/init.cjs`  
> **Purpose:** Add `has_ac` detection and AC file path resolution to gsd-tools so all downstream workflows can check for AC.md existence.

### Task 1.1: Add `has_ac` detection to `findPhaseInternal()` in core.cjs

**File:** `gsd/bin/lib/core.cjs`  
**Location:** Inside the `searchPhaseInDir()` function, after line ~222 where `hasVerification` is set.

**Action:**  
Add AC file detection alongside existing artifact detection:

```javascript
// Existing lines (context):
const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
const hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
const hasVerification = phaseFiles.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');

// ADD this line:
const hasAc = phaseFiles.some(f => f.endsWith('-AC.md') || f === 'AC.md');
```

Then add `has_ac: hasAc` to the return object (after `has_verification`).

**Verify:**
```bash
node gsd/bin/gsd-tools.cjs init phase-op 1 | jq '.has_ac'
# Should return false (no AC.md exists yet)
```

**Done:** `has_ac` field appears in phase info JSON for all phase-op queries.

### Task 1.2: Add `ac_path` resolution to `cmdInitPhaseOp()` in init.cjs

**File:** `gsd/bin/lib/init.cjs`  
**Location:** Inside `cmdInitPhaseOp()`, in the block starting at ~line 420 where `contextFile`, `researchFile`, etc. are resolved.

**Action:**  
Add AC file path resolution:

```javascript
// Existing lines (context):
const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
if (verificationFile) {
  result.verification_path = toPosixPath(path.join(phaseInfo.directory, verificationFile));
}

// ADD this block:
const acFile = files.find(f => f.endsWith('-AC.md') || f === 'AC.md');
if (acFile) {
  result.ac_path = toPosixPath(path.join(phaseInfo.directory, acFile));
}
```

**Also add** `has_ac` to the result object in the main body of `cmdInitPhaseOp()`:

```javascript
// Existing:
has_verification: phaseInfo?.has_verification || false,

// ADD:
has_ac: phaseInfo?.has_ac || false,
```

**Verify:**
```bash
# Create a dummy AC file, then check
touch .planning/phases/01-foundation/01-AC.md
node gsd/bin/gsd-tools.cjs init phase-op 1 | jq '{has_ac, ac_path}'
# Should return { "has_ac": true, "ac_path": ".planning/phases/01-foundation/01-AC.md" }
rm .planning/phases/01-foundation/01-AC.md
```

**Done:** `has_ac` and `ac_path` fields appear in `init phase-op` JSON output.

### Task 1.3: Add `has_ac` and `ac_path` to `cmdInitPlanPhase()` in init.cjs

**File:** `gsd/bin/lib/init.cjs`  
**Location:** Inside `cmdInitPlanPhase()`, same pattern as phase-op.

**Action:**  
Add `has_ac` to the result object:

```javascript
// Existing:
has_context: phaseInfo?.has_context || false,

// ADD:
has_ac: phaseInfo?.has_ac || false,
```

And in the file-resolution block, add:

```javascript
const acFile = files.find(f => f.endsWith('-AC.md') || f === 'AC.md');
if (acFile) {
  result.ac_path = toPosixPath(path.join(phaseInfo.directory, acFile));
}
```

**Verify:**
```bash
node gsd/bin/gsd-tools.cjs init plan-phase 1 | jq '{has_ac, ac_path}'
```

**Done:** Plan-phase workflow can detect AC.md existence and path.

### Task 1.4: Add `has_ac` and `ac_path` to `cmdInitExecutePhase()` in init.cjs

**File:** `gsd/bin/lib/init.cjs`  
**Location:** Inside `cmdInitExecutePhase()`.

**Action:**  
Add `has_ac` to the result object and AC path resolution (same pattern as Tasks 1.2-1.3).

**Verify:**
```bash
node gsd/bin/gsd-tools.cjs init execute-phase 1 | jq '{has_ac, ac_path}'
```

**Done:** Execute-phase workflow can detect and read AC.md.

---

## Plan 2: AC Template & Command

> **Wave:** 1 (no dependencies — parallel with Plan 1)  
> **Files created:** `gsd/templates/ac.md`, `commands/gsd/define-ac.md`  
> **Purpose:** Create the AC.md template and the `/gsd:define-ac` command entry point.

### Task 2.1: Create AC.md template

**File:** `gsd/templates/ac.md` (NEW)

**Action:**  
Create the template file with schema documentation, examples by domain, and guidelines:

```markdown
# Acceptance Criteria Template

Template for `.planning/phases/XX-name/{phase_num}-AC.md` — user-approved acceptance criteria for a phase.

**Purpose:** Define concrete, testable assertions that MUST pass before the AI considers the phase done. Written by the user (with AI assistance), consumed by planner, executor, and verifier.

**Key principle:** The user defines the finish line, not the AI. These criteria are the contract between what the user expects and what the executor delivers.

**Downstream consumers:**
- `gsd-planner` — Maps each AC-ID to specific tasks. Every "Must Pass" AC must appear in at least one task's `<done>` criteria.
- `gsd-executor` — Runs verify commands after each plan. Must Pass failures trigger fix loop (max 3 attempts). Should Pass failures logged as warnings.
- `gsd-verifier` — Uses AC as primary verification source instead of AI-derived must_haves.
- `verify-work (UAT)` — Derives test list from AC.md instead of SUMMARY.md.

---

## File Template

~~~markdown
---
phase: XX-name
status: draft | approved | executed
approved_at: [ISO timestamp]
test_stubs: [path to generated test file, or null]
total: [N]
must_pass: [N]
should_pass: [N]
nice_to_have: [N]
---

# Phase [X]: [Name] — Acceptance Criteria

**Approved:** [date]
**Source:** User-defined via /gsd:define-ac

## Must Pass

> These BLOCK execution if they fail. The executor enters a fix loop (max 3 attempts).

### AC-01: [Descriptive name]
- **GIVEN:** [precondition]
- **WHEN:** [action]
- **THEN:** [observable result]
- **Verify:** `[bash command]` OR `manual — [instructions]`
- **Requirement:** [REQ-ID from REQUIREMENTS.md]

### AC-02: [Descriptive name]
- **GIVEN:** [precondition]
- **WHEN:** [action]
- **THEN:** [observable result]
- **Verify:** `[bash command]` OR `manual — [instructions]`
- **Requirement:** [REQ-ID]

## Should Pass

> Logged as warnings if they fail. Execution continues.

### AC-03: [Descriptive name]
- **GIVEN:** [precondition]
- **WHEN:** [action]
- **THEN:** [observable result]
- **Verify:** `[bash command]` OR `manual — [instructions]`
- **Requirement:** [REQ-ID]

## Nice to Have

> Checked and logged. Never blocks execution.

### AC-04: [Descriptive name]
- **GIVEN:** [precondition]
- **WHEN:** [action]
- **THEN:** [observable result]
- **Verify:** `[bash command]` OR `manual — [instructions]`
- **Requirement:** [REQ-ID]
~~~

---

## Guidelines

**Good acceptance criteria (testable):**
- "GIVEN a user is logged in, WHEN they click New Task and enter a title, THEN a task appears in the list with status todo"
- "GIVEN 3 tasks exist, WHEN user drags task B above task A, THEN the order persists after page refresh"
- "GIVEN the API is running, WHEN POST /api/tasks with {title: 'test'}, THEN response is 201 with task object containing an id"

**Bad acceptance criteria (vague):**
- "Tasks should work correctly"
- "The UI should be responsive"
- "Good error handling"

**Verify commands should be:**
- Concrete bash commands when possible: `npm test -- --grep "AC-01"`, `curl -s localhost:3000/api/tasks | jq length`
- `manual — [specific steps]` when automation isn't practical (visual checks, drag-and-drop)
- Never vague: "check that it works" is not a verify command

**Tier assignment:**
- **Must Pass:** Core functionality. If this doesn't work, the phase failed. Maps to explicit requirements.
- **Should Pass:** Expected behavior. Important but the phase isn't useless without it. Error handling, edge cases.
- **Nice to Have:** Polish. Keyboard shortcuts, animations, visual refinements.

---

## Examples by Domain

<example domain="web-app">
### Must Pass
- AC-01: Create task via UI → appears in list with "todo" status
  Verify: manual — open app, create task, verify it appears
- AC-02: Tasks persist across page refresh
  Verify: `curl -s localhost:3000/api/tasks | jq 'length > 0'`
- AC-03: Task status changes from todo → in-progress → done
  Verify: manual — change status, verify column change

### Should Pass
- AC-04: Empty task title shows validation error
  Verify: manual — submit empty form, verify error message
- AC-05: Task count badge updates in real time
  Verify: manual — add task, verify count increments without refresh

### Nice to Have
- AC-06: Cmd+N keyboard shortcut opens new task form
  Verify: manual — press Cmd+N, verify form opens
</example>

<example domain="cli-tool">
### Must Pass
- AC-01: `backup --db postgres://localhost/mydb` creates backup file
  Verify: `./backup --db postgres://localhost/testdb && ls *.sql | wc -l`
- AC-02: Backup file contains all tables
  Verify: `grep -c "CREATE TABLE" backup.sql` matches expected count

### Should Pass
- AC-03: --json flag outputs structured JSON instead of table
  Verify: `./backup --list --json | jq .`
- AC-04: Network failure retries 3 times before failing
  Verify: mock network failure, check retry log

### Nice to Have
- AC-05: Progress bar shows during large backups
  Verify: manual — run large backup, observe progress bar
</example>

<example domain="api">
### Must Pass
- AC-01: POST /api/tasks returns 201 with task object
  Verify: `curl -s -X POST localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{"title":"test"}' -o /dev/null -w '%{http_code}'`
- AC-02: GET /api/tasks returns array of all tasks
  Verify: `curl -s localhost:3000/api/tasks | jq 'type == "array"'`

### Should Pass
- AC-03: POST with missing title returns 400 with error message
  Verify: `curl -s -X POST localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{}' -w '%{http_code}' | grep 400`

### Nice to Have
- AC-04: API response includes request duration header
  Verify: `curl -sI localhost:3000/api/tasks | grep X-Response-Time`
</example>
```

**Verify:** File exists and is well-formed markdown.

**Done:** Template provides schema, examples, and guidelines for AC.md creation.

### Task 2.2: Create `/gsd:define-ac` command file

**File:** `commands/gsd/define-ac.md` (NEW)

**Action:**  
Create the command entry point (same pattern as other commands in `commands/gsd/`):

```markdown
---
name: gsd:define-ac
description: Define user-approved acceptance criteria for a phase before planning
argument-hint: "<phase>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<context>
Phase number: $ARGUMENTS (required)
</context>

<objective>
Define concrete, testable acceptance criteria that must pass before the AI considers a phase done.

**Creates:**
- `.planning/phases/XX-name/{phase_num}-AC.md` — user-approved acceptance criteria with three tiers (Must Pass / Should Pass / Nice to Have)
- Optionally: test stub files (e.g., `tests/ac/phase-XX.test.ts`)

**After this command:** Run `/gsd:plan-phase <phase>` — the planner maps AC to tasks.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/define-ac.md
@~/.claude/get-shit-done/templates/ac.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<process>
Execute the define-ac workflow from @~/.claude/get-shit-done/workflows/define-ac.md end-to-end.
Preserve all workflow gates (validation, approvals, commits).
</process>
```

**Verify:** Command auto-discovered by `registerGsdCommands()` on next Pi reload.

**Done:** `/gsd:define-ac` is a registered Pi command that transforms and sends the workflow to the LLM.

---

## Plan 3: define-ac Workflow

> **Wave:** 2 (depends on Plan 1 + Plan 2)  
> **Files created:** `gsd/workflows/define-ac.md`  
> **Purpose:** The full workflow the LLM follows when the user runs `/gsd:define-ac <phase>`.

### Task 3.1: Create the define-ac workflow

**File:** `gsd/workflows/define-ac.md` (NEW)

**Action:**  
Create the workflow file. This is the largest new file. It follows the established GSD workflow pattern (steps with named sections, init via gsd-tools, AskUserQuestion for user choices, git commit at the end).

**Workflow steps:**

```
<purpose>
Define user-approved acceptance criteria for a phase. Produces AC.md with three severity
tiers. Consumed by planner (maps AC to tasks), executor (enforces AC), and verifier/UAT
(uses AC as test source).
</purpose>

<process>

<step name="initialize">
Load phase context:

  INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")

Parse JSON for: phase_found, phase_dir, phase_number, phase_name, phase_slug,
padded_phase, has_context, has_ac, has_plans, commit_docs, ac_path, context_path,
roadmap_exists, requirements_path, state_path.

If phase_found is false → Error: "Phase X not found. Use /gsd:progress."
If has_context is false → Warn: "No CONTEXT.md found. Run /gsd:discuss-phase first for
  better AC — your acceptance criteria will be more precise with implementation decisions
  already captured. Continue anyway?" (Yes/No)
  Note: This is a warning, not a block. AC can be defined without CONTEXT.md, but the
  criteria may be less specific. The AC gate on plan-phase is the hard gate.
</step>

<step name="check_existing_ac">
If has_ac is true:
  "Phase X already has acceptance criteria."
  Options:
    - "Update" — Load existing AC.md, present for revision
    - "View" — Display AC.md, then offer update/skip
    - "Replace" — Start fresh, overwrite existing
    - "Skip" — Use existing AC as-is
</step>

<step name="load_context">
Read project and phase context to generate informed AC proposals:

1. Read ROADMAP.md → extract phase goal and success criteria
2. Read REQUIREMENTS.md → extract REQ-IDs mapped to this phase
3. Read CONTEXT.md (if exists) → extract user decisions
4. Read STATE.md → any prior decisions or context
5. Read prior AC.md files from earlier phases → understand established patterns

Build internal understanding of:
- What the phase delivers (from ROADMAP goal)
- What requirements it addresses (REQ-IDs)
- What implementation decisions are locked (from CONTEXT.md)
- What patterns the user established in prior AC
</step>

<step name="generate_proposals">
Display banner:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► DEFINING ACCEPTANCE CRITERIA
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Acceptance criteria are YOUR definition of "done" for this phase.
  They're concrete, testable statements — not vague goals.

  You'll review each one and decide:
  • Must Pass — the phase isn't done without this
  • Should Pass — important, but won't block delivery
  • Nice to Have — polish, logged but never blocks

  The AI proposes. You decide. Every criterion is yours.

Generate 5-10 acceptance criteria from loaded context:
- Derive Must Pass from explicit requirements (REQ-IDs) and ROADMAP success criteria
- Derive Should Pass from CONTEXT.md decisions and edge cases
- Derive Nice to Have from polish items and optional behaviors
- For each AC: include a proposed verify command (bash or manual)
- Map each AC to a requirement ID where possible

Present ALL proposed AC in a single view, grouped by tier.
</step>

<step name="review_must_pass">
Present Must Pass tier:

  "These BLOCK execution if they fail. Review carefully:"

  [List each Must Pass AC with GIVEN/WHEN/THEN and verify command]

  Options:
    1. "Approve these" — Keep all Must Pass tests as-is
    2. "Edit some" — Modify wording, verify commands, or GIVEN/WHEN/THEN
    3. "Move to Should Pass" — Demote specific tests (important but non-blocking)
    4. "Add more" — User provides additional Must Pass criteria
    5. "Remove some" — Drop specific tests

If "Edit some": For each AC the user wants to change, ask what to change.
  The user can reference by number: "#2 change THEN to ..."
If "Add more": Ask user for new AC in natural language. LLM structures as GIVEN/WHEN/THEN
  and proposes a verify command. User confirms.
If "Remove some": Ask which AC-IDs to remove. Confirm removal.
If "Move to Should Pass": Ask which AC-IDs. Move them.

Loop until user selects "Approve these."
</step>

<step name="review_should_pass">
Same pattern as review_must_pass but for Should Pass tier.

Additional option: "Promote to Must Pass" — escalate specific tests.

Loop until user approves.
</step>

<step name="review_nice_to_have">
Same pattern but for Nice to Have tier.

Additional options: "Promote to Should Pass" or "Promote to Must Pass."

Loop until user approves.
</step>

<step name="offer_test_stubs">
Detect test framework:

  ls package.json pytest.ini setup.cfg Cargo.toml jest.config.* vitest.config.* 2>/dev/null

If test framework detected:

  "Generate test stub files for these acceptance criteria?"
  Options:
    1. "Yes" — Create test files with TODO bodies in tests/ac/phase-XX.test.[ext]
    2. "No" — AC stays as documentation only

If "Yes":
  - Detect language/framework from project files
  - Generate stub file with one test.todo() / @pytest.mark.skip per AC
  - Write to tests/ac/phase-{padded_phase}.test.{ext}
  - Record path in AC.md frontmatter as test_stubs

If no test framework detected, skip this step silently.
</step>

<step name="write_ac">
Create phase directory if needed:

  mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"

Write AC.md using template structure:

  File: ${phase_dir}/${padded_phase}-AC.md

Include:
  - Frontmatter: phase, status (approved), approved_at, test_stubs, counts
  - Must Pass section with all approved AC
  - Should Pass section
  - Nice to Have section
  - Each AC has: ID, name, GIVEN/WHEN/THEN, verify command, requirement mapping

Set status to "approved" (user explicitly approved each tier).
</step>

<step name="git_commit">
Commit AC.md (and test stubs if generated):

  node gsd-tools.cjs commit "docs(${padded_phase}): define acceptance criteria" \
    --files "${phase_dir}/${padded_phase}-AC.md" [test_stub_path]
</step>

<step name="update_state">
Record session in STATE.md:

  node gsd-tools.cjs state record-session \
    --stopped-at "Phase ${PHASE} acceptance criteria defined" \
    --resume-file "${phase_dir}/${padded_phase}-AC.md"

Commit STATE.md.
</step>

<step name="present_summary">
Display summary:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► ACCEPTANCE CRITERIA DEFINED ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Phase {X}: {Name}

  | Tier          | Count |
  |---------------|-------|
  | Must Pass     | {N}   |
  | Should Pass   | {N}   |
  | Nice to Have  | {N}   |
  | Total         | {N}   |

  [If test stubs]: Test stubs: tests/ac/phase-{XX}.test.{ext}

  ## ▶ Next Up

  /gsd:plan-phase {X}

  /clear first → fresh context window
</step>

<step name="auto_advance">
Check --auto flag or workflow.auto_advance config.
If auto: launch plan-phase via Skill tool.
If not: show manual next steps (above).
</step>

</process>
```

**Verify:** Workflow follows established GSD patterns (init → check existing → load context → user interaction → write file → commit → state update → next steps).

**Done:** Complete workflow exists at `gsd/workflows/define-ac.md`.

---

## Plan 4: Planner AC Integration

> **Wave:** 2 (depends on Plan 1)  
> **Files modified:** `agents/gsd-planner.md`, `gsd/workflows/plan-phase.md`  
> **Purpose:** Make the planner read AC.md, map each AC to tasks, and make plan-phase enforce AC.md existence.

### Task 4.1: Add AC hard gate to plan-phase workflow

**File:** `gsd/workflows/plan-phase.md`  
**Location:** After Step 4 ("Load CONTEXT.md"), before Step 5 ("Handle Research"). Insert a new Step 4.5.

**Action:**  
Add a new step that checks for AC.md and **hard-gates** planning:

```markdown
## 4.5. Check Acceptance Criteria (HARD GATE)

Check `has_ac` and `ac_path` from init JSON.

**If `has_ac` is true:**
Display: `✓ Using acceptance criteria from: ${ac_path}`

**If `has_ac` is false:**

Display:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► AC REQUIRED
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Phase {X} has no acceptance criteria.

  Acceptance criteria define YOUR finish line — what "done" means to you,
  not what the AI thinks "done" means. Every phase requires AC before
  planning can begin.

  Run this first:

    /gsd:define-ac {X}

  Then come back to /gsd:plan-phase {X}.

**Exit the workflow.** Do not proceed to planning without AC.

There is no skip option. AC is mandatory.
```

**Also modify** the planner spawn prompt (Step 8) to include AC context:

```markdown
# In the planner prompt's <files_to_read> block, add:
- {ac_path} (USER ACCEPTANCE CRITERIA from /gsd:define-ac)
```

And add to the quality_gate:

```markdown
- [ ] Every Must Pass AC-ID mapped to at least one task's <done> criteria
```

**Verify:** Run `/gsd:plan-phase 1` without AC.md → workflow **blocks** and directs user to `/gsd:define-ac 1`. With AC.md → see "✓ Using acceptance criteria from:" message.

**Done:** Plan-phase gates on AC.md existence and passes AC to planner.

### Task 4.2: Add AC mapping rules to gsd-planner agent

**File:** `agents/gsd-planner.md`  
**Location:** After the `<context_fidelity>` section (around line ~75), add a new `<ac_fidelity>` section.

**Action:**  
Add acceptance criteria mapping rules:

```markdown
<ac_fidelity>
## CRITICAL: Acceptance Criteria Mapping

If `<files_to_read>` includes an AC.md file, you MUST map acceptance criteria to tasks.

**Before creating ANY plan, read AC.md and extract:**

1. **Must Pass ACs** — Each MUST appear in at least one task's `<done>` criteria
   - If AC-01 says "task appears in list with status todo"
     → a task's `<done>` MUST include: "Task appears in list with status todo (AC-01)"
   - The AC-ID (AC-01) MUST be referenced in `<done>` for traceability

2. **Should Pass ACs** — Each SHOULD appear in a task's `<done>` criteria
   - Best effort mapping. If an AC can't be addressed in this plan, note it.

3. **Nice to Have ACs** — Map if naturally fits a task. Don't force it.

4. **Plan frontmatter** — Add `acceptance_criteria` field listing AC-IDs this plan addresses
   (since AC is mandatory, this field should always be populated):
   ```yaml
   acceptance_criteria: [AC-01, AC-02, AC-05]
   ```

5. **Verify commands** — If AC.md specifies a verify command, use it as the task's `<verify>`:
   ```xml
   <verify>curl -s localhost:3000/api/tasks | jq 'length > 0'</verify>
   ```
   If AC verify is "manual", use the task's own verify logic but reference the AC-ID.

**Self-check before returning:** For each plan:
- [ ] Every Must Pass AC-ID appears in at least one task's `<done>` across all plans
- [ ] `acceptance_criteria` frontmatter field lists addressed AC-IDs
- [ ] No Must Pass AC is unaddressed (error if so — request guidance)

**If a Must Pass AC cannot be addressed:**
- STOP and report: "AC-{ID} cannot be addressed in these plans because [reason]"
- Do NOT silently skip Must Pass criteria
</ac_fidelity>
```

**Also modify** the plan template frontmatter (around line ~400) to include the new field:

```yaml
# Add to frontmatter fields table:
| `acceptance_criteria` | No | AC-IDs this plan addresses (from AC.md) |
```

**Verify:** Plans created after this change include `acceptance_criteria` in frontmatter and reference AC-IDs in task `<done>` tags.

**Done:** Planner maps every Must Pass AC to specific tasks with traceability.

### Task 4.3: Add AC coverage check to plan-phase orchestrator (post-planner)

**File:** `gsd/workflows/plan-phase.md`  
**Location:** After Step 9 ("Handle Planner Return"), before Step 10 ("Spawn plan-checker").

**Action:**  
Add a lightweight AC mapping verification step:

```markdown
## 9.5. Verify AC Coverage (if AC.md exists)

If `has_ac` is true:

1. Read AC.md and extract all Must Pass AC-IDs
2. Read each PLAN.md frontmatter `acceptance_criteria` field
3. Compute: covered_ac = union of all plans' acceptance_criteria
4. Compute: uncovered_ac = must_pass_ac - covered_ac

If uncovered_ac is not empty:
  Display:
    "⚠ These Must Pass acceptance criteria are not covered by any plan:"
    [List uncovered AC-IDs with their descriptions]
  
  Options:
    1. "Re-plan" — Send back to planner with specific guidance
    2. "Continue anyway" — Accept uncovered AC (user acknowledges risk)

If all covered: Display "✓ All Must Pass AC mapped to plans"
```

**Verify:** Create plans missing an AC mapping, see the warning.

**Done:** Orchestrator catches AC gaps before execution starts.

---

## Plan 5: Executor AC Enforcement

> **Wave:** 3 (depends on Plan 4)  
> **Files modified:** `agents/gsd-executor.md`, `gsd/workflows/execute-plan.md`  
> **Purpose:** Make the executor verify AC after each plan and enter a fix loop on Must Pass failures.

### Task 5.1: Add AC verification step to executor after SUMMARY creation

**File:** `agents/gsd-executor.md`  
**Location:** After the `<self_check>` section (around line ~385), before `<state_updates>`.

**Action:**  
Add a new `<ac_verification>` section:

```markdown
<ac_verification>
## Acceptance Criteria Verification

After self-check passes, if AC.md exists in the phase directory:

1. **Read AC.md** from the phase directory
2. **Extract this plan's AC-IDs** from the plan frontmatter `acceptance_criteria` field
3. **For each AC assigned to this plan:**

   a. **If verify command is a bash command:**
      Run the command. Check exit code.
      - Exit 0 → PASS
      - Non-zero → FAIL

   b. **If verify is "manual":**
      Log as "manual verification required" — cannot be auto-verified.
      Mark as PENDING (not PASS or FAIL).

4. **Handle results by tier:**

   **Must Pass failures:**
   - Enter fix loop (max 3 attempts per failing AC)
   - Attempt 1: Read the failing AC, identify likely cause, fix code, re-run verify
   - Attempt 2: Broaden investigation, check related files, fix, re-run
   - Attempt 3: Final attempt with deeper analysis
   - If still failing after 3 attempts: Log in SUMMARY.md under "## AC Failures"
     and mark SUMMARY as incomplete. Do NOT mark self-check as PASSED.
   
   **Should Pass failures:**
   - Log as warning in SUMMARY.md under "## AC Warnings"
   - Continue execution (do not enter fix loop)
   
   **Nice to Have failures:**
   - Log in SUMMARY.md under "## AC Notes"
   - Continue execution

5. **Append AC results to SUMMARY.md:**

   ```markdown
   ## Acceptance Criteria Results

   | AC-ID | Tier | Description | Verify | Result |
   |-------|------|-------------|--------|--------|
   | AC-01 | Must | Create task | `curl ...` | ✓ PASS |
   | AC-02 | Must | Persist tasks | `sqlite3 ...` | ✓ PASS |
   | AC-03 | Should | Empty title error | manual | ⏳ PENDING |
   | AC-04 | Nice | Keyboard shortcut | manual | ⏳ PENDING |
   ```

6. **Update AC.md status:**
   After all plans in the phase complete, the execute-phase orchestrator should
   update AC.md frontmatter: `status: executed`
</ac_verification>
```

**Verify:** Execute a plan with AC.md present. SUMMARY.md should contain "## Acceptance Criteria Results" section.

**Done:** Executor verifies AC after each plan with tiered enforcement.

### Task 5.2: Add AC.md to executor's file reads in execute-phase workflow

**File:** `gsd/workflows/execute-phase.md`  
**Location:** In the executor spawn prompt (Step `execute_waves`, item 2), add AC.md to `<files_to_read>`.

**Action:**  
Add to the `<files_to_read>` block in the executor spawn prompt:

```markdown
- {ac_path} (Acceptance Criteria - if exists)
```

Where `ac_path` comes from the init JSON (added in Plan 1, Task 1.4).

**Also:** After all waves complete successfully, if AC.md exists, update its frontmatter status:

```bash
# At the end of execute-phase, after all waves:
if [ -f "${ac_path}" ]; then
  # Update AC.md status to "executed"
  sed -i 's/^status: approved/status: executed/' "${ac_path}"
  node gsd-tools.cjs commit "docs(${padded_phase}): mark AC as executed" --files "${ac_path}"
fi
```

**Verify:** After full phase execution, AC.md frontmatter shows `status: executed`.

**Done:** Executor receives AC.md in its context and AC status is updated post-execution.

---

## Plan 6: Verifier & UAT AC Integration

> **Wave:** 3 (depends on Plan 1, parallel with Plan 5)  
> **Files modified:** `agents/gsd-verifier.md`, `gsd/workflows/verify-phase.md`, `gsd/workflows/verify-work.md`  
> **Purpose:** Make the verifier and UAT use AC.md as their primary source of truth.

### Task 6.1: Add AC as primary verification source in verify-phase workflow

**File:** `gsd/workflows/verify-phase.md`  
**Location:** In `<step name="establish_must_haves">`, add a new Option A.5 that takes priority.

**Action:**  
Insert before the existing Option A (must_haves from PLAN frontmatter):

```markdown
**Option A.0: Use Acceptance Criteria from AC.md (highest priority)**

Check for AC.md in the phase directory:

  ls "$PHASE_DIR"/*-AC.md 2>/dev/null

If AC.md exists:
  1. Read AC.md
  2. Extract all Must Pass criteria as truths
  3. Extract verify commands as the verification method
  4. Derive artifacts from verify commands (files referenced, endpoints tested)
  5. Use AC as the SOLE source of must_haves
  6. Skip Options A, B, C (AC.md overrides all AI-derived criteria)
  7. Display: "Using user-defined acceptance criteria from AC.md ({N} Must Pass, {M} Should Pass)"

If AC.md does not exist (legacy phases only — AC is mandatory for new phases):
  Fall through to existing Option A (PLAN frontmatter must_haves).
  Display warning: "⚠ No AC.md found. This phase may predate mandatory AC. Using AI-derived criteria as fallback."
```

**Verify:** With AC.md present, verifier reports "Using user-defined acceptance criteria."

**Done:** Verifier uses AC.md as the primary and expected source of truth. Since AC is mandatory, AC.md should always exist for any phase that has been through planning. AI-derived criteria serve only as a safety net for edge cases (e.g., legacy phases from before AC was implemented).

### Task 6.2: Add AC-awareness to gsd-verifier agent

**File:** `agents/gsd-verifier.md`  
**Location:** After the `<core_principle>` section.

**Action:**  
Add a section on AC.md consumption:

```markdown
<ac_awareness>
## Acceptance Criteria Priority

If the phase has an AC.md file, it is the **primary source of truth** for verification.
AC.md contains user-approved criteria that override AI-derived must_haves.

**Verification hierarchy:**
1. AC.md Must Pass criteria (user-defined — highest authority, always expected)
2. AC.md Should Pass criteria (user-defined)
3. PLAN.md must_haves (AI-derived — legacy fallback only, for phases predating mandatory AC)
4. ROADMAP.md success criteria (legacy fallback)
5. Phase goal derivation (last resort)

Since AC is mandatory, levels 3-5 should only apply to legacy phases that were created
before AC enforcement was implemented.

**When AC.md exists:**
- Use Must Pass criteria as the truths to verify
- Run each verify command exactly as specified
- For "manual" verifications: note as "requires user verification" (cannot auto-verify)
- Report pass/fail per AC-ID for traceability
- Include AC-ID in VERIFICATION.md for each checked criterion

**AC results in VERIFICATION.md:**
```markdown
## Acceptance Criteria Verification

| AC-ID | Tier | Criterion | Verify Command | Result | Details |
|-------|------|-----------|----------------|--------|---------|
| AC-01 | Must | Create task | `curl ...` | ✓ PASS | 201 returned |
| AC-02 | Must | Persist tasks | `sqlite3 ...` | ✗ FAIL | 0 rows returned |
```
</ac_awareness>
```

**Verify:** Verifier produces AC-specific VERIFICATION.md section.

**Done:** Verifier reports per-AC-ID results.

### Task 6.3: Make UAT derive tests from AC.md instead of SUMMARY.md

**File:** `gsd/workflows/verify-work.md`  
**Location:** In `<step name="extract_tests">`, add AC.md as the primary test source.

**Action:**  
Insert before the existing SUMMARY.md extraction logic:

```markdown
**Primary source: AC.md (if exists)**

Check for AC.md in the phase directory:

  ls "$PHASE_DIR"/*-AC.md 2>/dev/null

If AC.md exists:
  1. Read AC.md
  2. For each AC (all tiers), create a UAT test:
     - name: AC description (e.g., "AC-01: Create task via UI")
     - expected: The THEN clause from the AC
     - tier: Must Pass / Should Pass / Nice to Have
  3. Order: Must Pass first, then Should Pass, then Nice to Have
  4. Skip SUMMARY.md extraction entirely — AC.md is the test list
  5. Display: "Testing against user-defined acceptance criteria ({N} tests)"

If AC.md does not exist (legacy phases only — AC is mandatory for new phases):
  Fall through to existing SUMMARY.md extraction logic.
  Display warning: "⚠ No AC.md found. Using SUMMARY.md as fallback test source."
```

**Verify:** Run `/gsd:verify-work` with AC.md present → see "Testing against user-defined acceptance criteria."

**Done:** UAT tests what the user asked for, not what the AI claims it built.

---

## Plan 7: Auto-Advance Chain Update

> **Wave:** 3 (depends on Plans 2 + 3)  
> **Files modified:** `gsd/workflows/discuss-phase.md`, `gsd/workflows/define-ac.md` (auto-advance step)  
> **Purpose:** Insert `/gsd:define-ac` into the auto-advance chain between discuss-phase and plan-phase.

### Task 7.1: Update discuss-phase auto-advance to route through define-ac

**File:** `gsd/workflows/discuss-phase.md`  
**Location:** In `<step name="auto_advance">`, around line 615.

**Action:**  
Change the auto-advance target from plan-phase to define-ac:

```markdown
# BEFORE (current):
Skill(skill="gsd:plan-phase", args="${PHASE} --auto")

# AFTER (new):
Skill(skill="gsd:define-ac", args="${PHASE} --auto")
```

**Also update** the interactive next-steps (in `confirm_creation` step) to direct the user to define-ac:

```markdown
## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/gsd:define-ac ${PHASE}` — define what "done" means for this phase

<sub>`/clear` first → fresh context window</sub>

Acceptance criteria are required before planning. This is where you
define the finish line — what success looks like to you.
```

Note: There is no "skip AC, plan directly" option. AC is mandatory.

**Verify:** In auto-mode, discuss-phase chains to define-ac instead of plan-phase.

**Done:** Auto-advance chain is: discuss → **define-ac** → plan → execute.

### Task 7.2: Add auto-advance to define-ac workflow

**File:** `gsd/workflows/define-ac.md`  
**Location:** In the `auto_advance` step (created in Plan 3).

**Action:**  
Ensure the define-ac workflow chains to plan-phase in auto mode:

```markdown
<step name="auto_advance">
Check --auto flag or workflow.auto_advance config:

  AUTO_CFG=$(node gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "false")

If --auto OR AUTO_CFG is true:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► AUTO-ADVANCING TO PLAN
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Acceptance criteria defined. Launching plan-phase...

  Skill(skill="gsd:plan-phase", args="${PHASE} --auto")

  Handle plan-phase return (same pattern as discuss-phase auto-advance).

If not auto: Show manual next steps.
</step>
```

**Important for auto-mode:** When `--auto` is set, the define-ac workflow should:
- Still generate AC.md — auto-mode never skips AC creation
- Auto-approve all LLM-generated AC without per-tier review loops
- Skip test stub generation
- Commit and chain immediately

AC is mandatory even in auto-mode. The `--auto` flag accelerates the process by skipping interactive review, but it never bypasses AC itself. This matches the principle that AC is the user's contract — even if the LLM proposes and auto-approves, the AC still exists and gates planning.

**Verify:** Full auto-advance chain: discuss → define-ac → plan → execute runs end-to-end.

**Done:** Complete auto-advance chain includes acceptance criteria.

---

## Dependency Graph

```
Plan 1 (gsd-tools infra)────────────────┐
  Task 1.1: core.cjs has_ac              │
  Task 1.2: init.cjs phase-op           │
  Task 1.3: init.cjs plan-phase         ├──► Plan 3 (workflow) ──► Plan 5 (executor)
  Task 1.4: init.cjs execute-phase      │                     ──► Plan 6 (verifier/UAT)
                                         │                     ──► Plan 7 (auto-advance)
Plan 2 (template + command)──────────────┘
  Task 2.1: templates/ac.md                ──► Plan 3 (workflow reads template)
  Task 2.2: commands/define-ac.md          ──► Plan 3 (command triggers workflow)

Plan 4 (planner integration)
  Task 4.1: plan-phase AC gate           depends on Plan 1
  Task 4.2: planner AC mapping rules     depends on Plan 1
  Task 4.3: AC coverage check            depends on Plan 1
```

### Execution Waves

| Wave | Plans | What It Builds |
|------|-------|----------------|
| **Wave 1** | Plan 1, Plan 2 | Infrastructure (gsd-tools detection) + artifacts (template, command file) |
| **Wave 2** | Plan 3, Plan 4 | Workflow (define-ac.md) + planner integration (AC gate, mapping rules) |
| **Wave 3** | Plan 5, Plan 6, Plan 7 | Executor enforcement + verifier/UAT integration + auto-advance chain |

---

## File Inventory

### New Files (4)

| File | Plan | Purpose |
|------|------|---------|
| `gsd/templates/ac.md` | 2.1 | AC.md template with schema, examples, guidelines |
| `commands/gsd/define-ac.md` | 2.2 | `/gsd:define-ac` command entry point |
| `gsd/workflows/define-ac.md` | 3.1 | Full workflow for AC definition |
| `docs/flows/define-ac.md` | — | Step-by-step documentation like the discuss-phase doc (required — AC is mandatory, users need clear documentation) |

### Modified Files (9)

| File | Plan | Change Summary |
|------|------|----------------|
| `gsd/bin/lib/core.cjs` | 1.1 | Add `has_ac` detection in `searchPhaseInDir()` |
| `gsd/bin/lib/init.cjs` | 1.2-1.4 | Add `has_ac` + `ac_path` to `cmdInitPhaseOp`, `cmdInitPlanPhase`, `cmdInitExecutePhase` |
| `gsd/workflows/plan-phase.md` | 4.1, 4.3 | AC hard gate (Step 4.5) + AC coverage check (Step 9.5) + AC in planner prompt |
| `agents/gsd-planner.md` | 4.2 | `<ac_fidelity>` section — AC mapping rules, frontmatter field |
| `agents/gsd-executor.md` | 5.1 | `<ac_verification>` section — post-plan AC verify with fix loop |
| `gsd/workflows/execute-phase.md` | 5.2 | Add AC.md to executor `<files_to_read>`, update AC status post-execution |
| `agents/gsd-verifier.md` | 6.2 | `<ac_awareness>` section — AC as primary verification source |
| `gsd/workflows/verify-phase.md` | 6.1 | Option A.0 — AC.md overrides AI-derived must_haves |
| `gsd/workflows/verify-work.md` | 6.3 | AC.md as primary UAT test source |
| `gsd/workflows/discuss-phase.md` | 7.1 | Auto-advance target → define-ac; next-steps updated |

---

## Verification Checklist

After all plans are implemented, verify the complete flow:

### Infrastructure
- [ ] `node gsd-tools.cjs init phase-op 1` returns `has_ac` and `ac_path` fields
- [ ] `node gsd-tools.cjs init plan-phase 1` returns `has_ac` and `ac_path` fields
- [ ] `node gsd-tools.cjs init execute-phase 1` returns `has_ac` and `ac_path` fields
- [ ] `has_ac` is `false` when no AC.md exists
- [ ] `has_ac` is `true` and `ac_path` points to correct file when AC.md exists

### Command & Workflow
- [ ] `/gsd:define-ac` appears in Pi command autocomplete after `/reload`
- [ ] `/gsd:define-ac 1` triggers the LLM to read the workflow and template
- [ ] Workflow reads ROADMAP.md, REQUIREMENTS.md, CONTEXT.md to generate proposals
- [ ] User can review/edit each tier (Must Pass, Should Pass, Nice to Have)
- [ ] User can promote/demote AC between tiers
- [ ] User can add custom AC in natural language
- [ ] AC.md is written with correct frontmatter and committed to git

### Planner Integration
- [ ] `/gsd:plan-phase 1` without AC.md **blocks** and directs user to `/gsd:define-ac 1`
- [ ] `/gsd:plan-phase 1` with AC.md passes AC to planner
- [ ] Planner creates plans with `acceptance_criteria` frontmatter field
- [ ] Every Must Pass AC-ID appears in at least one task's `<done>` criteria
- [ ] Post-planner AC coverage check catches unmapped Must Pass ACs

### Executor Enforcement
- [ ] Executor reads AC.md from phase directory
- [ ] After plan completion, executor runs verify commands for assigned ACs
- [ ] Must Pass failure triggers fix loop (up to 3 attempts)
- [ ] Should Pass failure logged as warning, execution continues
- [ ] SUMMARY.md contains "## Acceptance Criteria Results" section
- [ ] AC.md status updated to "executed" after phase completes

### Verifier & UAT
- [ ] Verifier uses AC.md as primary source when it exists
- [ ] Verifier falls back to must_haves/success_criteria only for legacy phases (AC.md should always exist for new phases)
- [ ] VERIFICATION.md contains per-AC-ID results
- [ ] `/gsd:verify-work` derives test list from AC.md when it exists
- [ ] `/gsd:verify-work` falls back to SUMMARY.md extraction only for legacy phases (AC.md should always exist for new phases)

### Auto-Advance
- [ ] discuss-phase → define-ac → plan-phase → execute-phase chain works in auto mode
- [ ] define-ac auto-mode generates AC.md and skips per-tier review loops (AC is still created)
- [ ] Interactive mode discuss-phase shows `/gsd:define-ac` as next step

### AC Enforcement
- [ ] `/gsd:plan-phase` without AC.md **blocks** and directs user to `/gsd:define-ac`
- [ ] There is no `--skip-ac` flag — AC is mandatory for every phase
- [ ] There is no `workflow.skip_ac` config option — AC cannot be disabled
- [ ] Old projects with existing phases that lack AC.md are prompted to define AC before further planning
