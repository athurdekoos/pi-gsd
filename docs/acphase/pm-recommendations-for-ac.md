# PM Recommendations: Strengthening Definition of Done Across GSD Workflows

> **Perspective:** Experienced project manager reviewing AC integration points  
> **Scope:** `gsd:new-project`, `gsd:define-ac`, `gsd:plan-phase`  
> **Date:** 2026-03-06  
> **Goal:** Ensure "done" is well understood and aligned by all parties — user, orchestrator LLM, sub-agents, and future sessions

---

## The Alignment Problem

In GSD, "all parties" aren't humans in a room. They're:

| Party | How They Consume "Done" | Risk If Misaligned |
|-------|------------------------|--------------------|
| **User** | Reviews SUMMARY.md, runs UAT | Accepts work that doesn't match intent |
| **Orchestrator LLM** | Routes workflows, checks gates | Advances past a phase that isn't actually done |
| **gsd-planner** | Maps AC to tasks, writes `<done>` tags | Creates plans that miss what the user cares about |
| **gsd-executor** | Runs verify commands, enters fix loops | "Passes" checks that don't test the right things |
| **gsd-verifier** | Audits against must_haves or AC | Verifies the wrong criteria |
| **Future sessions** | Reads STATE.md, ROADMAP.md, AC.md | Loses context on what "done" actually meant |

The current AC recommendation handles the planner → executor → verifier chain well. What's missing is the **upstream definition** (where "done" first gets articulated) and the **cross-phase continuity** (how "done" compounds across phases).

---

## Recommendation 1: Project-Level Definition of Done in `new-project`

### The Gap

Today, `new-project` creates:
- `PROJECT.md` — vision, constraints, core value
- `REQUIREMENTS.md` — checkable REQ-IDs with categories
- `ROADMAP.md` — phases with AI-generated success criteria
- `config.json` — workflow preferences

**None of these capture what "project done" looks like from the user's perspective.** The roadmap's success criteria are AI-authored. Requirements are checkboxes, not testable assertions. The user never says: *"The project is done when these 3-5 things are true."*

This matters because phase-level AC can drift. Each phase might pass its AC while the overall project misses the mark — the parts work but the whole doesn't.

### The Fix: Add a "Done Means" Step to `new-project`

After requirements are approved (Step 7) and before roadmap creation (Step 8), add:

```markdown
## 7.5. Project Definition of Done

Display:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► DEFINITION OF DONE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  You've defined WHAT to build (requirements).
  Now define WHEN it's done.

  Think: "I'll consider this project successful when..."

Present 3-5 LLM-proposed project-level done criteria derived from
PROJECT.md core value and REQUIREMENTS.md:

  DONE-01: A user can sign up, create a project, add tasks, and
           track them through to completion — end to end, no dead ends.

  DONE-02: Data persists across sessions. Nothing the user creates
           is lost unless they delete it.

  DONE-03: The app loads and responds to interactions within 2 seconds
           on a standard connection.

User reviews, edits, adds, removes. Then approved list is written to
REQUIREMENTS.md as a new "## Definition of Done" section:

  ## Definition of Done

  The project is complete when ALL of these are true:

  - [ ] **DONE-01**: A user can complete the full task lifecycle
        (create → assign → track → complete) without leaving the app
  - [ ] **DONE-02**: All user data persists across sessions and
        browser refreshes
  - [ ] **DONE-03**: Core interactions respond within 2 seconds

  These are the ultimate acceptance criteria. Phase-level AC should
  trace back to one or more of these.
```

### Why This Matters for AC

When `define-ac` runs for Phase 3, the LLM can check: *"Do this phase's AC contribute to DONE-01, DONE-02, or DONE-03?"* If a phase has 8 AC but none trace to a project-level DONE, something is wrong — the phase is delivering work nobody asked for.

### Downstream Impact

| Consumer | How It Uses Project Done |
|----------|------------------------|
| `gsd-roadmapper` | Maps each DONE-ID to phases — ensures coverage |
| `define-ac` | Cross-references phase AC against project DONE — flags gaps |
| `verify-work` (final phase UAT) | Tests project-level DONE criteria after last phase |
| `complete-milestone` | Checks DONE criteria as milestone exit gate |

### Files Modified

| File | Change |
|------|--------|
| `gsd/workflows/new-project.md` | Add Step 7.5 between requirements and roadmap |
| `gsd/templates/requirements.md` | Add "Definition of Done" section to template |
| `gsd/workflows/define-ac.md` | Load DONE criteria during `load_context` step |

---

## Recommendation 2: Definition of Ready Checklists

### The Gap

GSD has implicit readiness checks scattered across workflows — `plan-phase` warns when CONTEXT.md is missing, `execute-phase` errors when plans don't exist. But there's no formalized "Definition of Ready" (DoR) that a user or LLM can consult to know: *"Is this phase ready for the next step?"*

This is a PM fundamental. DoD tells you when you're finished. DoR tells you when you're allowed to start.

### The Fix: Formalize DoR for Each Workflow Transition

Add a `gsd/references/definition-of-ready.md` that every workflow can consult:

```markdown
# Definition of Ready — Workflow Transition Gates

## Ready to Discuss (gsd:discuss-phase)
- [ ] Phase exists in ROADMAP.md
- [ ] Phase has mapped requirements (REQ-IDs)
- [ ] Prior phase is complete OR this is Phase 1
- [ ] PROJECT.md exists with core value and constraints

## Ready to Define AC (gsd:define-ac)
- [ ] CONTEXT.md exists for this phase (decisions locked)
      OR user explicitly chooses to define AC without context
- [ ] ROADMAP.md success criteria exist for this phase
- [ ] REQUIREMENTS.md has REQ-IDs mapped to this phase
- [ ] No unresolved blockers in STATE.md for this phase

## Ready to Plan (gsd:plan-phase)
- [ ] AC.md exists for this phase (user's definition of done) — **REQUIRED, no skip**
- [ ] CONTEXT.md exists (implementation decisions locked)
      OR user explicitly continues without context
- [ ] Research complete OR explicitly skipped
- [ ] No in-progress plans from a prior incomplete session

## Ready to Execute (gsd:execute-phase)
- [ ] At least one PLAN.md exists for this phase
- [ ] Plan checker passed OR user overrode issues
- [ ] AC.md mapped to plan tasks (every Must Pass has a home)
- [ ] No unresolved checkpoint from prior execution attempt
- [ ] Prior phase verification passed (no cascading failures)

## Ready to Verify (gsd:verify-work)
- [ ] All plans in the phase have SUMMARY.md files
- [ ] Executor self-check passed on all plans
- [ ] AC.md verify commands are runnable (environment is up)
```

### How It's Used

Each workflow's `initialize` step already runs `gsd-tools init` and checks some conditions. The DoR reference formalizes and completes those checks. The workflow reads the reference, evaluates each condition, and reports:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► READINESS CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 3: Comments — Ready to Plan?

  ✓ AC.md exists (6 criteria: 3 must, 2 should, 1 nice)
  ✓ CONTEXT.md exists (decisions locked 2026-03-05)
  ✓ Research complete (RESEARCH.md from 2026-03-05)
  ✗ Prior phase verification not complete
    → Phase 2 has no VERIFICATION.md. Run /gsd:verify-work 2 first.

  Result: NOT READY — 1 blocker
```

### Files Added

| File | Purpose |
|------|---------|
| `gsd/references/definition-of-ready.md` | Formalized DoR for each workflow transition |

### Files Modified

| File | Change |
|------|--------|
| `gsd/workflows/define-ac.md` | Check DoR during `initialize` step |
| `gsd/workflows/plan-phase.md` | Check DoR during `initialize` step |
| `gsd/workflows/execute-phase.md` | Check DoR during `initialize` step |
| Command files | Add `references/definition-of-ready.md` to execution_context |

---

## Recommendation 3: AC Traceability Matrix — Auto-Generated View

### The Gap

The pieces of traceability exist across GSD:
- `REQUIREMENTS.md` maps REQ-IDs → phases
- `ROADMAP.md` maps phases → success criteria
- `AC.md` maps AC-IDs → REQ-IDs
- `PLAN.md` maps tasks → AC-IDs (via `acceptance_criteria` frontmatter)
- `SUMMARY.md` maps tasks → results
- `VERIFICATION.md` maps must_haves → pass/fail

But there's no single view that shows the full chain: **REQ → AC → PLAN → VERIFIED**. A PM needs this to answer: *"Is REQ AUTH-01 actually done? Show me the proof."*

### The Fix: Add `gsd:traceability` Command

Create a lightweight command that reads all artifacts and generates a traceability report:

```markdown
---
name: gsd:traceability
description: Show requirement → AC → plan → verification traceability
argument-hint: "[phase]"
allowed-tools: [Read, Bash, Grep]
---
```

Output (for a single phase):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► TRACEABILITY — Phase 3: Comments
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REQ-ID    │ AC-ID  │ Tier       │ Plan  │ Verified │ Status
──────────┼────────┼────────────┼───────┼──────────┼────────
SOCL-04   │ AC-01  │ Must Pass  │ 03-01 │ ✓ PASS   │ ✅ Done
SOCL-04   │ AC-02  │ Must Pass  │ 03-01 │ ✓ PASS   │ ✅ Done
SOCL-04   │ AC-03  │ Should     │ 03-02 │ ⚠ WARN   │ ⚠ Partial
CONT-05   │ AC-04  │ Must Pass  │ 03-02 │ ✗ FAIL   │ ❌ Failed
CONT-05   │ AC-05  │ Nice       │ —     │ —        │ ⬜ Unmapped
──────────┴────────┴────────────┴───────┴──────────┴────────

Coverage: 4/5 AC mapped to plans (1 unmapped Nice to Have)
Must Pass: 2/3 verified passing (1 failed — AC-04)
REQ Coverage: SOCL-04 fully covered, CONT-05 partially covered

⚠ AC-04 (Must Pass) FAILED — blocks phase completion
⚠ AC-05 has no plan — consider adding or removing
```

Output (project-wide, no phase argument):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PROJECT TRACEABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase │ REQs │ ACs  │ Must │ Planned │ Verified │ Health
──────┼──────┼──────┼──────┼─────────┼──────────┼───────
  1   │  4   │  5   │  3   │  5/5    │  5/5 ✓   │ ✅
  2   │  4   │  7   │  4   │  7/7    │  7/7 ✓   │ ✅
  3   │  2   │  5   │  3   │  4/5    │  2/3 ✗   │ ❌
  4   │  5   │  —   │  —   │  —      │  —       │ ⬜
──────┴──────┴──────┴──────┴─────────┴──────────┴───────

Project DONE criteria:
  ✓ DONE-01: Full task lifecycle     (Phase 1-3)
  ✗ DONE-02: Data persistence       (Phase 3 AC-04 failing)
  ⬜ DONE-03: Performance            (Phase 4 not started)

15/18 v1 requirements covered by AC
3 requirements in Phase 4 have no AC yet
```

### Why This Matters

Without this view, a PM has to open 5+ files across multiple directories to answer "are we on track?" This is the single-pane-of-glass that makes AC meaningful — not just documentation, but a living chain of evidence.

### Files Added

| File | Purpose |
|------|---------|
| `commands/gsd/traceability.md` | Command entry point |
| `gsd/workflows/traceability.md` | Read artifacts, generate matrix |

---

## Recommendation 4: Regression AC — Prior Phase Criteria That Must Still Pass

### The Gap

Phase 3 builds on Phases 1 and 2. Phase 3's executor might break something from Phase 1 — a classic regression. Currently, the executor only verifies the current phase's AC. It has no awareness that Phase 1's AC-02 ("tasks persist across refresh") could be broken by Phase 3's database schema changes.

### The Fix: Cumulative Must Pass Verification

When the executor finishes a phase, it should also re-run Must Pass verify commands from all prior completed phases — but only the automated ones (bash commands, not manual checks).

Add to `gsd/workflows/execute-phase.md`, after all plans complete:

```markdown
## Post-Execution: Regression Check

After all plans in the phase complete and current-phase AC passes:

1. Find all prior AC.md files:
   ```bash
   find .planning/phases -name "*-AC.md" | sort
   ```

2. For each prior phase's AC.md where `status: executed`:
   - Extract Must Pass criteria with automated verify commands
   - Skip "manual" verify commands (can't automate those)
   - Run each verify command

3. Report:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► REGRESSION CHECK
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Phase 1 AC: 2/2 automated Must Pass still passing ✓
   Phase 2 AC: 3/3 automated Must Pass still passing ✓

   No regressions detected.
   ```

4. If regression detected:
   ```
   ⚠ REGRESSION: Phase 1 AC-02 now FAILING
     Verify: `sqlite3 dev.db "SELECT count(*) FROM tasks"` → returned 0
     This passed after Phase 1 but fails after Phase 3 execution.

   Options:
     1. Fix now — enter fix loop for regression
     2. Log and continue — record as known regression
     3. Investigate — show what changed
   ```
```

### Scope Guard

Regression checks only run automated verify commands. They don't re-run manual checks or UAT. This keeps them fast (seconds, not minutes) and non-interactive.

For large projects with many phases, add a config option:

```json
{
  "workflow": {
    "regression_check": true,
    "regression_depth": "all"  // or "last-2" to only check recent phases
  }
}
```

### Files Modified

| File | Change |
|------|--------|
| `gsd/workflows/execute-phase.md` | Add regression check after all plans complete |
| `agents/gsd-executor.md` | Awareness of regression protocol |
| `gsd/templates/config.json` | Add `regression_check` and `regression_depth` defaults |

---

## Recommendation 5: Manual AC Resolution Protocol

### The Gap

Many AC have `Verify: manual — [instructions]`. The executor marks these as `⏳ PENDING`. The verifier marks them as "requires user verification." But nobody ever formally asks the user to resolve them.

Today's flow:
1. Executor runs → marks manual AC as PENDING
2. Verifier runs → notes they can't be auto-verified
3. UAT runs → may or may not cover the same checks
4. Phase completes → manual AC are still PENDING forever

A PM would never accept "we didn't check 3 of 7 acceptance criteria."

### The Fix: Manual AC Sign-Off Step

Add a step to `verify-work` (UAT) that explicitly walks the user through unresolved manual AC before declaring the phase done:

```markdown
<step name="manual_ac_resolution">
**Before completing UAT, resolve pending manual AC:**

Check AC.md for this phase. Find all AC where:
- Tier is Must Pass or Should Pass
- Verify starts with "manual"
- Result in SUMMARY.md's AC table is "⏳ PENDING"

If any exist:

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► MANUAL ACCEPTANCE SIGN-OFF
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  These acceptance criteria require your verification:

  **AC-03 (Should Pass): Empty title shows validation error**
  → Open new task form, leave title empty, submit.
  → Expected: Red validation error appears, task not created.

  Does this work as expected?

User responds (same as UAT: "yes"/"pass" = pass, anything else = issue).

Update AC.md result for each resolved criterion.

Repeat for each pending manual AC.

After all resolved:
  Manual AC-03: ✓ Confirmed by user
  Manual AC-06: ✓ Confirmed by user

  All manual acceptance criteria resolved.
</step>
```

### Why This Matters

Without this, Must Pass criteria with manual verify commands are aspirational — they're written down but never enforced. The executor can't check them. The verifier can't check them. Only the user can. This step makes sure the user actually does.

### Files Modified

| File | Change |
|------|--------|
| `gsd/workflows/verify-work.md` | Add `manual_ac_resolution` step before `complete_session` |
| `gsd/templates/UAT.md` | Add manual AC sign-off section to template |

---

## Recommendation 6: AC Change Management Protocol

### The Gap

What happens when AC needs to change after it's been approved? Scenarios:

1. User runs `define-ac`, approves AC, runs `plan-phase`. During planning, realizes AC-02 is wrong.
2. Executor is mid-phase and discovers AC-03 is impossible with the chosen architecture.
3. After Phase 2 execution, user realizes Phase 3's AC needs to change based on what was learned.

Currently, the user can re-run `/gsd:define-ac` (the workflow checks for existing AC and offers Update/Replace). But there's no protocol for what happens to downstream artifacts that already consumed the old AC.

### The Fix: AC Change Impact Analysis

When AC.md is modified after initial approval, the workflow should assess downstream impact:

```markdown
<step name="change_impact" condition="updating existing AC">
**Assess downstream impact of AC changes:**

1. Check if plans exist for this phase:
   ```bash
   ls ${phase_dir}/*-PLAN.md 2>/dev/null
   ```

2. If plans exist, read each plan's `acceptance_criteria` frontmatter.
   Identify which plans reference changed/removed AC-IDs.

3. Report impact:

   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    GSD ► AC CHANGE IMPACT
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   You're changing acceptance criteria for Phase 3.

   | Change | AC-ID | Impact |
   |--------|-------|--------|
   | Modified | AC-02 | Referenced by Plan 03-01 (task 2 <done>) |
   | Removed | AC-04 | Referenced by Plan 03-02 (task 1 <done>) |
   | Added   | AC-07 | No existing plan coverage |

   Plans affected: 03-01, 03-02
   New AC without plan coverage: AC-07

   Options:
     1. Apply changes and replan — Update AC, then re-run /gsd:plan-phase 3
     2. Apply changes only — Update AC, keep existing plans (manual reconciliation)
     3. Cancel — Keep existing AC unchanged

4. If execution has started (SUMMARY.md files exist):
   Additional warning:

   ⚠ Phase 3 has completed execution (SUMMARY.md exists).
   Changing AC after execution means re-running affected plans.
   Consider defining new AC for a fix phase instead.

5. Record change in AC.md frontmatter:

   ```yaml
   change_log:
     - date: 2026-03-06T14:30:00Z
       action: modified AC-02, removed AC-04, added AC-07
       reason: "Architecture doesn't support real-time updates"
       impact: plans 03-01, 03-02 need replanning
   ```
</step>
```

### Files Modified

| File | Change |
|------|--------|
| `gsd/workflows/define-ac.md` | Add `change_impact` step when updating existing AC |
| `gsd/templates/ac.md` | Add `change_log` to frontmatter schema |

---

## Recommendation 7: Negotiation Log — Why Tiers Changed

### The Gap

During `define-ac`, the user can promote AC from Nice to Have → Should Pass, or demote Must Pass → Should Pass. These are meaningful decisions — a PM wants to know WHY a criterion was downgraded. Was it too hard? Too expensive? Not actually important?

Currently, the tier change happens and is reflected in the final AC.md, but the reasoning is lost.

### The Fix: Capture Tier Change Rationale

When a user moves an AC between tiers during the review steps, capture the reason:

```markdown
<step name="review_must_pass">
  [existing logic]

  If user selects "Move to Should Pass":
    Ask: "Which AC-IDs?" → user specifies
    Ask: "Brief reason? (helps future you understand the trade-off)"
    
    User might say: "AC-05 is important but we can ship without it"
    
    Record in AC.md:

    ## Negotiation Log

    | AC-ID | From | To | Reason | Date |
    |-------|------|----|--------|------|
    | AC-05 | Must Pass | Should Pass | Can ship without it — polish item | 2026-03-06 |
    | AC-08 | Nice to Have | Must Pass | User realized this is core to workflow | 2026-03-06 |
</step>
```

### Why This Matters

Three months from now, someone (or a future LLM session) looks at AC.md and wonders: "Why isn't drag-and-drop ordering a Must Pass? That seems critical." The negotiation log answers: *"User decided it was polish — they can ship without it."*

This also helps UAT — if a Should Pass criterion fails, the negotiation log tells you whether it was almost a Must Pass (pay attention) or a distant Nice to Have that got bumped up (less urgent).

### Files Modified

| File | Change |
|------|--------|
| `gsd/workflows/define-ac.md` | Capture reason on tier changes in review steps |
| `gsd/templates/ac.md` | Add "Negotiation Log" section to template |

---

## Recommendation 8: Risk-Weighted AC Within Tiers

### The Gap

All Must Pass criteria are treated equally. But from a PM perspective, some are riskier than others:

- AC-01: "Create a task" — low risk, straightforward CRUD
- AC-02: "Drag-and-drop reorders persist after refresh" — high risk, complex state management

The executor doesn't know to spend more time verifying AC-02 or to attempt it first so failures surface early.

### The Fix: Optional Risk Flag on AC

Add an optional `risk` field to AC entries:

```markdown
### AC-02: Drag-and-drop ordering persists
- **GIVEN:** Multiple tasks exist in a project
- **WHEN:** User drags task B above task A and refreshes
- **THEN:** The new order persists
- **Verify:** `manual — drag task, refresh, verify order`
- **Requirement:** TASK-03
- **Risk:** high — complex state sync between UI and database
```

Risk values: `low`, `medium`, `high`. Default is `medium` (not required).

### How It's Used

1. **Planner** — high-risk AC should be addressed in earlier plans/waves so failures surface sooner
2. **Executor** — high-risk AC verify commands run first in the fix loop (fail fast)
3. **Traceability view** — high-risk AC highlighted so the PM focuses review there

This is lightweight — one optional line per AC, no new workflow steps. But it gives the planner signal about execution order.

### Files Modified

| File | Change |
|------|--------|
| `gsd/templates/ac.md` | Add optional `Risk:` field to AC entry format |
| `gsd/references/ac-patterns.md` | Add risk assessment guidance |
| `agents/gsd-planner.md` | In `<ac_fidelity>`, note that high-risk AC should be in earlier waves |

---

## Recommendation 9: Verification Environment Prerequisites

### The Gap

AC verify commands assume an environment: the app is running, the database is seeded, the API is reachable. But nobody ensures this. The executor might run `curl localhost:3000/api/tasks` while the server isn't started, get a failure, enter a 3-attempt fix loop trying to fix code that's actually fine — the environment just isn't up.

### The Fix: AC.md Environment Section

Add an `## Environment` section to AC.md that the executor checks before running any verify commands:

```markdown
## Environment

Prerequisites that must be true before running verify commands.
The executor checks these first — if they fail, it's an environment issue, not a code issue.

- **Server running:** `curl -s -o /dev/null -w '%{http_code}' localhost:3000/health | grep 200`
- **Database seeded:** `sqlite3 dev.db "SELECT count(*) FROM tasks" | grep -q '^[1-9]'`
- **Dependencies installed:** `[ -d node_modules ]`

If any prerequisite fails, the executor should attempt to fix the environment
(npm install, npm run dev, npm run seed) before running AC verify commands.
```

### How It's Used

1. Executor reads Environment section before AC verification
2. Runs each prerequisite check
3. If a prerequisite fails → attempt to fix (install deps, start server, seed db)
4. If prerequisite still fails → report as ENVIRONMENT ISSUE, not AC FAILURE
5. Only after all prerequisites pass → run actual AC verify commands

This prevents wasted fix-loop iterations on environment problems.

### Files Modified

| File | Change |
|------|--------|
| `gsd/templates/ac.md` | Add `## Environment` section to template |
| `agents/gsd-executor.md` | In `<ac_verification>`, check environment prerequisites first |
| `gsd/workflows/define-ac.md` | Add environment prerequisite proposal step |

---

## Recommendation 10: Config Setting for AC Enforcement Level

### The Gap

The current recommendation has one enforcement model: Must Pass blocks, Should Pass warns, Nice to Have logs. But different projects need different levels of rigor:

- A weekend hackathon doesn't need AC at all
- A client project needs Must Pass to hard-block
- A production deployment needs regression checks AND manual sign-off

### The Fix: `workflow.ac_enforcement` Config

Add to `.planning/config.json`:

```json
{
  "workflow": {
    "ac_enforcement": "standard",
    "regression_check": true,
    "regression_depth": "all",
    "manual_signoff": true
  }
}
```

| Level | Behavior |
|-------|----------|
| `"light"` | Must Pass verified but no fix loop. Failures logged as warnings. For experiments and prototypes. |
| `"standard"` | Must Pass fix loop (3 attempts). Should Pass warns. Default. |
| `"strict"` | Must Pass fix loop + regression check + manual sign-off required. Should Pass also gets 1 fix attempt. |

**There is no "none" level.** AC is mandatory in GSD. Every phase requires acceptance criteria to be defined before planning. The enforcement level controls how strictly failures are handled, not whether AC exists.

Prompt the user during `new-project` Step 5 (Workflow Preferences):

```
{
  header: "Acceptance Criteria Enforcement",
  question: "How strictly should acceptance criteria be enforced?
             (AC is always required — this controls how failures are handled)",
  options: [
    { label: "Standard (Recommended)", description: "Must Pass criteria block completion, fix loop on failure" },
    { label: "Light", description: "Verify but log failures as warnings — for experiments and prototypes" },
    { label: "Strict", description: "Full enforcement with regression checks and manual sign-off" }
  ]
}
```

### Files Modified

| File | Change |
|------|--------|
| `gsd/workflows/new-project.md` | Add AC enforcement question to workflow preferences |
| `gsd/templates/config.json` | Add `ac_enforcement`, `regression_check`, `regression_depth`, `manual_signoff` |
| `agents/gsd-executor.md` | Read config to determine enforcement behavior |
| `gsd/workflows/execute-phase.md` | Conditional regression check based on config |
| `gsd/workflows/verify-work.md` | Conditional manual sign-off based on config |

---

## Summary: What Each Recommendation Adds

| # | Recommendation | Workflow | PM Principle |
|---|---------------|----------|-------------|
| 1 | Project-level Definition of Done | `new-project` | The parts don't define the whole |
| 2 | Definition of Ready checklists | All transitions | Don't start what you can't finish |
| 3 | Traceability matrix command | New: `gsd:traceability` | Show me the proof chain |
| 4 | Regression AC from prior phases | `execute-phase` | New work can't break old work |
| 5 | Manual AC sign-off protocol | `verify-work` | What can't be automated must still be checked |
| 6 | AC change management | `define-ac` (update mode) | Changes have downstream consequences |
| 7 | Negotiation log for tier changes | `define-ac` | Decisions need rationale |
| 8 | Risk-weighted AC | `define-ac`, `plan-phase` | Not all criteria carry equal risk |
| 9 | Environment prerequisites | `define-ac`, `execute-phase` | Don't test code when the problem is infrastructure |
| 10 | AC enforcement config | `new-project`, all consumers | Different projects need different rigor |

### Priority Order (Impact vs Effort)

| Priority | Recommendations | Why |
|----------|----------------|-----|
| **P0 — Do First** | 1 (Project DoD), 2 (DoR), 5 (Manual sign-off) | These close the biggest alignment gaps. Without project-level done and manual resolution, AC is incomplete. |
| **P1 — Do Next** | 4 (Regression), 7 (Negotiation log), 9 (Environment) | These prevent the most common failure modes: regressions, lost context, environment confusion. |
| **P2 — Do When Ready** | 3 (Traceability), 6 (Change management), 10 (Config levels) | These are force multipliers — they make everything else more visible and configurable. |
| **P3 — Polish** | 8 (Risk weighting) | Nice to have. Adds signal to the planner but doesn't block any workflow. |

### Total File Impact

| Category | Count |
|----------|-------|
| New files | 4 (DoR reference, traceability command, traceability workflow, config template updates) |
| Modified files | 12 (across workflows, agents, templates) |
| New config fields | 4 (`ac_enforcement`, `regression_check`, `regression_depth`, `manual_signoff`) |
| New command | 1 (`gsd:traceability`) |
