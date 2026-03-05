# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

**Pi Coding Agent (Host Runtime):**
- Primary integration — pi-gtd IS an extension for the pi coding agent
- SDK: `@mariozechner/pi-coding-agent` (imported in `extensions/gsd/index.ts`)
- Contract: Extension factory function `export default function(pi: ExtensionAPI)` in `extensions/gsd/index.ts`
- Events subscribed: `before_agent_start`, `tool_call`, `session_start`
- APIs used: `pi.on()`, `pi.registerCommand()`, `pi.sendUserMessage()`

**Brave Search API (Optional):**
- Web search for research workflows
- SDK/Client: Native `fetch()` in `gsd/bin/lib/commands.cjs:cmdWebsearch()`
- Auth: `BRAVE_API_KEY` env var or `~/.gsd/brave_api_key` file
- Endpoint: `https://api.search.brave.com/res/v1/web/search`
- Detected during init by `gsd/bin/lib/init.cjs:cmdInitNewProject()` and `gsd/bin/lib/config.cjs:cmdConfigEnsureSection()`

**Git:**
- Version control integration for atomic commits
- Client: `child_process.execSync('git ...')` via `gsd/bin/lib/core.cjs:execGit()`
- Operations: `git add`, `git commit`, `git rev-parse`, `git cat-file`, `git check-ignore`, `git log`, `git status`
- Used by: `gsd/bin/lib/commands.cjs:cmdCommit()`, `gsd/bin/lib/verify.cjs:cmdVerifyCommits()`, executor agents

## Data Storage

**Databases:**
- None — all state is file-based

**File Storage:**
- Local filesystem only
- Project state: `.planning/` directory tree
- Key files: `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `PROJECT.md`, `config.json`
- Phase artifacts: `.planning/phases/NN-name/` (PLAN.md, SUMMARY.md, CONTEXT.md, RESEARCH.md, VERIFICATION.md)
- Quick tasks: `.planning/quick/NNN-slug/`
- Todos: `.planning/todos/pending/`, `.planning/todos/completed/`
- Milestones: `.planning/milestones/`
- Codebase map: `.planning/codebase/`
- Debug sessions: `.planning/debug/`, `.planning/debug/resolved/`

**Caching:**
- None — all state is read from disk on each invocation

## Authentication & Identity

**Auth Provider:**
- None — GSD has no authentication layer
- Brave Search API key is the only secret, stored as env var or file

## Monitoring & Observability

**Error Tracking:**
- None — errors written to stderr via `gsd/bin/lib/core.cjs:error()`

**Logs:**
- stderr for extension load failures (`extensions/gsd/index.ts` graceful degradation)
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Distributed as npm package via `package.json` `"pi"` field
- Installed into pi coding agent as an extension package

**CI Pipeline:**
- Tests run via `npx tsx tests/run-all.ts`
- E2E tests gated behind `--e2e` flag

## Environment Configuration

**Required env vars:**
- None strictly required

**Optional env vars:**
- `BRAVE_API_KEY` — Brave Search API key for research workflows
- `GSD_HOME` — Auto-set by extension, should not be manually configured

**Secrets location:**
- `~/.gsd/brave_api_key` — Brave Search API key file (optional)
- No other secrets managed by GSD itself

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- Brave Search API calls (when configured) — `gsd/bin/lib/commands.cjs:cmdWebsearch()`

## Pi Extension Integration Points

**Extension Registration (`extensions/gsd/index.ts`):**
1. `GsdPathResolver` constructor sets `GSD_HOME` env var
2. `registerGsdCommands()` registers all `/gsd:*` slash commands
3. `before_agent_start` event injects GSD system prompt context when `.planning/` exists
4. `tool_call` event rewrites `$GSD_HOME` in bash commands
5. `session_start` event sets status indicator when `STATE.md` exists

**Command Registration (`extensions/gsd/commands.ts`):**
- Discovers `commands/gsd/*.md` files at load time
- Parses YAML frontmatter for name/description
- Re-reads `.md` at invocation time (supports hot-reload via `/reload`)
- Transforms content via `GsdPathResolver.transform()` pipeline
- Sends transformed content as user message via `pi.sendUserMessage()`

**Path Resolution (`extensions/gsd/path-resolver.ts`):**
- 4-rule path rewrite: `@~/.claude/get-shit-done/`, `$HOME/.claude/get-shit-done/`, `~/.claude/get-shit-done/`, `$GSD_HOME/` → actual `gsdHome` path
- `<execution_context>` block transformation: converts `@path` lines to Read tool instructions
- `$ARGUMENTS` injection: replaces placeholder with user-provided command arguments

---

*Integration audit: 2026-03-05*
