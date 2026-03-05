# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

**Brave Search API (optional):**
- Used for web research during project initialization and phase research
- Integration: REST API via Node.js `fetch()` in `gsd/bin/lib/commands.cjs` (`cmdWebsearch`)
- Auth: `BRAVE_API_KEY` env var or `~/.gsd/brave_api_key` file
- Endpoints: `https://api.search.brave.com/res/v1/web/search`
- Graceful degradation: If no API key, search silently skips (agents fall back to built-in capabilities)

## Data Storage

**File System (primary — no database):**
- All project state lives in `.planning/` directory
- State files: `STATE.md`, `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `config.json`
- Phase artifacts: `.planning/phases/{NN}-{name}/` with PLAN.md, SUMMARY.md, CONTEXT.md files
- Codebase maps: `.planning/codebase/*.md` (7 analysis documents)
- Research outputs: `.planning/research/*.md` (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- Milestones archive: `.planning/milestones/` (archived roadmaps, requirements, phase directories)
- Todos: `.planning/todos/pending/` and `.planning/todos/completed/`

**Git (version control integration):**
- Integration: `child_process.execSync('git ...')` in `gsd/bin/lib/core.cjs` (`execGit`)
- Operations: `add`, `commit`, `rev-parse`, `cat-file`, `check-ignore`
- Used for: Atomic commits of planning docs, commit hash verification in summaries
- Configurable: `commit_docs` flag in config.json controls whether planning docs are committed
- `.gitignore` integration: Checks if `.planning/` is gitignored before committing

## Authentication & Identity

**None** — pi-gsd is a local CLI extension. No user authentication required.

## Monitoring & Observability

**None** — No telemetry, error tracking, or analytics. All output is local terminal/file.

## CI/CD & Deployment

**Distribution:**
- Pi package system via `package.json` `pi` field
- No CI/CD pipeline configured in repo
- Tests run manually via `npx tsx tests/run-all.ts`

## Environment Configuration

**Development:**
- Required: Node.js 20+, Git, Pi coding agent
- Optional: `BRAVE_API_KEY` for web search in research workflows
- No `.env` file — configuration is per-project in `.planning/config.json`

**User-level Config:**
- `~/.gsd/defaults.json` - Global workflow defaults (optional)
- `~/.gsd/brave_api_key` - Brave Search API key file (optional)

## Webhooks & Callbacks

**None** — No incoming or outgoing webhooks.

## Pi Extension SDK Integration

**Event Subscriptions (3 events):**
- `before_agent_start` — Injects GSD system prompt addendum when `.planning/` exists
- `tool_call` — Intercepts bash commands to prepend `export GSD_HOME=...` when referencing gsd-tools
- `session_start` — Sets "GSD ●" status indicator when `STATE.md` exists

**Command Registration:**
- Discovers `commands/gsd/*.md` files at startup
- Registers each as `/gsd:{command-name}` slash command
- Handler re-reads `.md` file on each invocation (hot-reload support)
- Path resolver transforms `~/.claude/get-shit-done/` → local `gsd/` path

**Subagent System:**
- 11 agent definitions in `agents/gsd-*.md`
- Spawned via Pi's subagent tool (Task in Claude Code terminology)
- Each agent has dedicated focus: planner, executor, researcher, verifier, mapper, etc.

---

*Integration audit: 2026-03-05*
*Update when adding/removing external services*
