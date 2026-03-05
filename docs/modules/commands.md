# Module: Command Definitions (`commands/gsd/`)

> **Purpose:** Define user-facing `/gsd:*` slash commands with YAML frontmatter metadata.
> **Format:** Markdown files with YAML frontmatter
> **Count:** 30 command files + bare `/gsd` (maps to `help.md`)

## Command List

| Command | File | Description |
|---------|------|-------------|
| `/gsd` | `help.md` | Show GSD help |
| `/gsd:new-project` | `new-project.md` | Initialize project (research → requirements → roadmap) |
| `/gsd:map-codebase` | `map-codebase.md` | Map existing codebase for brownfield projects |
| `/gsd:discuss-phase` | `discuss-phase.md` | Articulate vision for a phase before planning |
| `/gsd:research-phase` | `research-phase.md` | Deep domain research for a phase |
| `/gsd:plan-phase` | `plan-phase.md` | Create detailed phase plan (PLAN.md) |
| `/gsd:execute-phase` | `execute-phase.md` | Execute all plans in a phase |
| `/gsd:verify-work` | `verify-work.md` | Verify phase goal achievement |
| `/gsd:quick` | `quick.md` | Execute small ad-hoc tasks |
| `/gsd:progress` | `progress.md` | Show status, route to next action |
| `/gsd:resume-work` | `resume-work.md` | Resume from previous session |
| `/gsd:pause-work` | `pause-work.md` | Create context handoff |
| `/gsd:debug` | `debug.md` | Systematic debugging with persistent state |
| `/gsd:add-phase` | `add-phase.md` | Add phase to end of roadmap |
| `/gsd:insert-phase` | `insert-phase.md` | Insert decimal phase between existing |
| `/gsd:remove-phase` | `remove-phase.md` | Remove phase and renumber |
| `/gsd:add-todo` | `add-todo.md` | Capture idea as todo |
| `/gsd:check-todos` | `check-todos.md` | List and work on pending todos |
| `/gsd:add-tests` | `add-tests.md` | Add tests for existing code |
| `/gsd:new-milestone` | `new-milestone.md` | Start new milestone |
| `/gsd:complete-milestone` | `complete-milestone.md` | Archive completed milestone |
| `/gsd:audit-milestone` | `audit-milestone.md` | Audit milestone completion |
| `/gsd:plan-milestone-gaps` | `plan-milestone-gaps.md` | Create phases for audit gaps |
| `/gsd:settings` | `settings.md` | Configure workflow toggles |
| `/gsd:set-profile` | `set-profile.md` | Quick switch model profile |
| `/gsd:health` | `health.md` | Check `.planning/` health |
| `/gsd:cleanup` | `cleanup.md` | Archive old phase directories |
| `/gsd:update` | `update.md` | Update GSD to latest version |
| `/gsd:help` | `help.md` | Show command reference |
| `/gsd:join-discord` | `join-discord.md` | Join GSD Discord community |
| `/gsd:list-phase-assumptions` | `list-phase-assumptions.md` | Show Claude's planned approach |
| `/gsd:reapply-patches` | `reapply-patches.md` | Reapply patches after changes |

## Command File Structure

```yaml
---
name: gsd:plan-phase                          # Command name (without /)
description: Create detailed phase plan       # Shown in autocomplete
argument-hint: "[phase] [--auto]"             # Usage hint
agent: gsd-planner                            # Optional: subagent to spawn
allowed-tools:                                # Optional: tools for the agent
  - Read
  - Write
  - Bash
---
<objective>
What this command achieves.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS
</context>

<process>
Execute the workflow from @~/.claude/get-shit-done/workflows/plan-phase.md end-to-end.
</process>
```

### Frontmatter Fields

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | Yes | Command name for registration |
| `description` | Yes | Shown in Pi autocomplete |
| `argument-hint` | No | Shown in help text |
| `agent` | No | Primary subagent to spawn |
| `allowed-tools` | No | Tools available to the agent |

### Body Tags

| Tag | Purpose |
|-----|---------|
| `<objective>` | What the command achieves |
| `<execution_context>` | Files to read before proceeding (@ references) |
| `<context>` | Runtime context (`$ARGUMENTS` placeholder) |
| `<process>` | Step-by-step instructions for the LLM |

## How to Add a New Command

1. Create `commands/gsd/my-command.md`
2. Add YAML frontmatter with `name`, `description`
3. Add `<execution_context>` referencing a workflow file
4. Create the workflow file at `gsd/workflows/my-command.md`
5. Restart Pi or run `/reload` — the command auto-discovers

**No TypeScript changes needed.** The extension discovers all `*.md` files in `commands/gsd/`.

## How Commands Become LLM Behavior

1. User types `/gsd:plan-phase 3`
2. Pi matches `gsd:plan-phase` to registered command
3. Handler reads `commands/gsd/plan-phase.md` from disk
4. Frontmatter is stripped, body is extracted
5. `GsdPathResolver.transform()` processes the body:
   - `@~/.claude/get-shit-done/...` → actual paths
   - `<execution_context>` → "Read these files" instructions
   - `$ARGUMENTS` → `"3"`
6. Transformed content sent via `pi.sendUserMessage()`
7. LLM receives it as a user message and follows the instructions
