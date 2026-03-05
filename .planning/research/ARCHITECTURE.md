# Architecture Research

**Domain:** Subagent testing for Pi extension
**Researched:** 2025-03-05
**Confidence:** HIGH

## Standard Architecture

### Test File Organization

```
tests/
├── unit-subagent-wiring.test.ts    # Fast, free — no API calls
│   ├── Frontmatter validation (all 11 agents)
│   ├── Name-to-filename convention check
│   ├── MODEL_PROFILES ↔ agent file coverage
│   ├── Model resolution (11 agents × 3 profiles)
│   └── Template path resolution
│
├── e2e-subagent-spawn.test.ts      # Expensive — real Pi RPC session
│   ├── Prerequisites check (pi binary, auth)
│   ├── Spawn gsd-research-synthesizer via subagent tool
│   ├── Verify SUMMARY.md artifact created
│   └── Verify agent could read input files
│
└── harness/                         # Existing (no changes needed)
    ├── pi-rpc.ts                    # RPC session management
    ├── mock-api.ts                  # Extension API mock
    └── lifecycle.ts                 # Env snapshot, temp dirs
```

### Component Responsibilities

| Component | Responsibility | How It's Tested |
|-----------|---------------|-----------------|
| Agent `.md` files | Define subagent identity, tools, system prompt | Wiring: parse frontmatter, validate fields |
| `MODEL_PROFILES` in core.cjs | Map agent type → model per profile | Wiring: import and verify coverage |
| `resolveModelInternal()` in core.cjs | Resolve model for agent given config | Wiring: call with all agent types × profiles |
| `GsdPathResolver` | Rewrite upstream paths to local paths | Wiring: run on template content, check no residuals |
| Pi `subagent` tool | Discover agents, spawn `pi` process, collect output | E2e: trigger via RPC prompt |
| Pi `parseFrontmatter()` | Parse YAML frontmatter from `.md` files | Wiring: use Pi's actual parser on our files |

## Data Flow

### Wiring Test Flow

```
Test runner
    ↓
Read agents/*.md files from disk
    ↓
Parse with Pi SDK's parseFrontmatter()
    ↓
Assert: name, description, tools present
Assert: name matches filename
    ↓
Import MODEL_PROFILES from core.cjs
    ↓
Assert: every profile key has an agent file
Assert: every agent file has a profile entry
    ↓
Call resolveModelInternal() with test config
    ↓
Assert: returns valid model string for all combos
    ↓
Read template .md files
    ↓
Run GsdPathResolver.rewritePaths()
    ↓
Assert: no residual upstream paths remain
```

### E2e Test Flow

```
Create temp workspace with .planning/ structure
    ↓
Write input files (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md)
    ↓
Spawn Pi RPC session (with GSD extension loaded)
    ↓
Send prompt: "Use the subagent tool to spawn gsd-research-synthesizer
              with task to synthesize research files into SUMMARY.md"
    ↓
Wait for agent_end event
    ↓
Assert: subagent tool was called (tool_execution_start event)
Assert: SUMMARY.md exists in temp workspace
Assert: SUMMARY.md contains content from input files
    ↓
Cleanup temp workspace
```

## Patterns to Follow

### Pattern 1: Direct CJS Import for core.cjs

**What:** Import `MODEL_PROFILES` and `resolveModelInternal` directly from `gsd/bin/lib/core.cjs`
**When:** Model resolution tests
**Trade-offs:** Bypasses gsd-tools CLI overhead, but couples to internal API. Acceptable since we own the code.

```typescript
// Use require() or dynamic import for .cjs modules in .ts test files
const { MODEL_PROFILES, resolveModelInternal } = require("../gsd/bin/lib/core.cjs");
```

### Pattern 2: Pi SDK Import for parseFrontmatter

**What:** Use Pi's own `parseFrontmatter()` to validate agent files
**When:** Frontmatter validation tests
**Trade-offs:** Tests what Pi actually sees, not what we think it sees. If Pi changes its parser, our tests catch the breakage.

```typescript
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";
```

### Pattern 3: Existing RPC Harness for E2e

**What:** Use `spawnPiRpc()`, `promptAndWait()`, `createTempWorkspace()` from `tests/harness/pi-rpc.ts`
**When:** E2e subagent spawn test
**Trade-offs:** Proven infrastructure, but requires Pi binary + auth. Test fails (not skips) if missing.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Reimplementing frontmatter parsing

**What people do:** Write custom YAML parser to validate agent files
**Why it's wrong:** Tests our parser, not what Pi uses. Could pass while Pi fails.
**Do this instead:** Import `parseFrontmatter` from Pi SDK.

### Anti-Pattern 2: Testing model resolution via gsd-tools CLI

**What people do:** Shell out to `node gsd-tools.cjs resolve-model gsd-planner`
**Why it's wrong:** Adds process overhead, harder to assert, masks errors in shell escaping
**Do this instead:** Import `resolveModelInternal()` directly.

### Anti-Pattern 3: Asserting exact SUMMARY.md content in e2e

**What people do:** Check that SUMMARY.md contains exact strings from input files
**Why it's wrong:** LLM output is nondeterministic. Will flake.
**Do this instead:** Assert file exists, is non-empty, and contains recognizable markers from input (e.g., domain name).

## Sources

- Existing test patterns in `tests/runtime-isolation.test.ts`, `tests/parity-agents.test.ts`
- Pi SDK `agents.ts` source code — agent loading contract
- Pi SDK subagent example — `examples/extensions/subagent/`

---
*Architecture research for: subagent testing*
*Researched: 2025-03-05*
