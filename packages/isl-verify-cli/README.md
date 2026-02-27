# isl-verify CLI

Instant verification for any project. Infer specs from code, verify implementation, detect hallucinations.

## Installation

```bash
pnpm add -D @isl-lang/isl-verify-cli
```

## Usage

### Primary: `isl-verify .` or `isl-verify scan <path>`

Scans a project and reports verification results:

- **Auto-detect** framework (Next.js, Express, Fastify, etc.) and ORM (Prisma, Mongoose, Drizzle)
- **Infer specs** from code (Prompt 1)
- **Run verification engine** (Prompt 2) — hallucinated imports, unprotected routes, type mismatches
- **Run hallucination detector** (Prompt 3) — Host + Reality-Gap scanners

```bash
isl-verify .
isl-verify scan ./my-project
```

### Setup: `isl-verify init`

Creates `.isl-verify/` directory, config, and inferred specs:

- `.isl-verify/` directory
- `.isl-verify.config.json` config file
- `.isl-verify/inferred-spec.isl` initial inferred spec
- Adds `.isl-verify/` to `.gitignore`

```bash
isl-verify init
```

### Diff: `isl-verify diff`

Shows what changed since last scan:

- New findings
- Resolved findings
- Trust score delta

```bash
isl-verify diff
```

### Explain: `isl-verify explain <finding-id>`

Deep dive on a specific finding:

- Code snippet
- Spec expectation
- Why it failed
- Suggested fix

```bash
isl-verify explain import-hallucinated-appapitasksroutets-nextserver
```

### Flags

| Flag | Description |
|------|-------------|
| `--json` | Machine-readable output for CI |
| `--fix` | Auto-fix simple findings (unused imports, missing null checks) |
| `--watch` | Re-scan on file changes |
| `--verbose` | Show medium/low findings |

## Config (`.isl-verify.config.json`)

```json
{
  "projectRoot": ".",
  "sourceDirs": ["src", "app", "lib", "pages"],
  "exclude": ["node_modules", "dist", ".next", "coverage"],
  "truthpackPath": ".vibecheck/truthpack",
  "threshold": 80,
  "verbose": false
}
```

## Output Format

```
ISL Verify — Scanning ./my-project
Framework: Next.js (App Router)  |  ORM: Prisma  |  Files: 47

━━━━ Trust Score: 72/100 — REVIEW ━━━━

CRITICAL (2)
  ✗ src/app/api/users/route.ts:23 — Hallucinated import: @/lib/auth exports no 'verifyAdmin'
  ✗ src/app/api/orders/route.ts:8 — Unprotected route: POST /api/orders requires auth per spec

HIGH (4)
  ⚠ src/lib/stripe.ts:45 — stripe.charges.create() is deprecated, use paymentIntents
  ...

Full report: .isl-verify/report.json
```

## Performance Targets

- **Cold scan** (50-file project): < 10 seconds
- **Warm scan** (cached specs): < 3 seconds
- **Watch mode** re-scan: < 1 second (changed files only)
