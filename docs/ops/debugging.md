# Debugging

> **Key Takeaways:**
> - No structured logging — errors go to stderr, output to stdout as JSON
> - Extension errors: check Pi's console/stderr for `[pi-gsd]` prefix
> - CLI errors: look for `Error:` on stderr from gsd-tools.cjs
> - Most issues: path resolution, missing files, malformed markdown

## Where to Look

### Extension Load Failures

**Symptoms:** No `/gsd:*` commands available, no "GSD ●" in footer.

**Check:**
1. Pi stderr output for `[pi-gsd]` messages
2. `gsd/` directory exists relative to package root
3. `gsd/bin/gsd-tools.cjs` exists
4. `package.json` has correct `"pi"` field

**Common causes:**
- Package not installed/linked in Pi settings
- `gsd/` directory missing or renamed
- TypeScript syntax error in `extensions/gsd/*.ts`

### Command Failures

**Symptoms:** `/gsd:X` shows error notification.

**Check:**
1. Command file exists: `commands/gsd/X.md`
2. File has valid YAML frontmatter
3. Body is non-empty after frontmatter
4. `<execution_context>` references exist

**Debug steps:**
```bash
# Verify command file
cat commands/gsd/plan-phase.md | head -10

# Test path resolution manually
node -e "
  const {GsdPathResolver} = require('./extensions/gsd/path-resolver.ts');
  // (won't work directly — use tsx)
"

# Test with tsx
npx tsx -e "
  import {GsdPathResolver} from './extensions/gsd/path-resolver.js';
  const r = new GsdPathResolver();
  console.log('gsdHome:', r.gsdHome);
"
```

### gsd-tools.cjs Failures

**Symptoms:** LLM reports an error from `gsd-tools.cjs` call.

**Check:**
```bash
# Run the command directly
node gsd/bin/gsd-tools.cjs state load
node gsd/bin/gsd-tools.cjs init plan-phase 3
node gsd/bin/gsd-tools.cjs find-phase 3
```

**Common causes:**
- `.planning/` directory doesn't exist
- `config.json` malformed (invalid JSON)
- Phase number doesn't match any directory
- STATE.md has unexpected format

### State Sync Issues

**Symptoms:** STATE.md frontmatter doesn't match body, stale progress values.

**Check:**
```bash
# View frontmatter
node gsd/bin/gsd-tools.cjs state json

# View body
node gsd/bin/gsd-tools.cjs state get

# Force recalculate progress
node gsd/bin/gsd-tools.cjs state update-progress
```

**Fix:** Any `state update` or `state patch` command triggers frontmatter resync via `writeStateMd()`.

### Roadmap Parsing Failures

**Symptoms:** `roadmap get-phase N` returns `found: false` even though phase exists.

**Check:**
```bash
# Test roadmap parsing
node gsd/bin/gsd-tools.cjs roadmap get-phase 3
node gsd/bin/gsd-tools.cjs roadmap analyze
```

**Common causes:**
- Heading format doesn't match `### Phase N: Name`
- User edited ROADMAP.md with different formatting
- Phase number has leading zeros that don't match regex

### Phase Directory Issues

**Symptoms:** Phase not found, wrong files listed.

**Check:**
```bash
# List phases
node gsd/bin/gsd-tools.cjs phases list

# Find specific phase
node gsd/bin/gsd-tools.cjs find-phase 3

# Check plan index
node gsd/bin/gsd-tools.cjs phase-plan-index 3
```

**Common cause:** Phase directory naming doesn't match expected `NN-name` pattern.

## Common Failure Modes

| Failure | Symptom | Root Cause | Fix |
|---------|---------|-----------|-----|
| No commands | `/gsd` not found | Extension not loaded | Check Pi package config |
| "gsd/ not found" in stderr | No GSD features | Wrong package root | Check `__dirname` resolution |
| "ROADMAP.md not found" | Init commands fail | Project not initialized | Run `/gsd:new-project` |
| "phase required" | CLI error | Missing argument | Provide phase number |
| Config defaults used | Unexpected behavior | `config.json` parse failure | Check JSON validity |
| Stale frontmatter | Wrong state values | Direct STATE.md edit | Run `state update-progress` |
| Phase not found | Plans can't execute | Directory naming mismatch | Check `phases list` output |

## Diagnostic Commands

```bash
# Full health check
node gsd/bin/gsd-tools.cjs validate health

# With auto-repair
node gsd/bin/gsd-tools.cjs validate health --repair

# Consistency check (phase numbering + disk sync)
node gsd/bin/gsd-tools.cjs validate consistency

# Full project state dump
node gsd/bin/gsd-tools.cjs state-snapshot

# Progress overview
node gsd/bin/gsd-tools.cjs progress json
```
