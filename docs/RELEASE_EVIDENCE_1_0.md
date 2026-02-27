# Shipgate 1.0 Release Evidence

**Collected:** 2026-02-09  
**Orchestrator:** Shipgate 1.0 Release Orchestrator  
**Purpose:** Auditable evidence for GO/NO-GO decision.

---

## Environment

| Tool | Version | Command |
|------|--------|--------|
| Node | v24.12.0 | `node -v` |
| pnpm | 8.15.0 | `pnpm -v` |
| Workspace | IntentOS (monorepo) | — |

**Evidence:** Run at project root: `node -v && pnpm -v` → `v24.12.0`, `8.15.0`.

---

## Commands Executed and Outcomes

### 1. CLI version (local binary)

**Command:** `node packages/cli/dist/cli.cjs --version`  
**Result:** Exit 0. Output: `1.0.0`.  
**Note:** Uses existing `dist/cli.cjs` from a prior build. Does not prove fresh build or npx/global install.

### 2. CLI via npx

**Command:** `npx shipgate --version`  
**Result:** Timed out (no version line captured). npm warnings about project config (shamefully-hoist, etc.).  
**Evidence:** Not reliable for GO; npx resolution/fetch can be slow or environment-specific.

### 3. Build CLI (fresh)

**Command:** `pnpm --filter shipgate run build`  
**Result:** Exit 1. Build failed.

**Key errors:**

- `Could not read from file: .../packages/parser/dist/index.js` (parser not built or wrong path)
- `The symbol "extractExpressionText" has already been declared` (`packages/cli/src/commands/lint.ts`: duplicate function)
- `"await" can only be used inside an "async" function` (`packages/cli/src/commands/verify.ts`: printVerifyResult)
- `The symbol "generatePRComment" has already been declared` (`packages/cli/src/commands/proof-badge.ts`)
- `Could not resolve "@isl-lang/isl-discovery"` (dist/index.js not found)
- `Could not resolve "@isl-lang/codegen-python"`, `@isl-lang/codegen-graphql` (optional dynamic imports)

**Evidence path:** Terminal output from `pnpm --filter shipgate run build` (this session).

### 4. Production typecheck

**Command:** `pnpm typecheck:production`  
**Result:** Exit 1. Failed: `@isl-lang/fake-success-ui-detector#typecheck`.

**Error:** `src/patterns/catch-returns-success.ts(47,35): error TS2339: Property 'parent' does not exist on type 'never'.`

**Summary:** 21 successful, 20 cached, 1 failed (fake-success-ui-detector).  
**Evidence path:** Terminal output from `pnpm typecheck:production` (this session).

### 5. Critical tests

**Command:** `pnpm test:critical`  
**Result:** Exit 1. Turbo error: `No package found with name '@isl-lang/isl-pipeline' in workspace`.

**Root cause:** `package.json` script uses `--filter=@isl-lang/isl-pipeline`. Actual package name is `@isl-lang/pipeline` (see `packages/isl-pipeline/package.json`).

**Evidence path:** Terminal output from `pnpm test:critical` (this session).

### 6. CLI smoke tests

**Command:** Not run (blocked).  
**Reason:** Smoke test expects `dist/cli.js`; current build produces `dist/cli.cjs`. Package bin points to `dist/cli.cjs`.  
**Reference:** `packages/cli/tests/smoke.test.ts` (CLI_PATH = `../dist/cli.js`), `packages/cli/package.json` bin `./dist/cli.cjs`.

---

## Artifacts and Links

| Artifact | Path / Link |
|----------|-------------|
| Release checklist | `RELEASE_1.0_CHECKLIST.md` |
| Release board | `docs/RELEASE_BOARD_1_0.md` |
| Release notes | `docs/RELEASE_NOTES_1_0.md` |
| Readiness report (JSON) | `reports/readiness.json` |
| Readiness report (MD) | `reports/readiness.md` |
| Release workflow | `.github/workflows/release-shipgate.yml` |
| CLI package | `packages/cli/package.json` (name: shipgate, version: 1.0.0) |

---

## GO / NO-GO and Why

**Verdict: NO-GO**

**Reasons:**

1. **CLI does not build from clean state** — Build fails due to missing parser dist, duplicate symbols in lint/proof-badge, and non-async await in verify. Published npm package may have been built in a different environment; current repo cannot reproduce a clean CLI build.
2. **Production typecheck fails** — One production package (`@isl-lang/fake-success-ui-detector`) fails typecheck, so “core build + typecheck” criterion is not met.
3. **Critical tests not runnable** — `pnpm test:critical` fails because of a wrong filter name (`@isl-lang/isl-pipeline` vs `@isl-lang/pipeline`), so critical test suite was not executed and cannot be used as evidence.

**To reach GO:**

- Fix CLI build (parser build order or bundler config; dedupe `extractExpressionText` and `generatePRComment`; fix `printVerifyResult` async/await; handle or build isl-discovery/codegen optional deps).
- Fix or quarantine `@isl-lang/fake-success-ui-detector` type error.
- Fix `test:critical` in root `package.json` to use `@isl-lang/pipeline` (and re-run).
- Optionally: align smoke test and CI with `dist/cli.cjs` (or build `cli.js` and keep both consistent).

---

*Evidence collected by Shipgate 1.0 Release Orchestrator. Update this file when re-running checks or adding new evidence.*
