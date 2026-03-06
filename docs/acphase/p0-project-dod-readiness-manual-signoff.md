# P0 — Do First: Project DoD, Definition of Ready, Manual Sign-Off

> **Priority:** P0 — These close the biggest alignment gaps. Without them, AC is incomplete.  
> **Recommendations:** #1 (Project DoD), #2 (Definition of Ready), #5 (Manual Sign-Off)  
> **Audience:** Implementer tasked with modifying GSD workflows, templates, and references  
> **Source:** [PM Recommendations for AC](pm-recommendations-for-ac.md)

---

## Why P0

These three recommendations address the most fundamental gaps in the AC system:

1. **No project-level "done"** — Phase AC can all pass while the project misses the mark
2. **No formalized readiness gates** — Workflows start without prerequisites being met
3. **Manual AC are never enforced** — Must Pass criteria with `Verify: manual` are written but never checked

Without these, the AC system is structurally incomplete. Fix these first before investing in regression checks, traceability views, or configuration options.

---

## Recommendation #1: Project-Level Definition of Done

### Problem

`gsd:new-project` creates PROJECT.md, REQUIREMENTS.md, and ROADMAP.md — but none capture what "project done" looks like from the user's perspective. The roadmap's success criteria are AI-authored. Requirements are checkboxes, not testable assertions. The user never explicitly states: *"The project is done when these 3-5 things are true."*

Phase-level AC can drift. Each phase might pass its own AC while the overall project misses the mark — the parts work but the whole doesn't.

### Goal

Add a **"Definition of Done" step** to `gsd:new-project` (between requirements approval and roadmap creation) where the user defines 3-5 project-level done criteria. These criteria become the ultimate acceptance test — phase-level AC should trace back to one or more of them.

### What "Done" Looks Like for This Recommendation

- [ ] `gsd:new-project` includes a new step (7.5) between requirements and roadmap where the user reviews, edits, and approves project-level DONE criteria
- [ ] The LLM proposes 3-5 DONE criteria derived from PROJECT.md core value and REQUIREMENTS.md
- [ ] Approved DONE criteria are written to a `## Definition of Done` section in REQUIREMENTS.md with checkable DONE-IDs (DONE-01, DONE-02, etc.)
- [ ] `gsd:define-ac` loads DONE criteria during its `load_context` step and cross-references phase AC against them
- [ ] DONE criteria are surfaced during final-phase UAT as the ultimate exit gate

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/workflows/new-project.md` | Modify | Add Step 7.5 — Definition of Done between requirements approval and roadmap creation |
| `gsd/templates/requirements.md` | Modify | Add `## Definition of Done` section template with DONE-ID format |
| `gsd/workflows/define-ac.md` | Modify | Load DONE criteria during `load_context`; cross-reference phase AC against project DONE-IDs |

### Behavior Specification

**Step 7.5 flow:**

1. After requirements are approved, display a header: `GSD ► DEFINITION OF DONE`
2. Explain the concept: "You've defined WHAT to build. Now define WHEN it's done."
3. LLM proposes 3-5 DONE criteria derived from PROJECT.md core value + REQUIREMENTS.md content
4. User reviews: can edit wording, add new criteria, remove proposed ones
5. Approved list is written to REQUIREMENTS.md under `## Definition of Done`

**DONE criteria format in REQUIREMENTS.md:**

```markdown
## Definition of Done

The project is complete when ALL of these are true:

- [ ] **DONE-01**: [User-approved criterion]
- [ ] **DONE-02**: [User-approved criterion]
- [ ] **DONE-03**: [User-approved criterion]

These are the ultimate acceptance criteria. Phase-level AC should trace back to one or more of these.
```

**Downstream consumers:**

| Consumer | How It Uses Project DONE |
|----------|------------------------|
| `gsd-roadmapper` | Maps each DONE-ID to phases — ensures coverage |
| `define-ac` | Cross-references phase AC against project DONE — flags gaps |
| `verify-work` (final phase) | Tests project-level DONE criteria after last phase |
| `complete-milestone` | Checks DONE criteria as milestone exit gate |

### Constraints

- DONE criteria must be user-approved, not silently AI-generated
- Keep to 3-5 criteria — this is the "elevator pitch" for done, not a requirements repeat
- DONE criteria should be testable assertions, not vague goals ("users can X" not "good UX")

---

## Recommendation #2: Definition of Ready Checklists

### Problem

GSD has implicit readiness checks scattered across workflows — `plan-phase` warns when CONTEXT.md is missing, `execute-phase` errors when plans don't exist. But there's no formalized "Definition of Ready" (DoR) that a user or LLM can consult to know: *"Is this phase ready for the next step?"*

Workflows sometimes start without prerequisites being met, leading to wasted effort, incomplete context, or cascading failures.

### Goal

Create a centralized **Definition of Ready reference** that every workflow consults during its `initialize` step. Each workflow transition has an explicit checklist. If blockers exist, the workflow reports them clearly and refuses to proceed (or warns and asks for override).

### What "Done" Looks Like for This Recommendation

- [ ] A `gsd/references/definition-of-ready.md` file exists with formalized DoR checklists for each workflow transition
- [ ] Each workflow's `initialize` step evaluates the relevant DoR checklist
- [ ] Blockers are reported with clear, actionable messages (what's missing + how to fix it)
- [ ] Non-blocking warnings are distinguished from hard blockers
- [ ] Users can override warnings (with acknowledgment) but not hard blockers

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/references/definition-of-ready.md` | Create | Formalized DoR checklists for every workflow transition |
| `gsd/workflows/define-ac.md` | Modify | Check DoR during `initialize` step |
| `gsd/workflows/plan-phase.md` | Modify | Check DoR during `initialize` step |
| `gsd/workflows/execute-phase.md` | Modify | Check DoR during `initialize` step |
| Relevant command files | Modify | Add `references/definition-of-ready.md` to `execution_context` |

### Behavior Specification

**DoR checklists to formalize:**

| Transition | Key Checks |
|------------|-----------|
| Ready to Discuss (`gsd:discuss-phase`) | Phase exists in ROADMAP.md; prior phase complete or Phase 1; PROJECT.md exists |
| Ready to Define AC (`gsd:define-ac`) | CONTEXT.md exists (or explicit skip); ROADMAP.md success criteria exist; mapped REQ-IDs exist; no unresolved blockers |
| Ready to Plan (`gsd:plan-phase`) | AC.md exists (**required — no skip**); CONTEXT.md exists (or explicit skip); research complete or skipped; no in-progress plans from prior session |
| Ready to Execute (`gsd:execute-phase`) | At least one PLAN.md exists; plan checker passed (or override); AC mapped to tasks; no unresolved checkpoint; prior phase verification passed |
| Ready to Verify (`gsd:verify-work`) | All plans have SUMMARY.md; executor self-check passed; AC verify commands are runnable (environment up) |

**Readiness report format:**

```
GSD ► READINESS CHECK

Phase 3: Comments — Ready to Plan?

  ✓ AC.md exists (6 criteria: 3 must, 2 should, 1 nice)
  ✓ CONTEXT.md exists (decisions locked 2026-03-05)
  ✓ Research complete (RESEARCH.md from 2026-03-05)
  ✗ Prior phase verification not complete
    → Phase 2 has no VERIFICATION.md. Run /gsd:verify-work 2 first.

  Result: NOT READY — 1 blocker
```

### Constraints

- DoR checks should be fast — file existence and simple content checks, not deep analysis
- Each check must have a clear remediation message (what to do to fix it)
- Distinguish between hard blockers (can't proceed) and soft warnings (can override)

---

## Recommendation #5: Manual AC Sign-Off Protocol

### Problem

Many AC have `Verify: manual — [instructions]`. The executor marks these as `⏳ PENDING`. The verifier notes they can't be auto-verified. UAT may or may not cover the same checks. The phase completes with manual AC still PENDING forever.

Must Pass criteria with manual verify are aspirational — written but never enforced.

### Goal

Add a **Manual AC Sign-Off step** to `gsd:verify-work` (UAT) that explicitly walks the user through every unresolved manual AC before declaring the phase done. Each manual criterion gets a clear instruction and a user response. The criterion is then marked PASS or FAIL based on the user's answer.

### What "Done" Looks Like for This Recommendation

- [ ] `gsd:verify-work` includes a `manual_ac_resolution` step before `complete_session`
- [ ] The step finds all AC where: tier is Must Pass or Should Pass, verify is "manual", and result is PENDING
- [ ] Each manual AC is presented to the user with clear test instructions
- [ ] User responses are recorded: "yes"/"pass" → PASS, anything else → issue logged
- [ ] AC.md results are updated for each resolved criterion
- [ ] Phase cannot complete if any Must Pass manual AC remains unresolved

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/workflows/verify-work.md` | Modify | Add `manual_ac_resolution` step before `complete_session` |
| `gsd/templates/UAT.md` | Modify | Add manual AC sign-off section to template |

### Behavior Specification

**Manual sign-off flow:**

1. Before completing UAT, read AC.md for the current phase
2. Find all AC where tier is Must Pass or Should Pass, verify starts with "manual", and result in SUMMARY.md's AC table is "⏳ PENDING"
3. If any exist, display: `GSD ► MANUAL ACCEPTANCE SIGN-OFF`
4. For each pending manual AC:
   - Show the AC-ID, tier, description, and test instructions
   - Ask the user: "Does this work as expected?"
   - Record response: "yes"/"pass" = PASS; anything else = FAIL with user's comment
5. Update AC.md results for each resolved criterion
6. After all resolved, summarize: which passed, which failed
7. If any Must Pass manual AC FAILED → block phase completion (same as automated Must Pass failure)

**Example interaction:**

```
GSD ► MANUAL ACCEPTANCE SIGN-OFF

These acceptance criteria require your verification:

AC-03 (Should Pass): Empty title shows validation error
  → Open new task form, leave title empty, submit.
  → Expected: Red validation error appears, task not created.

Does this work as expected?
```

### Constraints

- Only walk through Must Pass and Should Pass manual AC — Nice to Have manual AC are logged but not blocking
- Keep instructions concise and actionable — the user should be able to test in under a minute per criterion
- If the user wants to skip (e.g., can't test right now), allow deferral with a warning that the AC remains PENDING
- Must Pass manual AC that remain PENDING after sign-off block phase completion

---

## Implementation Dependencies

```
#1 Project DoD ──────────────────────────────► Can be implemented independently
                                                (new-project + requirements template + define-ac)

#2 Definition of Ready ──────────────────────► Can be implemented independently
                                                (new reference file + workflow initialize steps)

#5 Manual Sign-Off ──────────────────────────► Can be implemented independently
                                                (verify-work workflow + UAT template)
```

All three P0 recommendations are independent of each other and can be implemented in parallel. However, implementing them in order (1 → 2 → 5) follows the natural workflow sequence: define done → check readiness → verify at the end.

---

## What This Document Does NOT Cover

- **How to implement these changes** — That's the planner's job. This document defines WHAT and WHY, not HOW.
- **Code-level details** — The workflow files are markdown-based instruction sets. The planner will determine the exact edits.
- **Testing strategy** — The planner should define how to verify these changes work correctly.
- **Interaction with P1/P2/P3 recommendations** — Each priority tier is self-contained. P1+ builds on P0 but doesn't require P0 changes to be modified later.
