# P3 — Polish: Risk-Weighted AC Within Tiers

> **Priority:** P3 — Adds signal to the planner but doesn't block any workflow.  
> **Recommendations:** #8 (Risk Weighting)  
> **Audience:** Implementer tasked with modifying GSD templates, references, and agent instructions  
> **Source:** [PM Recommendations for AC](pm-recommendations-for-ac.md)  
> **Depends on:** P0, P1, and P2 should be implemented first. This is a polish enhancement.

---

## Why P3

P0-P2 build a complete AC governance system: definition, readiness gates, enforcement, regression checking, traceability, change management, and configurable rigor. P3 adds **nuance within tiers** — not all Must Pass criteria carry equal risk. This is a refinement, not a requirement. The system works without it, but it works smarter with it.

---

## Recommendation #8: Risk-Weighted AC

### Problem

All Must Pass criteria are treated equally by the planner and executor. But from a PM perspective, some carry significantly more implementation risk than others:

| AC | Description | Risk |
|----|------------|------|
| AC-01 | Create a task (CRUD insert) | Low — straightforward database operation |
| AC-02 | Drag-and-drop reorder persists after refresh | High — complex state sync between UI ordering, database persistence, and real-time updates |
| AC-03 | Delete confirmation modal appears | Low — standard UI pattern |
| AC-04 | Concurrent edits don't corrupt data | High — race condition handling, optimistic locking |

Without risk awareness, the planner might schedule AC-02 and AC-04 in the last wave. If they fail, the entire phase is blocked at the end with the hardest problems and no time to iterate. A PM would front-load high-risk items to surface failures early.

### Goal

Add an **optional `Risk:` field** to AC entries. Risk values are `low`, `medium` (default), or `high`. The risk level serves as a signal to the planner for execution ordering and to the reviewer for attention prioritization. It does NOT change enforcement behavior — a low-risk Must Pass and a high-risk Must Pass are both equally mandatory.

### What "Done" Looks Like for This Recommendation

- [ ] AC template includes an optional `Risk:` field with values: low, medium, high
- [ ] Default risk is `medium` when not specified (backward compatible — existing AC files don't break)
- [ ] `gsd:define-ac` proposes risk levels for each AC during the definition flow
- [ ] User can override proposed risk levels during review
- [ ] The planner is instructed to schedule high-risk AC in earlier waves/plans
- [ ] The traceability view (Rec #3) highlights high-risk AC for reviewer attention
- [ ] Risk weighting does NOT affect enforcement — it affects ordering and attention only

### Files Involved

| File | Action | Purpose |
|------|--------|---------|
| `gsd/templates/ac.md` | Modify | Add optional `Risk:` field to AC entry format with guidance |
| `gsd/references/ac-patterns.md` | Modify | Add risk assessment guidance — what makes an AC high/medium/low risk |
| `agents/gsd-planner.md` | Modify | In `<ac_fidelity>` or planning instructions, note that high-risk AC should be in earlier waves |
| `gsd/workflows/define-ac.md` | Modify | Add risk proposal during AC generation; allow user override during review |

### Behavior Specification

**AC entry format with risk:**

```markdown
### AC-02: Drag-and-drop ordering persists
- **GIVEN:** Multiple tasks exist in a project
- **WHEN:** User drags task B above task A and refreshes
- **THEN:** The new order persists
- **Verify:** `manual — drag task, refresh, verify order`
- **Requirement:** TASK-03
- **Risk:** high — complex state sync between UI and database
```

The `Risk:` line is optional. Format: `Risk: <level>` optionally followed by `—` and a brief rationale.

**Risk level definitions:**

| Level | Characteristics | Examples |
|-------|----------------|---------|
| `low` | Straightforward implementation; well-understood pattern; minimal integration points | CRUD operations, static UI, simple validation |
| `medium` | Standard complexity; some integration; known patterns but requires care | API endpoints with auth, form workflows, basic state management |
| `high` | Complex integration; novel patterns; race conditions; third-party dependencies; performance-sensitive | Real-time sync, concurrent editing, complex state machines, external API dependencies, performance thresholds |

**How `define-ac` proposes risk:**

During AC generation, the LLM assesses each criterion against the risk characteristics above and proposes a level. During user review, risk levels are shown alongside each AC:

```
Must Pass:
  AC-01: Create a task via form submission                    Risk: low
  AC-02: Drag-and-drop reorder persists after refresh         Risk: high
  AC-03: Delete task shows confirmation, actually deletes     Risk: low
```

The user can override: "Move AC-02 to medium" or "AC-03 should be high — our modal component is buggy."

**How the planner uses risk:**

In the planner's AC fidelity instructions, add guidance:

> When organizing tasks into waves/plans, schedule high-risk AC in earlier waves. This ensures that the hardest problems are attempted first and failures surface early — giving the executor more room to iterate. If a plan has both high-risk and low-risk AC, the high-risk AC's tasks should come first within the plan.

**How traceability uses risk (ties to Rec #3):**

In the traceability matrix, high-risk AC can be flagged:

```
REQ-ID    │ AC-ID  │ Tier       │ Risk │ Plan  │ Verified │ Status
──────────┼────────┼────────────┼──────┼───────┼──────────┼────────
SOCL-04   │ AC-01  │ Must Pass  │ low  │ 03-01 │ ✓ PASS   │ ✅ Done
SOCL-04   │ AC-02  │ Must Pass  │ HIGH │ 03-01 │ ✓ PASS   │ ✅ Done
CONT-05   │ AC-04  │ Must Pass  │ HIGH │ 03-02 │ ✗ FAIL   │ ❌ Failed
```

High-risk items displayed in uppercase or with emphasis so reviewers focus attention there.

### Risk Assessment Guidance (for ac-patterns.md)

Add a section to the AC patterns reference that helps the LLM (and user) assess risk:

```markdown
## Risk Assessment

When assigning risk to an AC, consider:

**Technical complexity**
- How many systems/components are involved?
- Are there race conditions, concurrency, or ordering concerns?
- Does it require a pattern the team hasn't implemented before?

**Integration surface**
- How many APIs, services, or data stores does it touch?
- Are there third-party dependencies with their own failure modes?
- Does it cross the frontend/backend boundary in complex ways?

**Verification difficulty**
- Can the verify command reliably test this criterion?
- Is the test deterministic or could it flake?
- Does verification require specific timing, data state, or user interaction?

**Blast radius if wrong**
- If this criterion fails in production, what breaks?
- Does it affect data integrity, security, or user trust?
- Can a failure here cascade to other features?

Score: If 0-1 factors apply → low. If 2 factors → medium. If 3+ factors → high.
```

### Constraints

- Risk is optional and defaults to `medium` — existing AC.md files without Risk fields continue to work
- Risk does NOT change enforcement — a low-risk Must Pass is still Must Pass
- Risk does NOT change the fix-loop attempt count — all Must Pass get the same number of attempts
- The rationale after `—` is optional but encouraged (helps future readers understand the assessment)
- Risk can be changed during AC updates without triggering the full change management protocol (Rec #6) since it's metadata, not a criterion change

---

## Implementation Dependencies

```
#8 Risk Weighting ───► Independent of P0/P1/P2 structurally — can be added at any time
                       Enhanced by: P2 #3 (Traceability) — risk column in matrix
                       Enhanced by: planner already having AC fidelity instructions
                       No other recommendation needs to be modified
```

This is a standalone enhancement. It touches 4 files with small additions to each. The primary value is in the planner instruction update (schedule high-risk early) and the define-ac proposal flow (surface risk during AC creation).

---

## What This Document Does NOT Cover

- **How to implement these changes** — That's the planner's job. This document defines WHAT and WHY.
- **Code-level details** — The planner will determine exact edits to templates, references, and agent instructions.
- **Testing strategy** — The planner should define how to verify the risk field works correctly across the workflow chain.
- **Quantitative risk scoring** — This recommendation uses qualitative levels (low/medium/high). A future enhancement could add numeric scores or weighted formulas, but that's beyond current scope.
