# Stack Research

**Domain:** Subagent testing for Pi extension
**Researched:** 2025-03-05
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `node:assert` | built-in | Assertions | Already used by all pi-gsd tests, zero-dep |
| `tsx` | ^4.0.0 | TypeScript execution | Already in devDependencies, runs tests without build |
| Pi RPC mode (`pi --mode rpc`) | current | E2e subagent testing | Proven in runtime-isolation.test.ts, captures JSON event stream |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `parseFrontmatter` from Pi SDK | current | Parse agent .md frontmatter | Wiring tests — validates what Pi actually sees |
| `gsd/bin/lib/core.cjs` | local | Model profile resolution | Wiring tests — test `resolveModelInternal()` and `MODEL_PROFILES` directly |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Existing `tests/harness/pi-rpc.ts` | RPC session management | `spawnPiRpc`, `promptAndWait`, `createTempWorkspace` |
| Existing `tests/harness/mock-api.ts` | Extension API mocking | Not needed for these tests — we test wiring, not extension events |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Jest/Vitest | Adds dependency, project uses custom harness | `node:assert` + `tsx` |
| Mocking the subagent tool | Doesn't prove real spawning works | Real Pi RPC for e2e |
| `parseFrontmatter` reimplementation | Would test our parser, not what Pi uses | Import from Pi SDK directly |

## Sources

- Pi SDK subagent example: `examples/extensions/subagent/` — reference implementation
- Pi SDK `agents.ts`: `discoverAgents()`, `loadAgentsFromDir()`, `parseFrontmatter()` — agent loading contract
- Existing pi-gsd tests — established patterns and harness

---
*Stack research for: subagent testing*
*Researched: 2025-03-05*
