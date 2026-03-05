# Pitfalls Research

**Domain:** Subagent testing for Pi extension
**Researched:** 2025-03-05
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Silent Agent Skipping

**What goes wrong:**
Pi's `loadAgentsFromDir()` silently skips agent `.md` files that lack `name` or `description` in frontmatter. No error, no warning — the agent just doesn't exist at runtime. `subagent({agent: "gsd-planner"})` returns "Unknown agent."

**Why it happens:**
Editing agent files can accidentally corrupt frontmatter. Copy-paste errors. YAML indentation issues.

**How to avoid:**
Test all 11 agent files with Pi's own `parseFrontmatter()` and assert `name` and `description` are truthy.

**Warning signs:**
"Unknown agent" errors during GSD workflow execution.

**Phase to address:** Phase 1 (wiring tests)

---

### Pitfall 2: MODEL_PROFILES Drift

**What goes wrong:**
`MODEL_PROFILES` in `core.cjs` has entries for agents that don't have `.md` files, or vice versa. New agents get added to `agents/` but not to `MODEL_PROFILES`. Model resolution silently falls back to `'sonnet'` for unknown agent types.

**Why it happens:**
Two independent registries (filesystem + code) with no automated consistency check. Easy to update one and forget the other.

**How to avoid:**
Bidirectional coverage test: every key in `MODEL_PROFILES` must have a matching `agents/*.md` file, and every `agents/*.md` file must have a matching `MODEL_PROFILES` entry.

**Warning signs:**
Agents always running on sonnet regardless of profile setting.

**Phase to address:** Phase 1 (wiring tests)

---

### Pitfall 3: Agent Name ≠ Filename

**What goes wrong:**
Pi discovers agents by filename (`gsd-planner.md`) but registers them by frontmatter `name:` field. If filename is `gsd-planner.md` but frontmatter says `name: planner`, workflows that call `subagent({agent: "gsd-planner"})` get "Unknown agent." 

**Why it happens:**
Upstream renames or copy-paste. The convention is implicit, not enforced.

**How to avoid:**
Test that `filename.replace('.md', '')` equals frontmatter `name` for all agents.

**Warning signs:**
Agent exists on disk but can't be found by name.

**Phase to address:** Phase 1 (wiring tests)

---

### Pitfall 4: Flaky E2e Due to Nondeterministic LLM Output

**What goes wrong:**
E2e test asserts specific content in LLM-generated SUMMARY.md. Test passes sometimes, fails others. Eventually gets `@skip`'d and stops catching real failures.

**Why it happens:**
LLM output varies per run. Temperature, sampling, model version changes.

**How to avoid:**
Assert structural properties (file exists, non-empty, contains domain-specific marker word planted in input), not exact content. Assert tool execution events (subagent tool was called, exit code 0), not text output.

**Warning signs:**
Test passes 80% of the time. Developers re-run until green.

**Phase to address:** Phase 2 (e2e test design)

---

### Pitfall 5: Agent Tools Field with Invalid Names

**What goes wrong:**
Agent frontmatter lists tools like `WebSearch` but Pi's tool registry uses different names. Agent spawns but can't use the intended tools. Silent degradation — agent works but less effectively.

**Why it happens:**
GSD was originally built for Claude Code which has different tool names. Some tools were renamed or are MCP-specific (`mcp__context7__*`).

**How to avoid:**
Validate tool names against known valid Pi tool set. Allow glob patterns for MCP tools.

**Warning signs:**
Agents that should do web search never search. Research agents that should use Context7 don't.

**Phase to address:** Phase 1 (wiring tests)

---

### Pitfall 6: agentScope Default Hides Project Agents

**What goes wrong:**
Pi's subagent tool defaults `agentScope` to `"user"`. Pi-gsd registers agents in `package.json` `pi.agents` which puts them in user scope. But if someone tests with a temp workspace that doesn't have agents symlinked, the agents aren't found.

**Why it happens:**
Agent discovery depends on filesystem layout. Temp workspaces don't automatically get agent files.

**How to avoid:**
In e2e tests, explicitly pass the extension path (`-e extensions/gsd`) and verify the prompt includes agent discovery instructions. Don't rely on agents being in `~/.pi/agent/agents/`.

**Warning signs:**
E2e test works on dev machine, fails in CI.

**Phase to address:** Phase 2 (e2e test setup)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode list of 11 agent names | Simple assertion | Must update when agents added/removed | Acceptable if test also does filesystem scan |
| Skip tool name validation | Avoid maintaining valid-tools list | Invalid tools slip through | Only if Pi provides a way to query valid tools |
| Test only "balanced" profile | Fewer assertions | "quality" and "budget" profiles untested | Never — all 3 are used in production |

## "Looks Done But Isn't" Checklist

- [ ] **Agent frontmatter**: Validated with Pi's parser, not custom regex
- [ ] **Model resolution**: Tested with actual config file, not just default fallback
- [ ] **Template paths**: Checked AFTER resolver runs, not just raw template content
- [ ] **E2e artifact**: Verified file exists AND is non-empty (not just `exists()`)
- [ ] **E2e tool call**: Verified subagent tool was invoked (not just that output appeared)
- [ ] **Coverage**: All 11 agents tested, not just the 5 in ISOL-02

## Sources

- Pi SDK `agents.ts` line: `if (!frontmatter.name || !frontmatter.description) continue;`
- Pi SDK subagent `index.ts`: `if (!agent) { return "Unknown agent" error }`
- `gsd/bin/lib/core.cjs`: `if (!agentModels) return 'sonnet';` (silent fallback)
- Existing pi-gsd test flakiness patterns observed in runtime-isolation tests

---
*Pitfalls research for: subagent testing*
*Researched: 2025-03-05*
