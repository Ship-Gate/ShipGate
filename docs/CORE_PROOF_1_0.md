# Core Package Proof — 1.0

**Agent:** 05 — Core Package Proof Runner  
**Mission:** Produce hard proof that each core package builds and is usable in isolation.  
**Date:** 2025-02-09

---

## Summary

| Package | Build | Import smoke | Verdict |
|---------|--------|--------------|---------|
| @isl-lang/parser | 🔴 Fail | — | 🔴 |
| @isl-lang/typechecker | 🔴 Partial (DTS fail) | 🔴 Fail | 🔴 |
| @isl-lang/evaluator | ✅ Pass | ✅ Pass | ✅ |
| @isl-lang/isl-core | 🔴 Fail | — | 🔴 |
| @isl-lang/verifier-runtime | 🔴 Fail | — | 🔴 |
| shipgate (CLI) | 🔴 Fail | — | 🔴 |

**Overall verdict: 🔴** — Only **@isl-lang/evaluator** builds and passes a minimal import smoke check in isolation.

---

## 1. @isl-lang/parser

**Build command:** `pnpm --filter @isl-lang/parser build`

**Result:** 🔴 **FAIL**

**Output (excerpt):**
```
> pnpm run build:grammar && tsup
build:grammar OK
X [ERROR] Expected ";" but found "{"
    src/parser.ts:222:14:
      222 │     } finally {
```

- **Cause:** Syntax/parse error in `packages/parser/src/parser.ts` at line 222: `} finally {` appears without a matching `try` in the same method (`parseDomain()`). The method has a `while` with an inner try/catch and a trailing `} finally { this.decrementDepth(); }` with no outer `try`.
- **Downstream:** DTS build also failed (many cascaded TS errors from the same region).

**Import test:** Not run (no successful build).

**Warnings:** —

**Verdict:** 🔴

---

## 2. @isl-lang/typechecker

**Build command:** `pnpm --filter @isl-lang/typechecker build`

**Result:** 🔴 **PARTIAL** (ESM/CJS built; DTS failed)

**Output (excerpt):**
```
ESM ⚡️ Build success
CJS ⚡️ Build success
src/import-resolver.ts(58,19): error TS2304: Cannot find name 'path'.
src/import-resolver.ts(110,38): error TS2307: Cannot find module '@isl-lang/parser' or its corresponding type declarations.
...
DTS Build error
```

- **Cause:** DTS step fails due to: (1) missing `path` (Node built-in not in scope for DTS), (2) cannot find module `@isl-lang/parser` (parser has no dist; typechecker depends on it).

**Import test:** 🔴 **FAIL**

- Requiring `packages/typechecker/dist/index.cjs` fails at runtime:
- `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in .../node_modules/@isl-lang/errors/package.json`
- Typechecker depends on `@isl-lang/errors`; that package does not expose a proper `exports` entry for the resolution path used.

**Warnings:** ESM/CJS artifacts exist but package is not usable without DTS and without working dependency resolution.

**Verdict:** 🔴

---

## 3. @isl-lang/evaluator

**Build command:** `pnpm --filter @isl-lang/evaluator build`

**Result:** ✅ **PASS**

**Output (excerpt):**
```
ESM ⚡️ Build success
CJS ⚡️ Build success
DTS ⚡️ Build success
```

**Import test:** ✅ **PASS**

- `node scripts/core-proof-import-smoke.mjs packages/evaluator`
- Main entrypoint imports successfully; `evaluate` export is present and usable.

**Warnings:** None observed.

**Verdict:** ✅

---

## 4. @isl-lang/isl-core

**Build command:** `pnpm --filter @isl-lang/isl-core build`

**Result:** 🔴 **FAIL**

**Output (excerpt):**
```
ESM ⚡️ Build success
src/lexer/index.ts(1,15): error TS6307: File '.../lexer/tokens.ts' is not listed within the file list of project ''.
src/index.ts(16,42): error TS2307: Cannot find module '@isl-lang/parser' or its corresponding type declarations.
...
DTS Build error
```

- **Cause:** (1) DTS step: TS project file list does not include several source files (e.g. `lexer/tokens.ts`, `lexer/lexer.ts`, etc.). (2) Dependency `@isl-lang/parser` has no built dist/types.

**Import test:** Not run (no successful build; ESM built but DTS failed and package depends on parser).

**Warnings:** —

**Verdict:** 🔴

---

## 5. @isl-lang/verifier-runtime

**Build command:** `pnpm --filter @isl-lang/verifier-runtime build`

**Result:** 🔴 **FAIL**

**Output (excerpt):**
```
> tsc
src/checks/invariants.ts(5,27): error TS2307: Cannot find module '@isl-lang/parser' or its corresponding type declarations.
...
src/evaluator.ts(370,48): error TS7006: Parameter 'e' implicitly has an 'any' type.
...
```

- **Cause:** (1) Cannot find module `@isl-lang/parser`. (2) Multiple implicit `any` type errors (parameter types not declared).

**Import test:** Not run (no successful build).

**Warnings:** —

**Verdict:** 🔴

---

## 6. shipgate (CLI — @isl-lang/cli)

**Build command:** `pnpm --filter shipgate build`  
*(Note: package name in repo is `shipgate`; no package named `@isl-lang/cli` in package.json.)*

**Result:** 🔴 **FAIL**

**Output (excerpt):**
```
X [ERROR] Could not read from file: .../packages/parser/dist/index.js
X [ERROR] Could not resolve "@isl-lang/codegen-python"
X [ERROR] Could not resolve "@isl-lang/codegen-graphql"
X [ERROR] The symbol "extractExpressionText" has already been declared (lint.ts)
X [ERROR] "await" can only be used inside an "async" function (verify.ts)
X [ERROR] The symbol "generatePRComment" has already been declared (proof-badge.ts)
X [ERROR] Could not read from file: .../packages/isl-verify/dist/index.js
X [ERROR] Could not resolve "@isl-lang/isl-discovery"
X [ERROR] Could not read from file: .../packages/isl-core/dist/index.js
```

- **Cause:** CLI bundle depends on parser, isl-core, isl-verify (no dist); optional codegen packages unresolved; duplicate function declarations; top-level `await` in non-async context.

**Import test:** Not run (no successful build).

**Warnings:** Several esbuild warnings (import.meta in CJS, tsconfig.base.json missing, sideEffects).

**Verdict:** 🔴

---

## Import smoke test method

For packages that built successfully, the following was used:

- **Script:** `scripts/core-proof-import-smoke.mjs`
- **Steps:** Load main entry (ESM `dist/index.js` or CJS `dist/index.cjs`), then call or inspect one exported function (e.g. `evaluate` for evaluator).
- **Success:** Exit 0 and log confirmation.
- **Failure:** Exit 1 and log error.

---

## Recommendations

1. **Parser:** Fix `parseDomain()` in `packages/parser/src/parser.ts`: add the missing `try {` that pairs with the existing `} finally { this.decrementDepth(); }`, or remove the orphaned `finally` block.
2. **Typechecker:** Fix DTS (add `path` import/type and ensure `@isl-lang/parser` is buildable first). Fix or align `@isl-lang/errors` `exports` so typechecker can be required in isolation.
3. **isl-core:** Resolve TS project file list (include all referenced sources) and ensure `@isl-lang/parser` builds so isl-core can resolve it.
4. **verifier-runtime:** Ensure `@isl-lang/parser` is built; add explicit types for callback/parameters to resolve implicit `any` errors.
5. **CLI:** Fix duplicate declarations (`extractExpressionText`, `generatePRComment`), move `await import(...)` into an async function in verify.ts, and ensure parser, isl-core, isl-verify (and optionally codegen/isl-discovery) are built or marked external with runtime resolution.

---

*Generated by Agent 05 — Core Package Proof Runner.*
