# Module: Extension Layer (`extensions/gsd/`)

> **Purpose:** Bridge between Pi coding agent runtime and GSD workflow engine.
> **Language:** TypeScript (loaded via jiti — no compilation needed)
> **External dependency:** `@mariozechner/pi-coding-agent` (provided by Pi at runtime)

## Files

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~90 | Extension entry point: init, events, system prompt |
| `commands.ts` | ~110 | Command discovery, registration, handler factory |
| `path-resolver.ts` | ~85 | Path rewriting and content transformation |

## Public Surface Area

### `index.ts`

```typescript
export default function (pi: ExtensionAPI): void
```

The extension factory function. Called once by Pi at startup.

**Behavior:**
1. Creates `GsdPathResolver` instance
2. Validates `gsd/` and `gsd-tools.cjs` exist (graceful degradation)
3. Calls `registerGsdCommands(pi, resolver)`
4. Subscribes to 3 events: `before_agent_start`, `tool_call`, `session_start`

**Internal functions:**
- `buildGsdSystemPromptAddendum(resolver: GsdPathResolver): string` — generates the GSD context block injected into the system prompt
- `fileExistsSync(p: string): boolean` — safe stat check

### `commands.ts`

```typescript
export function registerGsdCommands(pi: any, resolver: GsdPathResolver): number
```

Returns the count of registered commands.

**Internal types:**
```typescript
interface CommandMeta {
  name: string;        // From frontmatter
  description: string; // From frontmatter
  argumentHint: string; // From frontmatter
  body: string;        // Everything after frontmatter
}
```

**Internal functions:**
- `parseCommand(content: string): CommandMeta` — extracts YAML frontmatter from command `.md` files

### `path-resolver.ts`

```typescript
export class GsdPathResolver {
  public readonly gsdHome: string;     // Path to gsd/ directory
  public readonly packageRoot: string;  // Path to pi-gtd root

  constructor();
  rewritePaths(content: string): string;
  transformExecutionContext(content: string): string;
  injectArguments(content: string, args: string): string;
  transform(content: string, args: string): string;
}
```

#### `rewritePaths()` — 4 rules, order matters

| Rule | Input Pattern | Output |
|------|--------------|--------|
| 1 | `@~/.claude/get-shit-done/` | `@{gsdHome}/` |
| 2 | `$HOME/.claude/get-shit-done/` | `{gsdHome}/` |
| 3 | `~/.claude/get-shit-done/` | `{gsdHome}/` |
| 4 | `$GSD_HOME/` | `{gsdHome}/` |

**Rule 1 must run before Rule 3** — otherwise `@~` would partially match Rule 3's `~` prefix and produce `@{gsdHome}/` with a stale `@` handling.

#### `transformExecutionContext()` — converts `@path` to read instructions

**Input:**
```xml
<execution_context>
@/path/to/workflow.md
@/path/to/reference.md
</execution_context>
```

**Output:**
```xml
<execution_context>
IMPORTANT: Read each of these files using the Read tool before proceeding:
- /path/to/workflow.md
- /path/to/reference.md
</execution_context>
```

Non-`@` lines within execution context blocks are preserved. Blocks with no `@` lines pass through unchanged.

#### `injectArguments()` — simple string replacement

Uses `split('$ARGUMENTS').join(args)` — deliberately avoids regex to prevent interpretation of special characters in `args`.

## Extension Points

### Adding a new command
1. Create `commands/gsd/my-command.md` with YAML frontmatter
2. The extension auto-discovers it at next startup (or `/reload`)
3. No TypeScript changes needed

### Adding a new event hook
1. Edit `extensions/gsd/index.ts`
2. Add `pi.on("event_name", handler)` in the factory function
3. See [Integration with Pi](../architecture/integration-pi-coding-agent.md) for available events

### Adding a new path rewrite rule
1. Edit `extensions/gsd/path-resolver.ts:rewritePaths()`
2. Add regex replacement — order matters
3. Update tests in `tests/unit-path-rewrite.test.ts`

## Common Pitfalls

- **Don't forget hot-reload:** Command handlers re-read `.md` files at invocation. If you cache anything at registration time, it won't update on `/reload`.
- **Path rule order:** Rewrite rules 1-4 have a specific order. Rule 1 (`@~/...`) must run before Rule 3 (`~/...`) due to prefix overlap.
- **Graceful degradation:** If you add new resource checks, follow the existing pattern: write to stderr and `return` (don't throw).
