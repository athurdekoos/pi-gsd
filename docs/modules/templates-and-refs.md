# Module: Templates & References

> **Purpose:** Document templates for consistent artifact generation; reference docs for agent guidance.
> **Location:** `gsd/templates/` and `gsd/references/`

## Templates (`gsd/templates/`)

Templates provide consistent structure for generated documents. Agents read templates and fill them with project-specific content.

### Document Templates

| Template | Used By | Generates |
|----------|---------|----------|
| `project.md` | `new-project` workflow | `.planning/PROJECT.md` |
| `requirements.md` | `new-project` workflow | `.planning/REQUIREMENTS.md` |
| `roadmap.md` | `gsd-roadmapper` agent | `.planning/ROADMAP.md` |
| `state.md` | `gsd-roadmapper` agent | `.planning/STATE.md` |
| `config.json` | `config.cjs:cmdConfigEnsureSection` | `.planning/config.json` |
| `summary.md` | `gsd-executor` agent | `SUMMARY.md` files |
| `summary-minimal.md` | Quick tasks | Minimal summary format |
| `summary-standard.md` | Standard tasks | Standard summary format |
| `summary-complex.md` | Complex tasks | Detailed summary format |
| `research.md` | `gsd-phase-researcher` | Phase RESEARCH.md |
| `verification-report.md` | `gsd-verifier` | VERIFICATION.md |
| `phase-prompt.md` | `gsd-planner` | PLAN.md files |
| `milestone.md` | `complete-milestone` | Milestone archive |
| `milestone-archive.md` | `complete-milestone` | Archive document |
| `context.md` | `discuss-phase` | Phase CONTEXT.md |
| `UAT.md` | `verify-work` | User acceptance tests |
| `VALIDATION.md` | Validation workflow | Validation report |
| `DEBUG.md` | `gsd-debugger` | Debug session file |
| `discovery.md` | Discovery workflow | Discovery notes |
| `retrospective.md` | Milestone completion | Retrospective doc |
| `continue-here.md` | `pause-work` | Session handoff |
| `user-setup.md` | GSD installation | User setup guide |

### Research Project Templates (`gsd/templates/research-project/`)

Templates for the 4 parallel research dimensions + synthesis:

| Template | Generates |
|----------|----------|
| `STACK.md` | `.planning/research/STACK.md` |
| `FEATURES.md` | `.planning/research/FEATURES.md` |
| `ARCHITECTURE.md` | `.planning/research/ARCHITECTURE.md` |
| `PITFALLS.md` | `.planning/research/PITFALLS.md` |
| `SUMMARY.md` | `.planning/research/SUMMARY.md` |

### Codebase Map Templates (`gsd/templates/codebase/`)

Templates for the 7 codebase analysis documents:

| Template | Generates |
|----------|----------|
| `architecture.md` | `.planning/codebase/ARCHITECTURE.md` |
| `stack.md` | `.planning/codebase/STACK.md` |
| `structure.md` | `.planning/codebase/STRUCTURE.md` |
| `conventions.md` | `.planning/codebase/CONVENTIONS.md` |
| `testing.md` | `.planning/codebase/TESTING.md` |
| `integrations.md` | `.planning/codebase/INTEGRATIONS.md` |
| `concerns.md` | `.planning/codebase/CONCERNS.md` |

### Subagent Prompt Templates

| Template | Purpose |
|----------|---------|
| `planner-subagent-prompt.md` | Prompt template for spawning gsd-planner |
| `debug-subagent-prompt.md` | Prompt template for spawning gsd-debugger |

## References (`gsd/references/`)

Reference documents provide guidance that agents consult during execution.

| Reference | Purpose | Used By |
|-----------|---------|---------|
| `questioning.md` | Deep questioning techniques for user interaction | `new-project`, `new-milestone` workflows |
| `ui-brand.md` | Visual patterns for GSD output (banners, checkpoints, status symbols) | All workflows |
| `checkpoints.md` | Checkpoint protocol details | `gsd-executor` |
| `git-integration.md` | Git workflow patterns | `gsd-executor`, commit workflows |
| `git-planning-commit.md` | Planning doc commit conventions | Commit operations |
| `model-profiles.md` | Model selection guide | Configuration workflows |
| `model-profile-resolution.md` | Model resolution logic | Init commands |
| `planning-config.md` | Planning configuration reference | Settings workflows |
| `verification-patterns.md` | Verification methodology | `gsd-verifier` |
| `continuation-format.md` | Context continuation format | Session management |
| `decimal-phase-calculation.md` | Decimal phase numbering rules | Phase insert operations |
| `phase-argument-parsing.md` | Phase argument parsing rules | Phase workflows |
| `tdd.md` | Test-driven development patterns | `gsd-planner` (TDD mode) |

## How to Add a New Template

1. Create the template file in `gsd/templates/`
2. Use markdown placeholders that the agent will fill: `[Project Name]`, `[date]`
3. Reference the template in the agent or workflow that generates the document
4. Templates are passive — they're read by agents, not executed

## How to Add a New Reference

1. Create the reference file in `gsd/references/`
2. Add it to `<execution_context>` blocks in relevant command or workflow files
3. The path resolver handles the `@~/.claude/get-shit-done/references/...` → actual path conversion
