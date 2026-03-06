# P2 — When Ready: Traceability Matrix, AC Change Management, Enforcement Config

> **Priority:** P2 — Force multipliers that make everything else more visible and configurable.  
> **Recommendations:** #3 (Traceability Matrix), #6 (AC Change Management), #10 (AC Enforcement Config)  
> **Audience:** Implementer tasked with creating new GSD commands and modifying workflows  
> **Source:** [PM Recommendations for AC](pm-recommendations-for-ac.md)  
> **Depends on:** P0 (Project DoD, DoR, Manual Sign-Off) and P1 (Regression, Negotiation Log, Environment) should be implemented first

---

## Why P2

P0 builds the structural foundation. P1 prevents runtime failures. P2 makes the system **observable and adaptable**:

1. **Traceability** — One view to answer "is REQ AUTH-01 actually done? Show me the proof."
2. **Change Management** — Prevents silent downstream breakage when AC is modified after plans exist
3. **Config Levels** — Different projects need different rigor; one size doesn't fit all

These are force multipliers. The AC system works without them, but it works significantly better with them. They turn AC from a per-phase tool into a project-wide governance system.

---

## Recommendation #3: Traceability Matrix — `gsd:traceability` Command

### Problem

The pieces of traceability exist scattered across GSD artifacts:

| Artifact | What It Maps |
|----------|-------------|
| REQUIREMENTS.md | REQ-IDs → phases |
| ROADMAP.md | Phases → success criteria |
| AC.md | AC-IDs → REQ-IDs |
| PLAN.md | Tasks → AC-IDs (via `acceptance_criteria` frontmatter) |
| SUMMARY.md | Tasks → execution results |
| VERIFICATION.md | Must Pass → pass/fail |

But there's no **single view** that shows the full chain: **REQ → AC → PLAN → VERIFIED**. To answer "Is REQ AUTH-01 actually done?", a PM has to open 5+ files across multiple directories, mentally join the data, and hope nothing was missed.

### Goal

Create a new `gsd:traceability` command that reads all project artifacts and generates a traceability report. The command supports two modes: **phase-level** (detailed view of one phase) and **project-wide** (summary across all phases). The output is a formatted table showing the complete chain from requirement to verification, with coverage gaps and failures highlighted.

### What "Done" Looks Like for This Recommendation

- [ ] A `gsd:traceability` command exists and is callable via `/gsd:traceability [phase]`
- [ ] Phase-level mode shows: REQ-ID → AC-ID → Tier → Plan → Verified → Status for every AC in a phase
- [ ] Project-wide mode shows: per-phase summary with REQ count, AC count, Must Pass count, planned/verified counts, and health indicator
- [ ] Project-wide mode also shows Project DONE criteria status (from P0 Rec #1) if they exist
- [ ] Coverage gaps are highlighted (AC without plans, REQs without AC, Must Pass failures)
- [ ] The command is read-only — it generates a view, it doesn't modify any files

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| New: command file for `gsd:traceability` | Create | Command entry point with argument hint `[phase]` |
| New: `gsd/workflows/traceability.md` | Create | Workflow logic — read artifacts, join data, generate formatted output |

### Behavior Specification

**Phase-level output (when phase argument provided):**

```
GSD ► TRACEABILITY — Phase 3: Comments

REQ-ID    │ AC-ID  │ Tier       │ Plan  │ Verified │ Status
──────────┼────────┼────────────┼───────┼──────────┼────────
SOCL-04   │ AC-01  │ Must Pass  │ 03-01 │ ✓ PASS   │ ✅ Done
SOCL-04   │ AC-02  │ Must Pass  │ 03-01 │ ✓ PASS   │ ✅ Done
SOCL-04   │ AC-03  │ Should     │ 03-02 │ ⚠ WARN   │ ⚠ Partial
CONT-05   │ AC-04  │ Must Pass  │ 03-02 │ ✗ FAIL   │ ❌ Failed
CONT-05   │ AC-05  │ Nice       │ —     │ —        │ ⬜ Unmapped

Coverage: 4/5 AC mapped to plans (1 unmapped Nice to Have)
Must Pass: 2/3 verified passing (1 failed — AC-04)
REQ Coverage: SOCL-04 fully covered, CONT-05 partially covered

⚠ AC-04 (Must Pass) FAILED — blocks phase completion
⚠ AC-05 has no plan — consider adding or removing
```

**Project-wide output (no phase argument):**

```
GSD ► PROJECT TRACEABILITY

Phase │ REQs │ ACs  │ Must │ Planned │ Verified │ Health
──────┼──────┼──────┼──────┼─────────┼──────────┼───────
  1   │  4   │  5   │  3   │  5/5    │  5/5 ✓   │ ✅
  2   │  4   │  7   │  4   │  7/7    │  7/7 ✓   │ ✅
  3   │  2   │  5   │  3   │  4/5    │  2/3 ✗   │ ❌
  4   │  5   │  —   │  —   │  —      │  —       │ ⬜

Project DONE criteria:
  ✓ DONE-01: Full task lifecycle     (Phase 1-3)
  ✗ DONE-02: Data persistence       (Phase 3 AC-04 failing)
  ⬜ DONE-03: Performance            (Phase 4 not started)

15/18 v1 requirements covered by AC
3 requirements in Phase 4 have no AC yet
```

**Data sources the workflow reads:**

1. `.planning/REQUIREMENTS.md` — REQ-IDs and their phase mappings
2. `.planning/ROADMAP.md` — Phase definitions
3. `.planning/phases/*/AC.md` (or `*-AC.md`) — AC-IDs, tiers, requirement mappings
4. `.planning/phases/*/PLAN.md` (or `*-PLAN.md`) — `acceptance_criteria` frontmatter mapping tasks to AC-IDs
5. `.planning/phases/*/SUMMARY.md` — Execution results
6. `.planning/phases/*/VERIFICATION.md` — Verification results
7. `.planning/REQUIREMENTS.md` `## Definition of Done` section — Project DONE criteria (if exists)

**Health indicators:**

| Symbol | Meaning |
|--------|---------|
| ✅ | All Must Pass verified and passing |
| ⚠ | Some Should Pass warnings but no Must Pass failures |
| ❌ | At least one Must Pass failed or unresolved |
| ⬜ | Not started (no AC or no plans) |

### Constraints

- Read-only command — never modifies any files
- Gracefully handles missing artifacts (show "—" or "⬜" for missing data, don't error)
- Should work at any point in the project lifecycle (even with only Phase 1 planned)
- Allowed tools: Read, Bash, Grep only (no file modification tools)

---

## Recommendation #6: AC Change Management Protocol

### Problem

What happens when AC needs to change after it's been approved? Real scenarios:

1. User runs `define-ac`, approves AC, runs `plan-phase`. During planning, realizes AC-02 is wrong.
2. Executor is mid-phase and discovers AC-03 is impossible with the chosen architecture.
3. After Phase 2 execution, user realizes Phase 3's AC needs to change based on what was learned.

Currently, the user can re-run `/gsd:define-ac` — the workflow detects existing AC and offers Update/Replace. But there's no protocol for what happens to **downstream artifacts that already consumed the old AC**. Plans reference AC-IDs in their frontmatter. Summary files reference AC-IDs in results. Changing AC-02 after plans are written breaks traceability silently.

### Goal

When AC.md is modified after initial approval, the `define-ac` workflow should **assess downstream impact** — showing which plans reference changed/removed AC-IDs, whether execution has occurred, and what replanning is needed. The impact assessment informs the user's decision and the change is recorded in a `change_log` in AC.md frontmatter.

### What "Done" Looks Like for This Recommendation

- [ ] When updating existing AC, `define-ac` checks for downstream artifacts (plans, summaries)
- [ ] An impact report shows which plans reference changed/removed AC-IDs
- [ ] New AC without plan coverage is flagged
- [ ] If execution has occurred (SUMMARY.md exists), an additional warning is shown
- [ ] The user gets clear options: apply changes + replan, apply changes only, or cancel
- [ ] All changes are recorded in a `change_log` in AC.md frontmatter

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/workflows/define-ac.md` | Modify | Add `change_impact` step when updating existing AC (condition: plans exist) |
| `gsd/templates/ac.md` | Modify | Add `change_log` to frontmatter schema |

### Behavior Specification

**Change impact assessment (triggered when updating existing AC and plans exist):**

1. Read existing AC.md — extract current AC-IDs
2. Compare with proposed changes — identify modified, removed, and added AC-IDs
3. Read all plan files for this phase — check `acceptance_criteria` frontmatter
4. Identify which plans reference changed or removed AC-IDs
5. Check for SUMMARY.md files — has execution occurred?

**Impact report format:**

```
GSD ► AC CHANGE IMPACT

You're changing acceptance criteria for Phase 3.

| Change   | AC-ID | Impact |
|----------|-------|--------|
| Modified | AC-02 | Referenced by Plan 03-01 (task 2 <done>) |
| Removed  | AC-04 | Referenced by Plan 03-02 (task 1 <done>) |
| Added    | AC-07 | No existing plan coverage |

Plans affected: 03-01, 03-02
New AC without plan coverage: AC-07

Options:
  1. Apply changes and replan — Update AC, then re-run /gsd:plan-phase 3
  2. Apply changes only — Update AC, keep existing plans (manual reconciliation)
  3. Cancel — Keep existing AC unchanged
```

**Post-execution warning (if SUMMARY.md exists):**

```
⚠ Phase 3 has completed execution (SUMMARY.md exists).
Changing AC after execution means re-running affected plans.
Consider defining new AC for a fix phase instead.
```

**Change log format in AC.md frontmatter:**

```yaml
change_log:
  - date: 2026-03-06T14:30:00Z
    action: modified AC-02, removed AC-04, added AC-07
    reason: "Architecture doesn't support real-time updates"
    impact: plans 03-01, 03-02 need replanning
```

### Constraints

- Change impact only triggers when plans already exist — if no plans exist, it's just a normal AC update
- The change log is append-only — each update session adds an entry
- The user must explicitly choose an option (no silent apply)
- If execution has occurred, strongly recommend creating a fix phase rather than modifying AC in place

---

## Recommendation #10: AC Enforcement Config Levels

### Problem

The current AC system has one enforcement model: Must Pass blocks, Should Pass warns, Nice to Have logs. But different projects need different levels of rigor:

- A weekend hackathon doesn't need AC enforcement at all
- A client prototype needs basic checks but shouldn't block on edge cases
- A production deployment needs full enforcement with regression checks and manual sign-off

Forcing "standard" enforcement on every project creates friction for lightweight projects and insufficient rigor for critical ones.

### Goal

Add an `ac_enforcement` config setting to `.planning/config.json` that controls how strictly AC is enforced across all consuming workflows. The user selects their enforcement level during `gsd:new-project` (workflow preferences step). Three levels: light, standard, strict. AC itself is always mandatory — the level controls how failures are handled.

### What "Done" Looks Like for This Recommendation

- [ ] `.planning/config.json` includes `ac_enforcement`, `regression_check`, `regression_depth`, and `manual_signoff` fields
- [ ] `gsd:new-project` asks the user to select an enforcement level during workflow preferences
- [ ] The executor reads the config and adjusts behavior accordingly
- [ ] `execute-phase` conditionally runs regression checks based on config
- [ ] `verify-work` conditionally requires manual sign-off based on config
- [ ] Each enforcement level has clearly documented behavior differences

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/workflows/new-project.md` | Modify | Add AC enforcement question to workflow preferences step |
| `gsd/templates/config.json` | Modify | Add enforcement-related config fields with defaults |
| `agents/gsd-executor.md` | Modify | Read config to determine enforcement behavior |
| `gsd/workflows/execute-phase.md` | Modify | Conditional regression check based on config |
| `gsd/workflows/verify-work.md` | Modify | Conditional manual sign-off based on config |

### Behavior Specification

**Enforcement levels:**

AC is mandatory in GSD — every phase requires acceptance criteria. The enforcement level controls how strictly failures are handled, not whether AC exists. There is no "none" level.

| Level | Must Pass | Should Pass | Fix Loop | Regression | Manual Sign-Off |
|-------|-----------|-------------|----------|------------|----------------|
| `"light"` | Verified but failures are warnings, not blockers | Logged only | No | No | No |
| `"standard"` | Blocks completion; 3-attempt fix loop | Warns | No fix loop | Optional (config) | Optional (config) |
| `"strict"` | Blocks completion; 3-attempt fix loop | 1-attempt fix loop | Yes (all phases) | Yes (required) | Yes (required) |

**Config fields:**

```json
{
  "workflow": {
    "ac_enforcement": "standard",
    "regression_check": false,
    "regression_depth": "all",
    "manual_signoff": false
  }
}
```

- `ac_enforcement` — overall level (light / standard / strict)
- `regression_check` — explicit toggle for regression checks (overrides level default)
- `regression_depth` — "all" or "last-N" for how many prior phases to regression-test
- `manual_signoff` — explicit toggle for manual AC sign-off (overrides level default)

**New-project prompt:**

```
Acceptance Criteria Enforcement:
  AC is always required. How strictly should failures be handled?

  1. Standard (Recommended) — Must Pass criteria block completion, fix loop on failure
  2. Light — Verify but log failures as warnings — for experiments and prototypes
  3. Strict — Full enforcement with regression checks and manual sign-off
```

**How consumers read the config:**

Each workflow/agent reads `config.json` during initialization and adjusts behavior:
- Executor: determines whether to enter fix loops, how many attempts, whether to run regression
- Verify-work: determines whether manual sign-off is required
- Define-ac: always runs — enforcement level affects how results are handled downstream, not whether AC is defined

### Constraints

- Default enforcement level is "standard" — the current behavior is the default
- Config can be changed mid-project (but changing from strict → light should warn about implications)
- AC is always mandatory — there is no "none" enforcement level. The minimum is "light" (verify and log).
- The three levels should be documented in a reference file so LLMs understand the behavioral differences
- Individual overrides (`regression_check`, `manual_signoff`) take precedence over the level's default

---

## Implementation Dependencies

```
#3 Traceability ─────► Depends on: existing artifact structure (REQUIREMENTS, AC, PLAN, SUMMARY, VERIFICATION)
                       Enhanced by: P0 #1 (Project DoD) — adds DONE criteria to project-wide view
                       No modification of other recommendations needed

#6 Change Management ► Depends on: existing define-ac update mode
                       Enhanced by: P1 #7 (Negotiation Log) — change reasons are captured consistently
                       No modification of other recommendations needed

#10 Config Levels ───► Depends on: P1 #4 (Regression) — regression_check config needs regression feature
                       Depends on: P0 #5 (Manual Sign-Off) — manual_signoff config needs sign-off feature
                       Ties together P0 and P1 features under a single config umbrella
```

**Recommended implementation order within P2:** #6 → #3 → #10

- #6 (Change Management) is a targeted addition to the existing `define-ac` update flow
- #3 (Traceability) is a new command — more work but no risk to existing workflows
- #10 (Config) should go last because it wraps P0 (#5 Manual Sign-Off) and P1 (#4 Regression) features under config toggles — those features should be working first

---

## What This Document Does NOT Cover

- **How to implement these changes** — That's the planner's job. This document defines WHAT and WHY.
- **Code-level details** — The planner will determine exact edits to workflow markdown, command files, and agent instructions.
- **Testing strategy** — The planner should define how to verify these changes work correctly.
- **P0/P1 implementation details** — Those are covered in their own documents. This document assumes P0 and P1 are complete.
