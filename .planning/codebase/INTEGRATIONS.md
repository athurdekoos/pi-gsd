# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

**Web Search (Optional):**
- Brave Search API - Domain research during `/gsd:research-phase` workflows
  - Integration: HTTP via `gsd-tools.cjs websearch` command
  - Auth: `BRAVE_API_KEY` environment variable (optional; research works without it)
  - Rate limits: Configurable via `--limit N` flag

**LLM Provider:**
- Claude API (Anthropic) - All agent reasoning (planning, execution, verification)
  - Integration: Managed by Pi coding agent host runtime (not directly by pi-gsd)
  - Auth: Handled by Pi; pi-gsd selects model via `resolve-model` command
  - Models used: opus, sonnet, haiku (selected per agent type via model profiles)

## Data Storage

**Databases:**
- None - All state is file-based

**File Storage:**
- Local filesystem only
  - `.planning/` directory - All project state (PROJECT.md, STATE.md, ROADMAP.md, phases/, config.json)
  - State managed via `gsd-tools.cjs` CRUD commands
  - No cloud storage integration

**Caching:**
- None - No in-memory or disk caching layer

## Authentication & Identity

**Auth Provider:**
- None - pi-gsd is a local extension with no user authentication
  - Pi host handles any LLM API authentication

## Monitoring & Observability

**Error Tracking:**
- None - Errors written to stderr via `process.stderr.write()`

**Logs:**
- stderr only - Extension writes `[pi-gsd]` prefixed messages to stderr on initialization failures
- CLI tooling: stdout for JSON results, stderr for errors
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Local Pi coding agent installation
  - Extension discovered via `package.json` → `pi.extensions` field
  - No remote deployment

**CI Pipeline:**
- No GitHub Actions or CI/CD configured
  - Tests run locally via `npx tsx tests/run-all.ts`

## Environment Configuration

**Development:**
- Required env vars: None (GSD_HOME auto-set by path resolver)
- Optional env vars: `BRAVE_API_KEY` (web research)
- No mock services needed

**Production:**
- Same as development - extension runs locally inside Pi

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Pi Extension Integration Points

**Lifecycle Events Subscribed:**
- `before_agent_start` - Injects GSD system prompt when `.planning/` exists
- `tool_call` - Rewrites `$GSD_HOME` in bash commands at runtime
- `session_start` - Sets "GSD ●" status indicator when STATE.md exists

**Commands Registered:**
- 30+ `/gsd:*` slash commands discovered from `commands/gsd/*.md`
- Bare `/gsd` command (alias for `/gsd:help`)
- Commands re-read `.md` files at invocation time (hot-reload support)

**User Messages:**
- `pi.sendUserMessage()` - Commands send transformed markdown as user messages to trigger LLM workflow execution

## External Tool Dependencies

**Git:**
- Used by `gsd-tools.cjs commit` for atomic commits
- Used by `gsd-tools.cjs` for branch operations (phase/milestone branching)
- Shelled out via `child_process.execSync`
- Must be available in PATH

---

*Integration audit: 2026-03-05*
*Update when adding/removing external services*
