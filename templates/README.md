# Package Templates

Standard templates for ISL monorepo packages. Used by the stamping tool to enforce consistency.

## `package-ts/`

The default TypeScript package template. Contains:

- **`tsconfig.json`** — Strict, declaration on, composite for project references, ES2022 target
- **`vitest.config.ts`** — Standard test config with v8 coverage
- **`package.json`** — Correct `exports`, `types`, `sideEffects`, `files`, standard scripts
- **`src/index.ts`** — Stub entry point
- **`README.md`** — Skeleton with `{{PACKAGE_NAME}}` / `{{DESCRIPTION}}` placeholders

## Stamp Tool

The stamping tool (`scripts/stamp-packages.ts`) applies this template across all packages.

### Quick Start

```bash
# Preview what would change (no writes)
pnpm stamp:dry-run

# Apply fixes
pnpm stamp

# Apply to a single package
npx tsx scripts/stamp-packages.ts --apply --filter=circuit-breaker
```

### What It Does

| File | Missing | Invalid | Existing |
|------|---------|---------|----------|
| `tsconfig.json` | Creates from template | Patches missing fields (strict, declaration) | Leaves valid configs alone |
| `vitest.config.ts` | Creates from template | — | Never overwrites |
| `package.json` | — | Patches: `type`, `exports`, `types`, `sideEffects`, `files`, scripts, devDeps | Additive only, never removes fields |
| `src/index.ts` | Creates stub | — | **Never overwrites** |
| `README.md` | Creates from template | — | Never overwrites |

### Guardrails

- **Source code is sacred** — `src/` files are never overwritten if they exist
- **Additive merging** — `package.json` fields are only added, never removed or replaced
- **Conflict reporting** — Any unresolvable conflicts are written to `reports/stamp-conflicts.md`

### New Package Workflow

When creating a new package, simply:

1. `mkdir packages/my-new-pkg`
2. Copy `templates/package-ts/` contents, or run `pnpm stamp --filter=my-new-pkg`
3. Replace `{{PACKAGE_NAME}}` and `{{DESCRIPTION}}` placeholders
4. Add your dependencies and source code
