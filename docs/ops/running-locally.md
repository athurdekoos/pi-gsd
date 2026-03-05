# Running Locally

> **Key Takeaways:**
> - pi-gtd runs inside Pi coding agent — no standalone mode
> - Only prerequisites: Node.js 20+, Pi coding agent, Git
> - Zero npm runtime dependencies — `npm install` is only for devDependencies (tests)
> - No build step — TypeScript loaded via jiti at runtime

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20+ | Runtime for gsd-tools.cjs and tests |
| Pi coding agent | Latest | Host runtime that loads the extension |
| Git | Any | Version control for atomic commits |
| npm | Any | Package manager (dev dependencies only) |

## Setup

### 1. Clone the repository

```bash
git clone <repo-url> pi-gtd
cd pi-gtd
```

### 2. Install dev dependencies (for tests only)

```bash
npm install
```

This installs:
- `tsx` ^4.0.0 — TypeScript execution for tests
- `typescript` ^5.0.0 — Type checking

**No runtime dependencies.** The extension and CLI use only Node.js built-ins.

### 3. Register as a Pi package

Pi discovers extensions via its package system. You can:

**Option A: Add to Pi settings.json**
```json
{
  "packages": ["/path/to/pi-gtd"]
}
```

**Option B: Install as npm package**
```bash
# If published to npm
npm install -g pi-gsd
```

### 4. Verify

Start Pi in a directory:
```bash
pi
```

Type `/gsd:help` — if you see the command reference, the extension loaded successfully.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GSD_HOME` | Auto-set | `{packageRoot}/gsd/` | Path to GSD runtime. Set by extension, not manually. |
| `BRAVE_API_KEY` | No | — | Brave Search API key for research workflows |

### Brave Search Setup (Optional)

For web research during `/gsd:new-project` and `/gsd:research-phase`:

**Option A:** Set environment variable
```bash
export BRAVE_API_KEY="your-api-key"
```

**Option B:** Store in file
```bash
mkdir -p ~/.gsd
echo "your-api-key" > ~/.gsd/brave_api_key
```

## Configuration

### User-level defaults (`~/.gsd/defaults.json`)

Optional file with default settings for new projects:

```json
{
  "model_profile": "balanced",
  "commit_docs": true,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  },
  "parallelization": true
}
```

### Project-level config (`.planning/config.json`)

Created by `/gsd:new-project`. See [data-flow.md](../architecture/data-flow.md#configjson) for full schema.

## Directory Structure After Setup

```
pi-gtd/                    # The extension package
├── extensions/gsd/         # TypeScript extension (loaded by Pi)
├── commands/gsd/           # Slash command definitions
├── agents/                 # Agent definitions
├── gsd/                    # GSD runtime (workflows, CLI, templates)
├── tests/                  # Test suite
└── package.json            # Pi package metadata

~/                          # User home
├── .gsd/                   # Optional user-level config
│   ├── defaults.json       # Default settings for new projects
│   └── brave_api_key       # Brave Search API key
```

## Common Tasks

### Type-check the extension
```bash
npx tsc --noEmit
```

### Run all tests
```bash
npx tsx tests/run-all.ts
```

### Run a single test
```bash
npx tsx tests/compliance.test.ts
```

### Test a gsd-tools command
```bash
node gsd/bin/gsd-tools.cjs --help  # (no --help flag, but shows usage on error)
node gsd/bin/gsd-tools.cjs generate-slug "Hello World"
node gsd/bin/gsd-tools.cjs current-timestamp date
```

### Reload after code changes
In a running Pi session:
```
/reload
```
This reloads extensions, commands, and agents without restarting.
