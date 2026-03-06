# P1 — Do Next: Regression AC, Negotiation Log, Environment Prerequisites

> **Priority:** P1 — These prevent the most common failure modes during execution.  
> **Recommendations:** #4 (Regression AC), #7 (Negotiation Log), #9 (Environment Prerequisites)  
> **Audience:** Implementer tasked with modifying GSD workflows, agents, and templates  
> **Source:** [PM Recommendations for AC](pm-recommendations-for-ac.md)  
> **Depends on:** P0 recommendations should be implemented first (particularly #5 Manual Sign-Off for regression context)

---

## Why P1

P0 establishes the structural foundation — what "done" means, when you're ready, and how manual checks get enforced. P1 addresses the three most common **runtime failure modes** that waste executor cycles and lose context:

1. **Regressions go undetected** — Phase 3 breaks Phase 1 and nobody checks
2. **Tier change reasoning is lost** — A Must Pass becomes a Should Pass but nobody remembers why
3. **Environment issues burn fix-loop attempts** — The executor fights a stopped server instead of real code bugs

These are operational problems. They don't prevent AC from working — they prevent AC from working *well*.

---

## Recommendation #4: Regression AC — Prior Phase Verification

### Problem

Phase 3 builds on Phases 1 and 2. The executor for Phase 3 might break something from Phase 1 — a classic regression. Database schema changes in Phase 3 could invalidate Phase 1's data persistence guarantees. API refactoring in Phase 3 could break Phase 2's endpoint contracts.

Currently, the executor only verifies the **current phase's** AC. It has no awareness of prior phases' Must Pass criteria. A PM would never accept "we shipped Phase 3 but didn't check if Phase 1 still works."

### Goal

After all plans in a phase complete and current-phase AC passes, **automatically re-run Must Pass verify commands from all prior completed phases**. Only automated verify commands (bash commands) are re-run — manual checks are excluded to keep regression checks fast and non-interactive.

### What "Done" Looks Like for This Recommendation

- [ ] After all plans in a phase complete, the executor runs a regression check step
- [ ] The regression check finds all prior AC.md files for completed phases
- [ ] It extracts Must Pass criteria with automated (non-manual) verify commands
- [ ] It runs each verify command and reports pass/fail
- [ ] If a regression is detected, the user gets clear options: fix now, log and continue, or investigate
- [ ] A config option controls regression behavior: enabled/disabled, depth (all phases vs. last N)

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/workflows/execute-phase.md` | Modify | Add regression check step after all plans complete |
| `agents/gsd-executor.md` | Modify | Add awareness of regression protocol and how to handle failures |
| `gsd/templates/config.json` | Modify | Add `regression_check` (boolean) and `regression_depth` ("all" or "last-N") defaults |

### Behavior Specification

**Regression check flow:**

1. After all plans in the current phase complete and current-phase AC passes
2. Find all prior AC.md files: `find .planning/phases -name "*-AC.md" | sort`
3. For each prior phase's AC.md where the phase status is "executed" or "verified":
   - Extract Must Pass criteria
   - Filter to only automated verify commands (skip any starting with "manual")
   - Run each verify command
4. Report results:

**No regressions:**
```
GSD ► REGRESSION CHECK

Phase 1 AC: 2/2 automated Must Pass still passing ✓
Phase 2 AC: 3/3 automated Must Pass still passing ✓

No regressions detected.
```

**Regression detected:**
```
⚠ REGRESSION: Phase 1 AC-02 now FAILING
  Verify: `sqlite3 dev.db "SELECT count(*) FROM tasks"` → returned 0
  This passed after Phase 1 but fails after Phase 3 execution.

Options:
  1. Fix now — enter fix loop for regression
  2. Log and continue — record as known regression
  3. Investigate — show what changed
```

**Config options:**

```json
{
  "workflow": {
    "regression_check": true,
    "regression_depth": "all"
  }
}
```

- `regression_check: false` — skip regression entirely (for prototypes/hackathons)
- `regression_depth: "all"` — check all prior phases
- `regression_depth: "last-2"` — only check the 2 most recent prior phases (for large projects)

### Constraints

- Only run automated verify commands — never manual checks (keeps it fast and non-interactive)
- Regression check runs AFTER current-phase AC passes — don't add overhead if current phase already fails
- If a regression fix loop succeeds, re-run current phase AC to make sure the fix didn't break the fix
- Default to enabled for standard/strict enforcement levels; disabled for light (ties to P2 Rec #10)

---

## Recommendation #7: Negotiation Log — Why Tiers Changed

### Problem

During `gsd:define-ac`, the user can promote or demote AC between tiers (e.g., Must Pass → Should Pass, Nice to Have → Must Pass). These are meaningful trade-off decisions — but the reasoning behind them is lost. The final AC.md shows the result but not the rationale.

Three months later (or in a new LLM session), someone looks at AC.md and wonders: *"Why isn't drag-and-drop ordering a Must Pass? That seems critical."* There's no answer.

This also impacts UAT — if a Should Pass criterion fails, the negotiation log tells you whether it was *almost* a Must Pass (pay attention) or a distant Nice to Have that got bumped up (less urgent).

### Goal

When a user moves an AC between tiers during the `define-ac` review steps, **capture a brief reason** for the change. Store these in a `## Negotiation Log` section in AC.md. The log preserves trade-off context for future sessions, UAT decisions, and project retrospectives.

### What "Done" Looks Like for This Recommendation

- [ ] When a user changes an AC's tier during `define-ac` review, the workflow asks for a brief reason
- [ ] The reason is stored in a `## Negotiation Log` table in AC.md
- [ ] The log records: AC-ID, original tier, new tier, reason, and date
- [ ] The negotiation log is preserved across AC updates (append-only within a session)
- [ ] The log is human-readable and serves as a decision audit trail

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/workflows/define-ac.md` | Modify | Add reason capture when tier changes occur in review steps |
| `gsd/templates/ac.md` | Modify | Add `## Negotiation Log` section template |

### Behavior Specification

**Capture flow (during review steps):**

When the user selects "Move to Should Pass" (or any tier change):

1. Ask: "Which AC-IDs?" → user specifies
2. Ask: "Brief reason? (helps future you understand the trade-off)"
3. User provides reasoning (e.g., "Can ship without it — polish item")
4. Record in AC.md

**Negotiation Log format in AC.md:**

```markdown
## Negotiation Log

| AC-ID | From | To | Reason | Date |
|-------|------|----|--------|------|
| AC-05 | Must Pass | Should Pass | Can ship without it — polish item | 2026-03-06 |
| AC-08 | Nice to Have | Must Pass | User realized this is core to workflow | 2026-03-06 |
```

**When log is consulted:**

| Consumer | How It Uses the Log |
|----------|-------------------|
| UAT reviewer | Understands severity context — a demoted Must Pass deserves more scrutiny than an original Should Pass |
| Future LLM session | Understands why tiers don't match intuition — prevents re-raising resolved debates |
| Retrospective | Reveals patterns — if many Must Pass get demoted, initial criteria may be too aggressive |

### Constraints

- The reason prompt should be low-friction — one sentence, not a formal justification
- If the user declines to give a reason, record "No reason provided" (don't block the workflow)
- The log is append-only within a session — tier changes during the same `define-ac` run stack
- If AC is updated in a later session, the prior session's negotiation log entries are preserved

---

## Recommendation #9: Verification Environment Prerequisites

### Problem

AC verify commands assume an environment: the app is running, the database is seeded, the API is reachable. But nobody validates this before running verify commands. The executor might run `curl localhost:3000/api/tasks` while the server isn't started, get a connection refused error, enter a 3-attempt fix loop trying to "fix" code that's actually fine — the environment just isn't up.

This wastes fix-loop attempts on infrastructure problems instead of actual code issues. It also creates confusing SUMMARY.md results where AC "failures" are really environment failures.

### Goal

Add an `## Environment` section to AC.md that defines prerequisites which must be true before any verify commands run. The executor checks these first. If a prerequisite fails, it attempts to fix the environment (install deps, start server, seed database) before running AC verify commands. Environment failures are reported differently from AC failures.

### What "Done" Looks Like for This Recommendation

- [ ] AC.md template includes an `## Environment` section with prerequisite checks
- [ ] `gsd:define-ac` proposes environment prerequisites based on the project's tech stack
- [ ] The executor checks environment prerequisites before running any AC verify commands
- [ ] If a prerequisite fails, the executor attempts automatic remediation (npm install, start server, etc.)
- [ ] If remediation fails, the issue is reported as ENVIRONMENT ISSUE, not AC FAILURE
- [ ] Environment checks don't consume fix-loop attempts

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/templates/ac.md` | Modify | Add `## Environment` section template |
| `gsd/workflows/define-ac.md` | Modify | Add environment prerequisite proposal step |
| `agents/gsd-executor.md` | Modify | Check environment prerequisites before AC verification; handle remediation |

### Behavior Specification

**Environment section format in AC.md:**

```markdown
## Environment

Prerequisites that must be true before running verify commands.
The executor checks these first — if they fail, it's an environment issue, not a code issue.

| Check | Command | Remediation |
|-------|---------|-------------|
| Dependencies installed | `[ -d node_modules ]` | `npm install` |
| Server running | `curl -s -o /dev/null -w '%{http_code}' localhost:3000/health \| grep 200` | `npm run dev &` (wait 5s) |
| Database seeded | `sqlite3 dev.db "SELECT count(*) FROM tasks" \| grep -q '^[1-9]'` | `npm run seed` |
```

**Executor behavior:**

1. Before running any AC verify commands, read the `## Environment` section
2. Run each prerequisite check command
3. If a check fails, attempt the remediation command
4. Re-run the check after remediation
5. If the check still fails after remediation → report as ENVIRONMENT ISSUE and halt verification
6. Only after ALL prerequisites pass → proceed to run AC verify commands

**Environment check report:**

```
GSD ► ENVIRONMENT CHECK

  ✓ Dependencies installed
  ✗ Server running → attempting remediation...
    → Started dev server (npm run dev)
    → Re-check: ✓ Server responding on :3000
  ✓ Database seeded

  Environment ready. Proceeding to AC verification.
```

**Environment failure report:**

```
⚠ ENVIRONMENT ISSUE — Cannot verify AC

  ✗ Database seeded → remediation failed
    → `npm run seed` exited with code 1
    → Error: "relation 'tasks' does not exist"

  This is an infrastructure problem, not an AC failure.
  Fix the environment manually, then re-run verification.
```

### How `define-ac` Proposes Prerequisites

During the AC definition workflow, after AC criteria are defined:

1. Analyze the verify commands across all AC
2. Identify common dependencies (server, database, filesystem, external services)
3. Propose environment prerequisites with check commands and remediation steps
4. User reviews and approves (can edit, add, remove)

### Constraints

- Environment checks must be fast (< 5 seconds each)
- Remediation commands should be idempotent (running `npm install` when deps exist should be harmless)
- Environment failures do NOT consume fix-loop attempts — they're a separate category
- The executor should wait a reasonable time after remediation (e.g., 5 seconds for server startup) before re-checking

---

## Implementation Dependencies

```
#4 Regression ──────► Depends on prior phases having AC.md files (basic GSD structure)
                      Enhanced by P0 #2 (DoR) which ensures prior phases are verified
                      Ties to P2 #10 (Config) for enforcement level settings

#7 Negotiation Log ─► Independent — only modifies define-ac workflow and AC template
                      No dependencies on other recommendations

#9 Environment ─────► Independent — only modifies AC template, define-ac, and executor
                      No dependencies on other recommendations
```

**Recommended implementation order within P1:** #9 → #7 → #4

- #9 (Environment) is the quickest win — prevents the most common executor frustration
- #7 (Negotiation Log) is a small, self-contained change to define-ac
- #4 (Regression) is the most complex — involves post-execution logic and config integration

---

## What This Document Does NOT Cover

- **How to implement these changes** — That's the planner's job. This document defines WHAT and WHY.
- **Code-level details** — The planner will determine exact edits to workflow markdown and agent instructions.
- **Testing strategy** — The planner should define how to verify these changes work correctly.
- **Integration with P0** — P0 should be implemented first, but these P1 changes don't require modifying P0 work. They build on the same files but target different sections/steps.
