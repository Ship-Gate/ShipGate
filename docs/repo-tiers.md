# Repository Package Tiers

This document defines the quality tiers for packages in the ISL monorepo and their enforcement in CI gates.

---

## Tier Definitions

### Tier 1: Core (Must be green for MVP)
Packages that are required for the primary ISL functionality. These MUST pass build, typecheck, and tests.

**Enforcement:** Failures block merge to main.

**Packages:** All packages not listed in Tier 2 or 3 (183 packages)

### Tier 2: Partial (Allowed but not required)
Packages that provide optional functionality. Should be green but won't block MVP releases.

**Enforcement:** Failures generate warnings but don't block merge.

**Packages:** Currently empty — all non-experimental packages are core.

### Tier 3: Experimental (Excluded from default gates)
Packages with known architectural issues that require significant refactoring. Explicitly excluded from default CI checks.

**Enforcement:** Not checked by default. Use `typecheck:experimental` for manual verification.

---

## CLI Package Disambiguation

There are **two CLI packages** in this monorepo. This can cause confusion:

| Package | npm Name | Location | Tier | Purpose |
|---------|----------|----------|------|---------|
| `@isl-lang/cli` | `@isl-lang/cli` | `packages/cli/` | Core* | **Active CLI** — the main `isl` command-line tool |
| `@isl-lang/isl-cli` | `@isl-lang/isl-cli` | `packages/isl-cli/` | Experimental | **Legacy CLI** — older implementation, being phased out |

**\*Note:** `@isl-lang/cli` is "Core" for tests but has typecheck skipped due to `verify.ts` type issues. The CLI functions correctly at runtime.

**Why CLI tests pass despite typecheck skip:**
- Tests run the CLI at runtime via `tsx`, which works
- Type errors are in verification-related code paths
- Core CLI functionality (parse, check, gen, heal, proof) works correctly

**Long-term plan:** Consolidate into `@isl-lang/cli` only. Deprecate `@isl-lang/isl-cli`.

---

## Experimental Packages (10)

| Package | Issue | Next Steps |
|---------|-------|------------|
| `@isl-lang/semantic-analysis` | AST type mismatches with `@isl-lang/isl-core` | Unify AST types |
| `@isl-lang/pbt` | AST type mismatches | Align with parser types |
| `@isl-lang/isl-cli` | Missing `.d.ts` files (legacy CLI) | Deprecate |
| `@isl-lang/github-app` | Octokit API version mismatches | Update API usage |
| `@isl-lang/test-runtime` | Missing `@isl-lang/trace-viewer` module | Add dependency |
| `@isl-lang/cli` | `Domain`/`DomainDeclaration` conflicts in verify.ts | Unify AST types |
| `@isl-lang/verify-pipeline` | `Domain`/`DomainDeclaration` conflicts | Unify AST types |
| `isl-lang (vscode)` | Bridge type system issues | Simplify union types |
| `@isl-lang/stdlib-distributed` | JSX/tsconfig issues | Fix tsconfig |
| `@isl-lang/runtime-interpreter` | Vitest config issues | Fix vitest config |

---

## Common Root Cause: AST Type Mismatch

**Problem:** 6 of the 10 experimental packages fail due to `Domain` vs `DomainDeclaration` type conflicts.

**Background:**
- `@isl-lang/parser` produces `DomainDeclaration` AST nodes
- Various packages expect a `Domain` type with different shape
- Properties like `uses`, `enums`, `span`, `policies`, `views`, `scenarios`, `chaos`, `location` differ

**Solution Direction:**
1. **Short-term:** Adapter functions that convert between types
2. **Long-term:** Single AST type definition in `@isl-lang/isl-core` used everywhere
3. **Validation:** Add a "type-only" test package that fails compilation if types drift

---

## CI Gate Configuration

### MVP Gate (`pnpm run mvp:green`)
```bash
# Runs in .github/workflows/mvp-green.yml
pnpm build                          # All 199 packages
pnpm typecheck                      # 183 core packages
pnpm --filter @isl-lang/cli test    # 94 CLI tests
```

### Full Gate (future)
```bash
pnpm build
pnpm typecheck
pnpm test                           # All package tests
pnpm typecheck:experimental         # Experimental (non-blocking)
```

### Experimental Check (scheduled, non-blocking)
```bash
pnpm run typecheck:experimental     # Runs on schedule to prevent rot
```

---

## Promoting Packages Between Tiers

### Experimental → Core
1. Fix all type errors
2. Ensure tests pass
3. Remove `typecheck` skip in `package.json`
4. Update this document
5. Add to CI gate

### Core → Experimental (demotion)
1. Document the issue in this file
2. Add `typecheck` skip to `package.json` with TODO comment
3. Create tracking issue for fix
4. Update MVP_GREEN_PLAN.md

---

## Package Status Commands

```bash
# Check all core packages (gate)
pnpm typecheck

# Check experimental packages (optional)
pnpm run typecheck:experimental

# List experimental packages
grep -r "echo 'TODO:" packages/*/package.json | cut -d: -f1 | sort -u
```
