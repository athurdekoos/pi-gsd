# Flow: Plan Phase → Execute Phase → Verify

> **Key Takeaways:**
> - Plan-phase: research → plan → plan-check verification loop (max iterations)
> - Execute-phase: discover plans → group into waves → parallel execution → verify
> - Plans within a wave can run in parallel; waves are sequential
> - Each executed plan produces a SUMMARY.md with commit hashes

## The Core Loop

```mermaid
flowchart LR
    A["/gsd:plan-phase N"] --> B["/gsd:execute-phase N"]
    B --> C["/gsd:verify-work N"]
    C --> D{All phases done?}
    D -->|No| A
    D -->|Yes| E["/gsd:complete-milestone"]
```

## Plan Phase Flow

### Trigger
`/gsd:plan-phase 3` (or auto-detect next unplanned phase)

### Sequence

```mermaid
sequenceDiagram
    participant Orch as Orchestrator LLM
    participant CLI as gsd-tools.cjs
    participant Res as gsd-phase-researcher
    participant Plan as gsd-planner
    participant Check as gsd-plan-checker
    participant FS as .planning/

    Orch->>CLI: init plan-phase 3
    CLI-->>Orch: JSON (models, phase_dir, req_ids, etc.)

    alt Research enabled & no RESEARCH.md
        Orch->>Res: Research domain for phase 3
        Res->>FS: Write RESEARCH.md
        Res-->>Orch: Research complete
    end

    Orch->>Plan: Create plans for phase 3
    Note over Plan: Reads ROADMAP, REQUIREMENTS, RESEARCH, CONTEXT
    Plan->>FS: Write PLAN.md files (01-01, 01-02, etc.)
    Plan-->>Orch: Plans created

    alt Plan checker enabled
        Orch->>Check: Verify plans achieve phase goal
        Check-->>Orch: PASS or FAIL with issues

        alt FAIL
            Orch->>Plan: Revise plans (with checker feedback)
            Plan->>FS: Update PLAN.md files
            Plan-->>Orch: Plans revised
            Note over Orch: Loop up to max iterations
        end
    end

    Orch->>CLI: commit "docs: phase 3 plans"
    Orch-->>Orch: Present plans to user
```

### Key Details

- **Phase auto-detection:** If no phase number given, finds the next phase with no plans
- **Research skip:** `--skip-research` flag or existing RESEARCH.md
- **CONTEXT.md:** If `/gsd:discuss-phase` was run first, CONTEXT.md contains user's vision — planner must honor locked decisions
- **Plan structure:** Each plan has frontmatter (`phase`, `plan`, `wave`, `depends_on`), objective, tasks, must-haves, success criteria
- **Wave assignment:** Planner groups plans into waves. Wave 1 runs first, wave 2 after wave 1 completes.
- **PRD express path:** `--prd path/to/file.md` bypasses discuss-phase, using the PRD as locked decisions

## Execute Phase Flow

### Trigger
`/gsd:execute-phase 3`

### Sequence

```mermaid
sequenceDiagram
    participant Orch as Orchestrator LLM
    participant CLI as gsd-tools.cjs
    participant Exec1 as gsd-executor (plan 1)
    participant Exec2 as gsd-executor (plan 2)
    participant Ver as gsd-verifier
    participant FS as .planning/

    Orch->>CLI: init execute-phase 3
    CLI-->>Orch: JSON (plans, waves, models, etc.)

    Orch->>CLI: phase-plan-index 3
    CLI-->>Orch: Plans grouped by wave

    Note over Orch: Wave 1 (parallel)
    par Execute wave 1 plans
        Orch->>Exec1: Execute plan 01-01
        Exec1->>FS: Implement tasks, write code
        Exec1->>CLI: commit per task
        Exec1->>FS: Write SUMMARY.md
        Exec1-->>Orch: Plan complete
    and
        Orch->>Exec2: Execute plan 01-02
        Exec2->>FS: Implement tasks, write code
        Exec2->>CLI: commit per task
        Exec2->>FS: Write SUMMARY.md
        Exec2-->>Orch: Plan complete
    end

    Note over Orch: Wave 2 (after wave 1)
    Orch->>Exec1: Execute plan 01-03
    Exec1->>FS: Implement, commit, summarize
    Exec1-->>Orch: Plan complete

    alt Verifier enabled
        Orch->>Ver: Verify phase 3 goal achieved
        Ver->>FS: Read code, check against success criteria
        Ver->>FS: Write VERIFICATION.md
        Ver-->>Orch: PASS or FAIL with gaps
    end

    Orch->>CLI: phase complete 3
    Orch->>CLI: state update-progress
    Orch->>CLI: requirements mark-complete REQ-IDs
```

### Wave Execution Detail

1. **Discover plans:** `gsd-tools phase-plan-index 3` returns plans with wave assignments
2. **Filter:** Skip plans with existing SUMMARY.md (already complete)
3. **Group by wave:** Wave 1 plans first, then wave 2, etc.
4. **Execute wave:**
   - If `parallelization = true`: spawn all wave plans simultaneously
   - If `parallelization = false`: execute sequentially within wave
5. **Handle checkpoints:** Some plans have `autonomous: false` — these pause for user input
6. **Collect results:** Read each SUMMARY.md, verify commit hashes

### Executor Behavior

Each gsd-executor agent:
1. Reads the PLAN.md file
2. Reads project context (`CLAUDE.md`, skills)
3. Executes tasks in order
4. Creates an atomic git commit per task
5. Handles deviations (if implementation differs from plan)
6. Writes SUMMARY.md with commit hashes and file manifest
7. Updates STATE.md metrics

## Verify Work Flow

### Trigger
`/gsd:verify-work 3` (or auto-triggered after execute-phase)

### Approach: Goal-Backward Verification

The verifier does NOT check if tasks were completed. It checks if the **phase goal was achieved**.

```mermaid
flowchart TD
    A[Phase Goal] --> B[Success Criteria]
    B --> C[For each criterion]
    C --> D{Evidence in code?}
    D -->|Yes| E[✓ Verified]
    D -->|No| F[✗ Gap identified]
    F --> G[Create gap closure plan]
    G --> H["/gsd:plan-phase N --gaps"]
```

**Key principle:** From `agents/gsd-verifier.md`: _"Task completion ≠ Goal achievement. A task 'create chat component' can be marked complete when the component is a placeholder."_

The verifier reads actual code, runs tests, and checks that observable user behavior matches success criteria.

## State Updates During Execution

| When | What Changes | How |
|------|-------------|-----|
| Plan execution starts | STATE.md current plan | `gsd-tools state update "Current Plan" 1` |
| Task committed | None (executor handles) | `gsd-tools commit "feat: ..."` |
| Plan completes | STATE.md metrics | `gsd-tools state record-metric --phase N --plan M` |
| All plans complete | STATE.md progress | `gsd-tools state update-progress` |
| Phase verified | ROADMAP.md checkbox | `gsd-tools phase complete N` |
| Requirements done | REQUIREMENTS.md checkboxes | `gsd-tools requirements mark-complete IDs` |
