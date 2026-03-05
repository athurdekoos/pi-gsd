# Proposal: User-Clarified Acceptance Criteria in GSD

> Three strategies for giving GSD explicit, user-approved acceptance criteria that must pass before the AI considers execution done.

---

## Problem Statement

Today, "done" in GSD is determined by the AI at multiple levels, but **the user never explicitly signs off on what tests must pass**:

| Current Mechanism | Who Defines It | Problem |
|---|---|---|
| **Success Criteria** in ROADMAP.md | `gsd-roadmapper` (AI subagent) | High-level, written once during project init, never refined with user |
| **`must_haves`** in PLAN.md frontmatter | `gsd-planner` (AI subagent) | Derived by AI via "goal-backward" methodology — user never reviews |
| **`<done>`** tag per task | `gsd-planner` (AI subagent) | Task-level done criteria — entirely AI-authored |
| **`<verify>`** tag per task | `gsd-planner` (AI subagent) | A bash command the executor runs after each task — AI picks the command |
| **Self-Check** in executor | `gsd-executor` (AI subagent) | Verifies files exist and commits landed — structural, not behavioral |
| **VERIFICATION.md** | `gsd-verifier` (AI subagent) | Post-execution audit — checks code exists and is wired, but no user-authored test criteria |
| **UAT (verify-work)** | `gsd-verifier` extracts tests from SUMMARY.md | Closest to user validation, but runs **after** execution is complete, tests derived from what AI **claims** it built |

**The gap:** At no point does the user say *"Here are the specific tests that must pass for me to consider this phase done"* **before** the AI starts executing. The AI defines its own finish line, then checks itself against it.

---

## Goal

Create a mechanism where:
1. **The user articulates or approves** specific acceptance criteria before execution
2. These criteria take the form of **concrete, testable assertions** (not vague "should work well")
3. The executor **must verify these tests pass** before declaring a task/plan/phase done
4. If any test fails, execution **cannot proceed** without addressing it or getting explicit user override

---

## Strategy 1: Acceptance Criteria Step in discuss-phase

> **Approach:** Add an acceptance criteria discussion to the end of `/gsd:discuss-phase`, before CONTEXT.md is finalized. AC lives in CONTEXT.md and flows downstream.

### How It Works

After the user finishes discussing gray areas (end of Phase 9 in the discuss-phase flow), add a new step: **"Define Acceptance Tests."**

#### Step-by-step

1. **LLM proposes tests based on discussion.** Using the phase goal from ROADMAP.md, the requirements from REQUIREMENTS.md, and the decisions just captured, the LLM generates 5-10 proposed acceptance tests:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► ACCEPTANCE CRITERIA
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Based on our discussion, here are proposed acceptance tests
   for Phase 1: Foundation.

   These must ALL pass for the phase to be considered done.

   ## Proposed Tests

   AC-01: Create a new task with title and status
     GIVEN the app is running
     WHEN user clicks "New Task" and enters a title
     THEN a task appears in the list with status "todo"

   AC-02: Tasks persist across page refresh
     GIVEN a task has been created
     WHEN user refreshes the browser
     THEN the task is still visible with all fields intact

   AC-03: Tasks belong to exactly one project
     GIVEN a project exists
     WHEN user creates a task inside that project
     THEN the task appears only in that project's task list

   AC-04: Kanban status transitions work
     GIVEN a task with status "todo"
     WHEN user changes status to "in-progress"
     THEN the task moves to the in-progress column

   AC-05: Manual drag-and-drop ordering persists
     GIVEN multiple tasks in a project
     WHEN user drags task B above task A
     THEN the new order persists after page refresh
   ```

2. **User reviews and edits.** The LLM asks:
   > "Review these acceptance tests. Which should I keep, modify, or remove? Add any I missed."
   >
   > Options:
   > 1. Approve all
   > 2. Let me edit some
   > 3. Add more tests

   The user can modify wording, add domain-specific tests the AI missed, remove tests they don't care about, or change the Given/When/Then specifics.

3. **AC written to CONTEXT.md.** The final approved list is added as a new `<acceptance_criteria>` section in CONTEXT.md:

   ```markdown
   <acceptance_criteria>
   ## Acceptance Criteria

   Status: approved by user

   ### AC-01: Create a new task with title and status
   - GIVEN: the app is running
   - WHEN: user clicks "New Task" and enters a title
   - THEN: a task appears in the list with status "todo"
   - Test type: automated (UI test or integration test)

   ### AC-02: Tasks persist across page refresh
   - GIVEN: a task has been created
   - WHEN: user refreshes the browser
   - THEN: the task is still visible with all fields intact
   - Test type: automated (integration test)

   ...
   </acceptance_criteria>
   ```

4. **Downstream consumption:**
   - **`gsd-planner`** reads `<acceptance_criteria>` and maps each AC to specific tasks. The planner MUST ensure every AC-ID is addressed by at least one task's `<done>` criteria. Plan frontmatter gains an `acceptance_criteria` field listing AC-IDs.
   - **`gsd-executor`** runs each task. After completing a plan, the executor checks the relevant AC tests. If any fail, the executor must attempt a fix before creating SUMMARY.md.
   - **`gsd-verifier`** uses AC tests as the **primary** verification source (replacing AI-derived must_haves). AC tests become the source of truth for what "done" means.

### Files Modified

| File | Change |
|---|---|
| `gsd/workflows/discuss-phase.md` | Add `acceptance_criteria` step between `discuss_areas` and `write_context` |
| `gsd/templates/context.md` | Add `<acceptance_criteria>` section to template |
| `agents/gsd-planner.md` | Add AC mapping rules — every AC must trace to a task |
| `agents/gsd-executor.md` | Add post-plan AC verification — run AC checks before SUMMARY |
| `agents/gsd-verifier.md` | Use AC as primary verification source |
| `gsd/workflows/verify-phase.md` | Load AC from CONTEXT.md instead of deriving from SUMMARY.md |

### Pros

- **Minimal new workflow** — fits naturally into the existing discuss-phase conversation
- **User already in "decision mode"** — they just finished discussing how things should work
- **Flows downstream automatically** — planner and executor already read CONTEXT.md
- **No new commands to learn** — same `/gsd:discuss-phase` flow

### Cons

- **Mixed concerns in CONTEXT.md** — CONTEXT.md currently captures *implementation decisions*, not *test specifications*
- **May feel rushed** — user just finished a long discussion, now asked to define tests too
- **Phase-level granularity only** — AC covers the whole phase, not individual plans; may be too coarse for large phases
- **Harder to iterate** — editing AC requires re-running discuss-phase or manually editing the file

### Estimated Effort

**Small-medium.** Changes to 6 existing files, no new workflows or tools. The discuss-phase workflow gains ~1 new step. Planner and executor get new rules but no structural changes.

---

## Strategy 2: Dedicated `/gsd:define-ac` Command (New Phase)

> **Approach:** Create a standalone command that runs between discuss-phase and plan-phase. Produces a dedicated `AC.md` file with user-approved acceptance criteria and optionally generates test stubs.

### How It Works

A new command `/gsd:define-ac <phase>` creates a dedicated acceptance criteria artifact. It's a separate step in the workflow — the user explicitly chooses to define AC before planning.

#### Flow Position

```
/gsd:discuss-phase 1  →  /gsd:define-ac 1  →  /gsd:plan-phase 1
     (decisions)           (tests)              (tasks)
```

The command is **recommended but optional**. If the user skips it, the system falls back to current behavior (AI-derived must_haves).

#### Step-by-step

1. **Initialize.** Load phase context via `gsd-tools init phase-op`, read CONTEXT.md, ROADMAP.md success criteria, and REQUIREMENTS.md.

2. **LLM generates comprehensive AC draft.** Unlike Strategy 1 (which has limited context from just the discussion), this command has the full CONTEXT.md decisions to work from. The LLM generates AC in three tiers:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► DEFINING ACCEPTANCE CRITERIA
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   ## Must Pass (execution blocks if these fail)

   AC-01: [Critical behavior]
     GIVEN ...
     WHEN ...
     THEN ...
     Verify: [bash command or manual check]

   AC-02: [Critical behavior]
     ...

   ## Should Pass (warnings, execution continues)

   AC-03: [Important but non-blocking]
     ...

   ## Nice to Have (checked but never blocks)

   AC-04: [Polish / edge case]
     ...
   ```

3. **User reviews each tier.** The LLM walks through each tier one at a time:

   > **Must Pass tests** — these BLOCK execution if they fail.
   > 1. Approve these must-pass tests
   > 2. Move some to "Should Pass" (they're important but not blocking)
   > 3. Add more must-pass tests
   > 4. Edit specific tests

   Then the same for "Should Pass" and "Nice to Have." Users can promote/demote between tiers.

4. **Optionally generate test stubs.** If the project has a test framework (detected via `package.json` or test config), the LLM can generate skeleton test files:

   ```
   > Generate test stub files for these acceptance criteria?
   > 1. Yes — create test files with TODO bodies (tests written during execution)
   > 2. No — AC stays as documentation only
   ```

   If yes, generates files like `tests/ac/phase-01.test.ts`:

   ```typescript
   describe("Phase 1: Foundation — Acceptance Criteria", () => {
     test.todo("AC-01: Create a new task with title and status");
     test.todo("AC-02: Tasks persist across page refresh");
     test.todo("AC-03: Tasks belong to exactly one project");
   });
   ```

5. **Write `AC.md`.** Creates `.planning/phases/01-foundation/01-AC.md`:

   ```markdown
   ---
   phase: 01-foundation
   status: approved
   approved_by: user
   approved_at: 2026-03-05T18:59:00Z
   test_stubs: tests/ac/phase-01.test.ts
   ---

   # Phase 1: Foundation — Acceptance Criteria

   ## Must Pass

   ### AC-01: Create a new task with title and status
   - **GIVEN:** the app is running
   - **WHEN:** user clicks "New Task" and enters a title
   - **THEN:** a task appears in the list with status "todo"
   - **Verify:** `npm test -- --grep "AC-01"` OR manual
   - **Requirement:** TASK-01

   ### AC-02: Tasks persist across page refresh
   - **GIVEN:** a task has been created
   - **WHEN:** user refreshes the browser
   - **THEN:** the task is still visible with all fields intact
   - **Verify:** `npm test -- --grep "AC-02"` OR manual
   - **Requirement:** TASK-01, DB-01

   ## Should Pass

   ### AC-03: Error shown for empty task title
   - **GIVEN:** user opens "New Task"
   - **WHEN:** user submits without entering a title
   - **THEN:** validation error appears, task not created
   - **Verify:** manual

   ## Nice to Have

   ### AC-04: Task creation keyboard shortcut
   - **GIVEN:** user is on the task list
   - **WHEN:** user presses Cmd+N
   - **THEN:** new task form opens
   - **Verify:** manual
   ```

6. **Git commit.** `gsd-tools commit "docs(01): define acceptance criteria" --files .planning/phases/01-foundation/01-AC.md`

7. **Downstream consumption:**
   - **`gsd-planner`** reads `AC.md` and maps AC-IDs to tasks. Every "Must Pass" AC must appear in at least one task's `<done>` criteria. "Should Pass" ACs should be covered but don't block if they can't be addressed.
   - **`gsd-executor`** after completing each plan, runs all "Must Pass" verify commands. If any fail, the executor enters a **fix loop** (max 3 attempts) before creating SUMMARY.md. "Should Pass" failures are logged as warnings.
   - **`gsd-verifier`** runs all AC verify commands as first-class verification (replaces or supplements AI-derived must_haves).
   - **`verify-work` (UAT)** uses AC tests as the test list instead of deriving tests from SUMMARY.md. This means UAT tests what the user asked for, not what the AI claims it built.

### New Files

| File | Type | Purpose |
|---|---|---|
| `commands/gsd/define-ac.md` | New command | `/gsd:define-ac <phase>` command template |
| `gsd/workflows/define-ac.md` | New workflow | Full workflow for AC definition |
| `gsd/templates/ac.md` | New template | AC.md file template with examples |

### Modified Files

| File | Change |
|---|---|
| `agents/gsd-planner.md` | Add AC mapping rules — read AC.md, map AC-IDs to tasks |
| `agents/gsd-executor.md` | Add post-plan AC verification loop |
| `agents/gsd-verifier.md` | Use AC.md as primary verification source |
| `gsd/workflows/verify-work.md` | Load AC.md for UAT test generation instead of SUMMARY.md |
| `gsd/workflows/plan-phase.md` | Check for AC.md, pass to planner if exists |
| `gsd/bin/lib/init.cjs` | Add `has_ac` detection to `cmdInitPhaseOp` and `cmdInitPlanPhase` |
| `gsd/workflows/discuss-phase.md` | Update next-steps to recommend `/gsd:define-ac` |

### Pros

- **Clean separation of concerns** — decisions (CONTEXT.md) vs tests (AC.md) vs plans (PLAN.md) are distinct artifacts
- **Tiered severity** — "Must Pass" vs "Should Pass" vs "Nice to Have" gives nuance
- **Test stub generation** — jumpstarts real test files the executor can fill in
- **Optional** — projects that don't need formal AC can skip it; system degrades gracefully to current behavior
- **Iterable** — user can re-run `/gsd:define-ac 1` to update AC without re-running discuss-phase
- **UAT alignment** — verify-work can use AC.md directly instead of deriving tests from AI-written SUMMARYs

### Cons

- **Another command to learn** — adds a step to the workflow (discuss → **define-ac** → plan → execute)
- **More files** — each phase gets an additional artifact
- **Auto-advance complexity** — auto-mode chain becomes discuss → define-ac → plan → execute
- **New workflow + template + command** — more surface area to maintain
- **May feel redundant** — users might feel like they're restating what they discussed

### Estimated Effort

**Medium.** 3 new files (command, workflow, template), 7 modified files. New gsd-tools `has_ac` detection. Auto-advance chain updated. Most complex part is the executor fix loop when AC tests fail.

---

## Strategy 3: Planner-Generated AC with User Approval Gate

> **Approach:** Let the AI planner generate acceptance criteria as part of planning, but add a **hard gate** where the user must approve them before execution can begin. AC lives in PLAN.md frontmatter but is shown to the user for approval.

### How It Works

This strategy modifies the existing plan-phase workflow. Instead of the planner silently writing `must_haves` and `<done>` criteria, the orchestrator **extracts these, reformats them as human-readable AC, and asks the user to approve/edit** before committing plans.

#### Flow Position

```
/gsd:plan-phase 1
  ├── Research (existing)
  ├── Planner creates plans (existing)
  ├── *** NEW: AC approval gate ***
  │     ├── Extract must_haves + <done> from all plans
  │     ├── Present as human-readable AC list
  │     ├── User approves/edits
  │     └── Write approved AC back into plans
  ├── Plan checker verifies (existing)
  └── Done
```

#### Step-by-step

1. **Planner generates plans as normal.** The `gsd-planner` creates PLAN.md files with `must_haves`, `<done>`, and `<verify>` tags as it does today. No changes to the planner.

2. **Orchestrator extracts and presents AC.** After the planner returns but **before** the plan-checker runs, the plan-phase orchestrator extracts all testable criteria from the plans:

   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► ACCEPTANCE CRITERIA REVIEW
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   The planner derived these acceptance criteria from your
   requirements and decisions. These must ALL pass for
   Phase 1 to be considered done.

   ## From Plan 01-01: Project Setup
   
   ☑ AC-01: Database schema creates tasks table with all fields
     Verify: `npm test -- --grep "schema"` exits 0
     Source: Task 1 <done>
   
   ☑ AC-02: Seed data loads without errors  
     Verify: `npm run seed` exits 0
     Source: Task 2 <done>

   ## From Plan 01-02: Task CRUD
   
   ☑ AC-03: Create task API returns 201 with task object
     Verify: `curl -X POST /api/tasks -d '{"title":"test"}' | jq .id`
     Source: Task 1 <done>

   ☑ AC-04: GET /api/tasks returns array of tasks
     Verify: `curl /api/tasks | jq length` > 0
     Source: Task 2 <done>

   ☑ AC-05: Tasks persist in SQLite database
     Verify: `sqlite3 dev.db "SELECT count(*) FROM tasks"` > 0
     Source: must_haves.truths[0]

   ## From Plan 01-03: Task UI

   ☑ AC-06: Task list renders in the browser
     Verify: manual — open app, see task list
     Source: must_haves.truths[1]

   ☑ AC-07: Drag-and-drop reorders tasks
     Verify: manual — drag task, refresh, order persists
     Source: Task 3 <done>
   ```

3. **User reviews.** The orchestrator asks:
   > "These are the criteria the executor will verify. Review and adjust:"
   > 1. Approve all — proceed to plan check
   > 2. Edit criteria — change wording, verify commands, or severity
   > 3. Add criteria — tests the planner missed
   > 4. Remove criteria — over-specified, not needed

   If the user edits or adds criteria, the orchestrator writes the changes back into the PLAN.md frontmatter (`must_haves`) and task `<done>` / `<verify>` tags.

4. **Write phase-level AC summary.** The approved AC list is written as a lightweight `01-AC.md` in the phase directory — serves as a human-readable index of what must pass:

   ```markdown
   ---
   phase: 01-foundation
   status: approved
   approved_at: 2026-03-05T18:59:00Z
   source: plan-derived
   ---

   # Phase 1 — Approved Acceptance Criteria

   | ID | Criterion | Verify | Plan | Status |
   |----|-----------|--------|------|--------|
   | AC-01 | Database schema creates tasks table | `npm test -- --grep "schema"` | 01-01 | pending |
   | AC-02 | Seed data loads without errors | `npm run seed` | 01-01 | pending |
   | AC-03 | Create task API returns 201 | `curl ...` | 01-02 | pending |
   | AC-04 | GET /api/tasks returns array | `curl ...` | 01-02 | pending |
   | AC-05 | Tasks persist in SQLite | `sqlite3 ...` | 01-02 | pending |
   | AC-06 | Task list renders in browser | manual | 01-03 | pending |
   | AC-07 | Drag-and-drop reorders tasks | manual | 01-03 | pending |
   ```

5. **Executor enforcement.** The executor operates exactly as today, but with a post-plan addition:
   - After completing each plan, the executor runs all `<verify>` commands from that plan's tasks
   - Cross-references results against the AC summary
   - If any "Must Pass" verify command fails → fix loop (max 3 attempts)
   - Updates AC.md status column (`pending` → `passed` / `failed`)

6. **Verifier uses AC.md as source of truth.** The verifier reads `AC.md` instead of deriving must_haves from PLAN frontmatter or ROADMAP success criteria. What the user approved is what gets verified.

### Files Modified

| File | Change |
|---|---|
| `gsd/workflows/plan-phase.md` | Add AC extraction + user approval gate between planner return and plan-checker |
| `agents/gsd-executor.md` | Strengthen post-plan verify: cross-reference AC.md, fix loop on failure |
| `agents/gsd-verifier.md` | Read AC.md as primary verification source |
| `gsd/workflows/verify-phase.md` | Load AC.md for verification |
| `gsd/workflows/verify-work.md` | Use AC.md for UAT test generation |
| `gsd/bin/lib/init.cjs` | Add `has_ac` to init phase-op |

### New Files

| File | Type | Purpose |
|---|---|---|
| `gsd/templates/ac.md` | New template | Phase AC summary template |

### Pros

- **Leverages existing AI work** — the planner already generates must_haves and done criteria; this just adds a review gate
- **User sees what AI plans to check** — transparency into the AI's own "finish line"
- **Minimal new workflow** — no new command; it's a gate inside the existing plan-phase flow
- **Concrete verify commands** — user can see and approve the actual bash commands the executor will run
- **Plan-level traceability** — each AC traces to a specific plan and task
- **Catches AI blind spots** — user can add tests the planner missed, or fix verify commands that are wrong

### Cons

- **Depends on planner quality** — if the planner generates weak must_haves and done criteria, the user is reviewing weak starting material
- **Late in the pipeline** — user defines AC after plans are written; if AC changes are substantial, plans may need replanning
- **Can't define AC early** — unlike Strategy 1 (discuss) or 2 (dedicated command), the user can't think about AC before the planner runs
- **Editing must_haves is fiddly** — writing changes back into PLAN.md frontmatter YAML is error-prone
- **Plan-coupled** — AC is tied to plan structure; if plans get replanned, AC must be re-reviewed

### Estimated Effort

**Small-medium.** 1 new template file, 6 modified files. The most complex part is the orchestrator logic to extract AC from plans, present to user, and write edits back into PLAN.md frontmatter.

---

## Comparison Matrix

| Dimension | Strategy 1: In discuss-phase | Strategy 2: Dedicated `/gsd:define-ac` | Strategy 3: Plan-derived + gate |
|---|---|---|---|
| **When AC is defined** | During discussion (before planning) | After discussion, before planning | After planning, before execution |
| **Who drafts initial AC** | LLM from discussion context | LLM from CONTEXT.md + ROADMAP.md | Planner AI (existing must_haves) |
| **User control** | Reviews and edits proposed tests | Full control with tiered severity | Reviews AI-generated, can edit |
| **AC granularity** | Phase-level | Phase-level, tiered | Plan-level and task-level |
| **New commands** | 0 | 1 (`/gsd:define-ac`) | 0 |
| **New files per phase** | 0 (section in CONTEXT.md) | 1 (`AC.md`) | 1 (`AC.md`) |
| **New workflows** | 0 | 1 | 0 |
| **Downstream changes** | Planner, executor, verifier | Planner, executor, verifier, UAT | Executor, verifier, UAT |
| **Auto-advance impact** | Minimal (extends discuss-phase) | Chain gains new link | Minimal (gate inside plan-phase) |
| **Test stub generation** | No | Yes (optional) | No (but verify commands exist) |
| **Effort** | Small-medium | Medium | Small-medium |
| **Risk** | Mixed concerns in CONTEXT.md | Another step users might skip | Depends on planner quality |
| **Graceful degradation** | Falls back to current behavior | Falls back to current behavior | Falls back to current behavior |

---

## Recommendation

**Strategy 2 (Dedicated `/gsd:define-ac`)** provides the cleanest architecture and best user experience, but at the cost of an additional workflow step.

**Strategy 1 (In discuss-phase)** is the fastest to implement and lowest-friction for users, but mixes concerns.

**Strategy 3 (Plan-derived + gate)** is a pragmatic middle ground — it leverages the planner's existing work and gives the user a review gate without a new command.

A **hybrid approach** could combine the best of these:
- Strategy 1's timing (AC conversation happens during discuss-phase when the user is already thinking about "how it should work")
- Strategy 2's artifact separation (AC goes into its own file, not embedded in CONTEXT.md)
- Strategy 3's verify commands (once plans exist, the planner maps AC to concrete bash commands)

The hybrid would flow:
1. `discuss-phase` captures user AC as high-level Given/When/Then assertions → writes `AC.md` 
2. `plan-phase` planner maps each AC to tasks, adds concrete `<verify>` commands → updates `AC.md` with verify commands
3. `execute-phase` executor runs verify commands against AC → updates AC.md status
4. `verify-work` uses AC.md as the test list

This keeps the user's voice in the AC while leveraging the AI's ability to translate intent into executable checks.
