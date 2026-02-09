# Test Report 1.0 — Release Bar Assessment

**Agent:** Test Orchestrator (04)  
**Date:** 2025-02-09  
**Scope:** `pnpm test:production`, `pnpm test:critical`, `pnpm --filter shipgate test:smoke`

---

## 1. Executive Summary

| Suite | Command | Result | Blocker |
|-------|--------|--------|--------|
| Production | `pnpm test:production` | **FAIL** | Build fails at `@isl-lang/healer` (DTS) |
| Critical | `pnpm test:critical` | **FAIL** | Build fails at `@isl-lang/parser` (syntax + TS) |
| CLI smoke | `pnpm --filter shipgate test:smoke` | **FAIL** | `dist/cli.cjs` missing (CLI build fails) |

**Pass rate (production tests):** Not computable — production and critical suites did not reach test execution; failure occurred in the **build** phase.

**Release-critical failures:** 3 (see Section 5). List must be empty for release.

---

## 2. Command Outputs (Summary + Failure Snippets)

### 2.1 `pnpm test:production`

- **Command:** `npx tsx scripts/run-production.ts test` → runs `turbo test` excluding 114 experimental/internal packages (126 packages in scope).
- **Result:** Exit code 1. Build phase failed before any test ran.
- **Root cause:** `@isl-lang/healer#build` failed during **DTS (declaration) build** with TS6307:

```
File '.../packages/isl-healer/src/types.ts' is not listed within the file list of project ''.
Projects must list all files or use an 'include' pattern.
```

Similar errors for `healer.ts`, `gate-ingester.ts`, `adapters/index.ts`, `recipes/index.ts`, `healable-findings.ts`, `patch-writer.ts`, `heal-enhanced.ts`, `rules/index.ts`. Healer uses tsup with `entry: ['src/index.ts']` and `dts: true`; the DTS step uses a project context that does not include the full `src/**/*.ts` set, triggering TS6307.

- **Snippet (tail):**

```
@isl-lang/healer:build: Error: error occurred in dts build
Failed:    @isl-lang/healer#build
❌ Production test failed
```

---

### 2.2 `pnpm test:critical`

- **Command (corrected):** `turbo test --filter=@isl-lang/evaluator --filter=@isl-lang/verifier-runtime --filter=@isl-lang/import-resolver --filter=@isl-lang/pipeline --filter=@isl-lang/proof`
- **Note:** Root `package.json` originally used `@isl-lang/isl-pipeline` and `@isl-lang/isl-proof`, which do not exist. Actual package names are `@isl-lang/pipeline` and `@isl-lang/proof`. **Fix applied** in `package.json`.
- **Result:** Exit code 1. Build phase failed before any test ran.
- **Root cause:** `@isl-lang/parser#build` failed:
  - **Syntax:** `Expected ";" but found "{"` at `src/parser.ts:222` (`} finally {`).
  - **DTS build:** Many TS errors (e.g. `Property 'Expression' does not exist on type ...`, `Cannot find name 'parseIdentifier'`, `'Token' only refers to a type, but is being used as a value`), indicating parser/ast API or build configuration issues.
- **Snippet:**

```
@isl-lang/parser:build: X [ERROR] Expected ";" but found "{"
    src/parser.ts:222:14:
      222 │     } finally {
...
@isl-lang/parser:build: DTS Build error
Failed:    @isl-lang/parser#build
```

---

### 2.3 `pnpm --filter shipgate test:smoke`

- **Command:** In `packages/cli`, `vitest run tests/smoke.test.ts` (18 tests).
- **Result:** Exit code 1. Suite failed in `beforeAll`: **dist/cli.cjs not found**.
- **Root cause:** Smoke tests expect the built CLI at `dist/cli.cjs`. The CLI build (`node scripts/build-with-esbuild.js`) did not complete successfully in this run due to:
  - Missing or unbuilt deps: `@isl-lang/parser` (dist), `@isl-lang/isl-discovery`, `@isl-lang/isl-verify`, `@isl-lang/codegen-python`, `@isl-lang/codegen-graphql`
  - Code errors: duplicate symbols (`generatePRComment`, `extractExpressionText`), `await` used outside async in `verify.ts`
- **Fix applied:** Smoke test path updated from `dist/cli.js` to `dist/cli.cjs` to match the actual build output (and error message text updated accordingly). Smoke will pass once the CLI build succeeds and produces `dist/cli.cjs`.

---

## 3. Pass Rate Math

- **test:production:** No test counts available; build failed. Pass rate **N/A** (target was >90%).
- **test:critical:** No test counts available; build failed. **Must pass** for release — currently **fails**.
- **shipgate test:smoke:** 0/18 tests ran (suite aborted in `beforeAll`). Pass rate **N/A**; **must pass** for release — currently **fails**.

---

## 4. Flaky Tests

No test runs completed; flakiness was not observed.

---

## 5. Release-Critical Failures (Must Be Empty for Release)

1. **@isl-lang/healer — build (DTS)**  
   TS6307: files not in project file list when generating declarations. Blocks `pnpm test:production`.

2. **@isl-lang/parser — build (syntax + DTS)**  
   Syntax error at `parser.ts:222` and many TypeScript errors in DTS build. Blocks `pnpm test:critical` (parser is a dependency of critical packages).

3. **shipgate CLI — build + smoke**  
   CLI build fails (missing deps + code errors); smoke tests cannot run without `dist/cli.cjs`. Blocks `pnpm --filter shipgate test:smoke`.

---

## 6. Fixes Applied in This Session

| Item | Change |
|------|--------|
| **test:critical script** | In root `package.json`, `@isl-lang/isl-pipeline` → `@isl-lang/pipeline`, `@isl-lang/isl-proof` → `@isl-lang/proof`. |
| **CLI smoke test** | In `packages/cli/tests/smoke.test.ts`, `CLI_PATH` and assertions updated from `dist/cli.js` to `dist/cli.cjs`; error message updated to reference `dist/cli.cjs`. |

No change was made to healer or parser (healer DTS and parser build require deeper fixes).

---

## 7. Recommendations

- **Core (release-blocking):**
  - **Parser:** Fix syntax at `parser.ts:222` and resolve DTS/type errors (ast exports, token/parser helpers). Until parser builds, critical tests cannot run.
  - **Healer:** Fix tsup/tsconfig so DTS build sees all `src` files (e.g. use `dts: { tsconfig: 'tsconfig.json' }` and ensure `include`/composite are consistent), or fix type errors in `heal-enhanced.ts` if switching to full project tsconfig.
  - **CLI:** Resolve duplicate symbols (`generatePRComment`, `extractExpressionText`), fix `await` usage in `verify.ts`, and ensure all required workspace packages are built before `shipgate` build (or mark optional code paths external). Then run `pnpm --filter shipgate build` before smoke.

- **Quarantine / experimental (if not fixed before release):**
  - Consider excluding `@isl-lang/healer` from production scope (e.g. add to `experimental.json`) until DTS and types are fixed, so `pnpm test:production` can at least run the rest.
  - Document that `pnpm --filter shipgate test:smoke` requires a successful full (or at least CLI dependency) build first; CI should run `build` before smoke.

---

## 8. PR / Follow-up

- **In this session:** No PR opened. Changes made: root `package.json` (`test:critical` filters) and `packages/cli/tests/smoke.test.ts` (path and message for `dist/cli.cjs`).
- **Recommended PRs:** (1) Parser: syntax + DTS/type fixes. (2) Healer: DTS config or type fixes. (3) CLI: duplicate symbols, async/await, and build-order or externals so smoke can run after build.

---

*End of report.*
