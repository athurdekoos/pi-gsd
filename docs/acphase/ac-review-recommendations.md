# AC Implementation Review — Gaps & Recommendations

> **Source:** Structural review of `my-recommendation-for-ac.md` against GSD's established patterns  
> **Date:** 2026-03-06  
> **Status:** Ready to apply  
> **Applies to:** `my-recommendation-for-ac.md` (Strategy 2 implementation plan)

---

## Summary

The AC implementation plan is ~90% structurally aligned with GSD. Six gaps were identified by comparing against the patterns used by `discuss-phase`, `plan-phase`, `new-project`, and their supporting infrastructure. Each gap below includes the problem, the GSD precedent it violates, and the concrete fix.

---

## Gap 1: Missing Reference File — `gsd/references/ac-patterns.md`

### Problem

GSD separates **templates** (output file schema) from **references** (LLM guidance for doing the work). Currently, `gsd/templates/ac.md` is doing double duty — it contains both the AC.md output schema AND the guidance for writing good AC (anti-patterns, tier heuristics, domain examples).

### GSD Precedent

| Workflow | Template (output schema) | Reference (LLM guidance) |
|----------|-------------------------|--------------------------|
| `discuss-phase` | `templates/context.md` | `references/questioning.md` |
| `verify-phase` | `templates/verification-report.md` | `references/verification-patterns.md` |
| `plan-phase` | `templates/planner-subagent-prompt.md` | `references/planning-config.md` |
| **`define-ac`** | `templates/ac.md` | ⚠️ **MISSING** |

### Fix

Create `gsd/references/ac-patterns.md` containing:

```markdown
# Acceptance Criteria Patterns

Reference for the LLM during `/gsd:define-ac`. Guidance for converting user intent
into testable, tiered acceptance criteria.

## Converting Vague Statements to GIVEN/WHEN/THEN

| User says | Bad AC | Good AC |
|-----------|--------|---------|
| "Tasks should work" | AC: Tasks work correctly | GIVEN a user is logged in, WHEN they create a task with title "Test", THEN a task appears in the list with status "todo" |
| "The UI should be responsive" | AC: UI is responsive | GIVEN the browser width is < 768px, WHEN user views the task list, THEN tasks stack vertically with no horizontal scroll |
| "Good error handling" | AC: Errors are handled well | GIVEN the API is unreachable, WHEN user tries to create a task, THEN an error toast appears with message "Unable to save. Check your connection." |

## Anti-Patterns

### Untestable criteria
- ❌ "The app should be fast" — no threshold, no measurement
- ✅ "GIVEN 100 tasks exist, WHEN user loads the task list, THEN all tasks render within 2 seconds"

### Implementation-prescriptive criteria
- ❌ "Use React.memo on TaskCard component" — that's a HOW, not a WHAT
- ✅ "GIVEN 50 tasks in the list, WHEN user edits one task's title, THEN only that task re-renders (no full list flash)"

### Duplicate coverage
- ❌ AC-01 and AC-04 both test "task creation works" with slightly different wording
- ✅ Each AC tests a distinct observable behavior

### Over-specification
- ❌ 15 Must Pass criteria for a 2-plan phase — too many to be meaningful
- ✅ 3-5 Must Pass for a typical phase, more for complex phases

## Tier Assignment Heuristics

```
Is it a core requirement from REQUIREMENTS.md?
  YES → Must Pass

Does it protect against data loss or corruption?
  YES → Must Pass

Is it an edge case of a Must Pass behavior?
  YES → Should Pass

Is it error handling for a non-critical path?
  YES → Should Pass

Is it visual polish, keyboard shortcuts, or animations?
  YES → Nice to Have

Is it a performance optimization (not a hard requirement)?
  YES → Nice to Have (unless there's a specific threshold in requirements)
```

## Domain-Specific Patterns

### Web Applications
- Must Pass: CRUD operations, data persistence, navigation, auth gates
- Should Pass: Validation messages, empty states, loading states, error recovery
- Nice to Have: Keyboard shortcuts, animations, responsive breakpoints, dark mode

### CLI Tools
- Must Pass: Primary command produces expected output, exit codes are correct, flags work
- Should Pass: Help text is accurate, error messages are actionable, config file is read
- Nice to Have: Progress bars, color output, shell completions, verbose mode

### APIs
- Must Pass: Endpoints return correct status codes and response shapes, auth works
- Should Pass: Validation errors return 400 with descriptive messages, rate limiting works
- Nice to Have: Response time headers, pagination metadata, CORS headers

### Data Pipelines
- Must Pass: Input → output transformation is correct, idempotent reruns produce same result
- Should Pass: Malformed input is rejected with clear error, partial failures don't corrupt state
- Nice to Have: Progress logging, dry-run mode, output format options

## Verify Command Patterns

### Prefer concrete bash commands
```bash
# Good — specific and automatable
curl -s -X POST localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"test"}' \
  -o /dev/null -w '%{http_code}' | grep 201

# Good — test runner with filter
npm test -- --grep "AC-01"

# Good — database check
sqlite3 dev.db "SELECT count(*) FROM tasks WHERE status='todo'" | grep -q '^[1-9]'
```

### Use manual when automation isn't practical
```
manual — Open app in browser, drag Task B above Task A, refresh page, verify order persists
manual — Open app on mobile viewport (375px), verify task cards stack vertically
manual — Click "New Task", leave title empty, submit, verify red validation error appears
```

### Never use vague verify commands
```bash
# Bad
echo "check that it works"

# Bad
# just run the app and see

# Bad
npm test  # (runs ALL tests, not specific to this AC)
```
```

Then **slim down `gsd/templates/ac.md`** to contain only:
- The AC.md frontmatter schema
- The file structure (Must Pass / Should Pass / Nice to Have sections)
- The GIVEN/WHEN/THEN format per AC entry
- One brief example per tier

Move the "Guidelines", "Examples by Domain", and anti-pattern guidance into the reference file.

### File Inventory Update

Add to the "New Files" table in `my-recommendation-for-ac.md`:

| File | Plan | Purpose |
|------|------|---------|
| `gsd/references/ac-patterns.md` | 2.1 (parallel) | LLM guidance for writing good AC — anti-patterns, tier heuristics, domain patterns, verify command patterns |

Update the command file (`commands/gsd/define-ac.md`) execution_context to include:

```xml
<execution_context>
@~/.claude/get-shit-done/workflows/define-ac.md
@~/.claude/get-shit-done/templates/ac.md
@~/.claude/get-shit-done/references/ac-patterns.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>
```

---

## Gap 2: Missing Auto-Mode Branches in Review Steps

### Problem

Plan 3's workflow defines three review steps (`review_must_pass`, `review_should_pass`, `review_nice_to_have`) that are interactive loops. But when `--auto` is passed, these loops should be skipped entirely. The current workflow only mentions auto-mode in the final `auto_advance` step (Task 7.2 says "auto-mode skips per-tier review loops") but doesn't show the conditional branches inside each review step.

### GSD Precedent

`gsd/workflows/new-project.md` has explicit auto-mode conditionals inside interactive steps:

```
# In new-project.md, questioning phase:
If --auto: Skip deep questioning, use the user's initial description as-is
If interactive: Ask 4+ questions, loop until user says "ready"
```

`gsd/workflows/discuss-phase.md` has the same pattern for gray area selection.

### Fix

Add auto-mode conditionals to three steps in the `define-ac.md` workflow:

**Step `review_must_pass`:**
```markdown
<step name="review_must_pass">
**If --auto:** Accept all LLM-proposed Must Pass criteria without interactive review.
  AC is still generated and written to AC.md — auto-mode skips the review loop,
  not the AC itself. Skip to next step.

**If interactive:**
Present Must Pass tier:
  [... existing interactive logic ...]
</step>
```

**Step `review_should_pass`:**
```markdown
<step name="review_should_pass">
**If --auto:** Accept all LLM-proposed Should Pass criteria without interactive review.
  Criteria are still generated and saved. Skip to next step.

**If interactive:**
  [... existing interactive logic ...]
</step>
```

**Step `review_nice_to_have`:**
```markdown
<step name="review_nice_to_have">
**If --auto:** Accept all LLM-proposed Nice to Have criteria without interactive review.
  Criteria are still generated and saved. Skip to next step.

**If interactive:**
  [... existing interactive logic ...]
</step>
```

**Step `offer_test_stubs`:**
```markdown
<step name="offer_test_stubs">
**If --auto:** Skip test stub generation (AC.md is still created — only stubs are skipped).

**If interactive:**
  [... existing logic ...]
</step>
```

**Key principle:** Auto-mode accelerates AC definition by skipping interactive review loops, but it **never skips AC itself**. AC.md is always created and always gates planning.

---

## Gap 3: Missing Design Note — Why No Sub-Agent

### Problem

GSD uses sub-agents for delegation workflows (`gsd-planner`, `gsd-verifier`, `gsd-executor`, etc.) but conversation workflows (`discuss-phase`) don't spawn sub-agents. The AC workflow is a conversation workflow, so not having a sub-agent is architecturally correct — but this decision isn't documented anywhere in the recommendation.

A reader might wonder: "Why doesn't define-ac have a `gsd-ac-definer` agent like plan-phase has `gsd-planner`?"

### GSD Precedent

| Workflow | Type | Sub-agents | Why |
|----------|------|------------|-----|
| `new-project` | Delegation | 6 (researchers, synthesizer, roadmapper) | Research and roadmap creation are isolated tasks |
| `plan-phase` | Delegation | 3 (researcher, planner, plan-checker) | Planning is complex enough to need a focused agent |
| `execute-phase` | Delegation | 1-N (executor per plan) | Execution needs full context window per plan |
| `discuss-phase` | **Conversation** | **0** | The user IS the primary source — no delegation needed |
| `define-ac` | **Conversation** | **0** | The user IS the primary author — no delegation needed |

### Fix

Add an "Architecture Decisions" section to `my-recommendation-for-ac.md`, after the Architecture Overview and before Plan 1:

```markdown
## Architecture Decisions

### Why No Sub-Agent

`/gsd:define-ac` is a **conversation workflow** (like `discuss-phase`), not a
**delegation workflow** (like `plan-phase`). The distinction:

- **Conversation workflows** have the LLM interact directly with the user to
  capture decisions. The user is the primary source of truth. No sub-agent needed.
  Examples: `discuss-phase`, `define-ac`.

- **Delegation workflows** have the orchestrator LLM spawn sub-agents to perform
  focused tasks in isolated context windows. The sub-agent is the primary worker.
  Examples: `plan-phase` (spawns `gsd-planner`), `execute-phase` (spawns `gsd-executor`).

`define-ac` doesn't need a `gsd-ac-definer` agent because:
1. The user defines the acceptance criteria, not the AI
2. The LLM's role is to propose, structure, and capture — not to perform isolated work
3. The conversation requires back-and-forth with the user (sub-agents can't do this)
4. The output (AC.md) is small enough to fit in the orchestrator's context

### Why a Separate File (AC.md) Instead of a CONTEXT.md Section

This was decided in `possible_ac_for_gsd.md` (Strategy 2 over Strategy 1):
- **Separation of concerns** — CONTEXT.md captures HOW decisions, AC.md captures WHAT tests
- **Independent iteration** — user can re-run `/gsd:define-ac` without re-running discuss-phase
- **Clean downstream consumption** — planner, executor, verifier each read AC.md directly
- **Backward compatibility** — existing infrastructure (gsd-tools, init commands) extends naturally to support AC.md detection

### Why `init phase-op` (Not a New Init Command)

`define-ac` reuses `gsd-tools init phase-op` (the same init command used by `discuss-phase`)
rather than adding a new `init define-ac` subcommand. Rationale:
- `init phase-op` already returns everything define-ac needs: phase directory, existing
  artifacts, config, file paths
- Plans 1.1-1.4 add `has_ac` and `ac_path` to the existing init commands
- Adding a new init subcommand would duplicate logic without benefit
```

---

## Gap 4: Missing Consistency Check — AC vs CONTEXT.md Conflicts

### Problem

The workflow loads CONTEXT.md decisions (step `load_context`) and generates AC proposals (step `generate_proposals`), but never checks whether the proposed AC contradicts locked decisions in CONTEXT.md.

Example conflict:
- CONTEXT.md: *"Manual drag-and-drop ordering decided"*
- LLM proposes AC-05: *"GIVEN tasks exist, WHEN user opens the list, THEN tasks are auto-sorted by priority"*

This would pass review (user might not catch the contradiction), then the executor would try to implement auto-sorting, which contradicts the context.

### GSD Precedent

`gsd-planner` has a `<context_fidelity>` section that enforces CONTEXT.md decisions:

```markdown
<context_fidelity>
When CONTEXT.md says "X was decided", the plan MUST implement X.
Do NOT substitute your own judgment for explicit user decisions.
</context_fidelity>
```

The AC workflow needs an equivalent check.

### Fix

Add a new step between `load_context` and `generate_proposals` in the `define-ac.md` workflow:

```markdown
<step name="consistency_check">
Before generating AC proposals, cross-reference the phase goal and requirements
against locked decisions in CONTEXT.md (if it exists).

For each proposed AC, verify:
1. The AC's THEN clause does not contradict a CONTEXT.md decision
2. The AC's GIVEN/WHEN scenario is compatible with the implementation approach in CONTEXT.md
3. If CONTEXT.md says "Claude's Discretion" for an area, AC may define expectations
   for that area (this is fine — the user is now specifying what they want)

**If a contradiction is detected during proposal generation:**
Flag it inline:

  ⚠ AC-05 may conflict with a CONTEXT.md decision:
    - CONTEXT.md: "Manual drag-and-drop ordering"
    - AC-05 THEN: "Tasks are auto-sorted by priority"
  
  Options:
    1. Keep AC-05 — this supersedes the CONTEXT.md decision (AC.md will be updated)
    2. Revise AC-05 — adjust to match CONTEXT.md
    3. Drop AC-05 — remove this criterion

**If the user chooses to supersede:**
Note in AC.md frontmatter:

  ```yaml
  supersedes:
    - context_decision: "Manual drag-and-drop ordering"
      replaced_by: AC-05
      reason: "User changed preference during AC definition"
  ```

This provides traceability — the planner will see that AC-05 overrides an earlier decision.
</step>
```

Also add a quality gate to the `generate_proposals` step:

```markdown
**Self-check before presenting proposals:**
- [ ] No Must Pass AC contradicts a CONTEXT.md decision (unless flagged)
- [ ] Each AC maps to at least one REQ-ID or ROADMAP success criterion
- [ ] No two ACs test the same behavior with different wording
```

---

## Gap 5: Commit to Step-by-Step Documentation

### Problem

The `docs/acphase/` directory has excellent step-by-step walkthroughs for `new-project` and `discuss-phase` that explain who does what at each stage (User, LLM, Pi, gsd-tools). The recommendation should commit to creating `docs/acphase/defineac-step-by-step.md` as a required deliverable — AC is mandatory, so users need clear documentation on what happens when they run it.

### GSD Precedent

```
docs/acphase/
├── newproject-step-by-step.md      ← exists, detailed
├── discussphase-step-by-step.md    ← exists, detailed
├── my-recommendation-for-ac.md     ← exists, implementation plan
├── possible_ac_for_gsd.md          ← exists, strategy comparison
└── defineac-step-by-step.md        ← SHOULD EXIST
```

### Fix

Add `docs/acphase/defineac-step-by-step.md` to the File Inventory as a committed deliverable (not optional). Structure it identically to the existing step-by-step docs:

```markdown
# `/gsd:define-ac` — Step-by-Step Walkthrough

> What actually happens between the **User**, the **AI (LLM)**, and the
> **Pi Coding Agent** when you type `/gsd:define-ac 1` and press Enter.

## Table of Contents
- [Overview](#overview)
- [The Players](#the-players)
- [Phase 1: Command Invocation](#phase-1-command-invocation)
- [Phase 2: LLM Reads Referenced Files](#phase-2-llm-reads-referenced-files)
- [Phase 3: Initialize — gsd-tools init phase-op](#phase-3-initialize)
- [Phase 4: Check for Existing AC](#phase-4-check-existing-ac)
- [Phase 5: Load Context](#phase-5-load-context)
- [Phase 6: Consistency Check](#phase-6-consistency-check)
- [Phase 7: Generate Proposals](#phase-7-generate-proposals)
- [Phase 8: Review Must Pass](#phase-8-review-must-pass)
- [Phase 9: Review Should Pass](#phase-9-review-should-pass)
- [Phase 10: Review Nice to Have](#phase-10-review-nice-to-have)
- [Phase 11: Offer Test Stubs](#phase-11-offer-test-stubs)
- [Phase 12: Write AC.md](#phase-12-write-ac)
- [Phase 13: Commit & Update State](#phase-13-commit-update-state)
- [Phase 14: Auto-Advance or Next Steps](#phase-14-auto-advance)
- [Summary: Who Does What](#summary-who-does-what)
- [Artifacts Created](#artifacts-created)

## Overview
[Follow the pattern from discussphase-step-by-step.md]

## The Players
| Player | What It Is | Role in This Flow |
|--------|-----------|-------------------|
| **User** | The human | Defines what "done" means — reviews, edits, promotes/demotes AC tiers |
| **Pi Coding Agent** | The TUI runtime | Transforms command, routes messages, executes tools |
| **AI (LLM)** | Claude | Proposes AC from context, structures GIVEN/WHEN/THEN, writes AC.md |
| **gsd-tools.cjs** | CLI utility | Initializes phase context, commits files, updates STATE.md |

[... continue for each phase ...]
```

Update the File Inventory in `my-recommendation-for-ac.md`:

| File | Plan | Purpose |
|------|------|---------|
| `docs/acphase/defineac-step-by-step.md` | Post-implementation | Step-by-step walkthrough of `/gsd:define-ac` matching existing doc pattern |

---

## Gap 6: Explicit `init phase-op` Reuse Statement

### Problem

Plan 1 adds `has_ac` and `ac_path` to three existing init commands but never explicitly states that `define-ac` itself uses `init phase-op`. A reader has to infer this from the workflow's `initialize` step.

### Fix

Already addressed in Gap 3's "Architecture Decisions" section (the "Why `init phase-op`" subsection). No additional file changes needed beyond what Gap 3 proposes.

---

## Updated File Inventory (Complete)

### New Files (6 — was 4)

| File | Plan/Gap | Purpose |
|------|----------|---------|
| `gsd/templates/ac.md` | Plan 2.1 | AC.md output schema (slimmed — guidance moved to reference) |
| `gsd/references/ac-patterns.md` | **Gap 1** | LLM guidance — anti-patterns, tier heuristics, domain patterns, verify commands |
| `commands/gsd/define-ac.md` | Plan 2.2 | `/gsd:define-ac` command entry point |
| `gsd/workflows/define-ac.md` | Plan 3.1 | Full workflow with auto-mode branches and consistency check |
| `docs/acphase/defineac-step-by-step.md` | **Gap 5** | Step-by-step walkthrough for documentation |
| `docs/acphase/ac-review-recommendations.md` | — | This document |

### Modified Files (9 — unchanged)

| File | Plan | Change Summary |
|------|------|----------------|
| `gsd/bin/lib/core.cjs` | 1.1 | Add `has_ac` detection |
| `gsd/bin/lib/init.cjs` | 1.2-1.4 | Add `has_ac` + `ac_path` to 3 init commands |
| `gsd/workflows/plan-phase.md` | 4.1, 4.3 | AC hard gate + coverage check |
| `agents/gsd-planner.md` | 4.2 | `<ac_fidelity>` section |
| `agents/gsd-executor.md` | 5.1 | `<ac_verification>` section |
| `gsd/workflows/execute-phase.md` | 5.2 | AC.md in executor reads + status update |
| `agents/gsd-verifier.md` | 6.2 | `<ac_awareness>` section |
| `gsd/workflows/verify-phase.md` | 6.1 | AC.md as primary verification source |
| `gsd/workflows/verify-work.md` | 6.3 | AC.md as primary UAT test source |
| `gsd/workflows/discuss-phase.md` | 7.1 | Auto-advance → define-ac; next-steps updated |

---

## Updated Verification Checklist (Additions)

Add these to the existing verification checklist in `my-recommendation-for-ac.md`:

### Reference File
- [ ] `gsd/references/ac-patterns.md` exists and is listed in the command's execution_context
- [ ] `gsd/templates/ac.md` contains only schema/structure (guidance moved to reference)
- [ ] Command file references 4 files: workflow, template, reference, ui-brand

### Auto-Mode
- [ ] `/gsd:define-ac 1 --auto` generates AC and skips interactive review loops (AC is still created)
- [ ] `/gsd:define-ac 1 --auto` skips test stub generation (AC.md is still written)
- [ ] Auto-mode AC is committed with `status: auto-approved` in frontmatter
- [ ] Full auto chain (discuss → define-ac → plan → execute) runs with `--auto` — AC is always generated, never skipped

### Consistency Check
- [ ] AC proposals are checked against CONTEXT.md decisions
- [ ] Contradictions are flagged with options (keep/revise/drop)
- [ ] Superseded decisions are recorded in AC.md frontmatter

### Documentation
- [ ] `docs/acphase/defineac-step-by-step.md` covers all phases
- [ ] Step-by-step doc follows the same format as `discussphase-step-by-step.md`
- [ ] Architecture decisions section explains no-sub-agent, separate file, init reuse

---

## Application Order

Apply these gaps to `my-recommendation-for-ac.md` in this order:

1. **Gap 3** — Add "Architecture Decisions" section (context for everything else)
2. **Gap 1** — Add `references/ac-patterns.md`, slim down template, update command file
3. **Gap 4** — Add `consistency_check` step to workflow
4. **Gap 2** — Add auto-mode branches to review steps
5. **Gap 6** — Already covered by Gap 3
6. **Gap 5** — Create step-by-step doc outline (can be written after implementation)
