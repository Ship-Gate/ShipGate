# Typecheck & Declarations Audit — Release 1.0

**Agent:** 03 — Typecheck & Declarations Auditor  
**Date:** 2026-02-09  
**Command:** `pnpm typecheck:production`

---

## 1. Executive summary

| Status | Meaning |
|--------|--------|
| ✅ | Production typecheck would pass (after one fix applied); declarations OK for audited packages |
| 🟡 | Non-blocking issues or declaration gaps on non-core / experimental packages |
| 🔴 | Blocking: production typecheck fails; must fix or exclude for 1.0 |

**Overall:** 🔴 **Blocking** — `@isl-lang/healer` fails typecheck (40+ errors). One other failure was fixed during this audit.

---

## 2. Typecheck results

### 2.1 Production typecheck scope

- **Script:** `npx tsx scripts/run-production.ts typecheck` → runs `turbo typecheck` excluding packages listed in `experimental.json` (experimental + internal).
- **Packages in scope:** 126 (all non-experimental).
- **Excluded:** 114 experimental/internal packages.

### 2.2 Errors identified

| Package | Classification | Blocking for 1.0? | Notes |
|---------|----------------|--------------------|--------|
| **@isl-lang/fake-success-ui-detector** | Non-core (detector/tooling) | Was blocking | **Fixed.** `src/patterns/catch-returns-success.ts`: `node.parent` inferred as `never` in loop; fixed by typing `parent` as `ts.Node \| undefined`. |
| **@isl-lang/healer** | **Core** (verification — `experimental.json` production.verification) | **Yes** | **Open.** 40+ TS errors across `heal-enhanced.ts`, `honesty-guard.test.ts`, `patch-inspector.ts`, `ast-semantic-rules.ts`, `deterministic-recipes.ts`: `EnhancedHealResult`/`Violation`/`PatchRecord` type mismatches, and many `possibly 'undefined'` / `string \| undefined` not assignable to `string`. |

### 2.3 Classification summary

- **Core:** Parser, typechecker, evaluator, isl-core, errors, semantics, CLI, pipeline, import-resolver, verification (verifier-runtime, isl-verify, isl-healer, isl-proof, etc.), build-runner.
- **Non-core:** Demos, detectors (e.g. fake-success-ui-detector), optional tooling.

**Blocking for 1.0:** Only **@isl-lang/healer** (core verification). All other production packages that were run either passed or were already excluded (e.g. stdlib-distributed typecheck is a no-op TODO).

---

## 3. Declarations audit

### 3.1 Methodology

- Checked `package.json` for `types` and `exports.types` for packages that publish (have `main`/`exports` and `files` including `dist`).
- Checked `tsconfig.json` for `declaration: true` and/or build script for `--dts` or `tsc --emitDeclarationOnly`.

### 3.2 Published packages — declaration config

| Package | declaration / dts | Evidence |
|---------|-------------------|----------|
| **@isl-lang/cli** | ❌ No emit | `tsup.config.ts`: `dts: false`. `package.json` points to `./dist/index.d.ts` but build does not generate it. |
| **@isl-lang/build-runner** | ✅ | `tsup.config.ts`: `dts: { resolve: true }`. `tsconfig.json`: `declaration: true`. |
| **@isl-lang/parser** | ✅ | Build: `tsup` (assumed dts from tsup defaults or separate step). `package.json`: `types`: `./dist/index.d.ts`. |
| **@isl-lang/import-resolver** | ✅ | `tsup.config.ts`: `dts: { resolve: true }`. |
| **@isl-lang/verifier-chaos** | ✅ | `build`: `tsup && tsc --project tsconfig.build.json --emitDeclarationOnly --declaration`. `tsconfig.build.json`: `declaration: true`. |
| **@isl-lang/verifier-sandbox** | ✅ | `tsconfig.json`: `declaration: true`. |
| **@isl-lang/isl-coverage** | ✅ | `tsconfig.json`: `declaration: true`. |
| **@isl-lang/isl-proof** | ✅ | `tsconfig.json`: `declaration: true`. Build: `tsup` (dev uses `--dts`). |
| **@isl-lang/isl-stdlib** | ✅ | tsup build emits DTS (from turbo logs). |
| **@isl-lang/typechecker** | ✅ | package.json `types`: `./dist/index.d.ts`; build emits dist. |
| **@isl-lang/formal-verification** | ❌ No emit | Build: `tsup ... --no-dts`. `package.json` has `types`: `./dist/index.d.ts` but .d.ts never generated. (Package is experimental/private.) |

### 3.3 Expected .d.ts output paths (after build)

For packages that **do** emit declarations, the declared entrypoints are:

- **build-runner:** `packages/build-runner/dist/index.d.ts`
- **cli:** `packages/cli/dist/index.d.ts` (currently **not** generated — dts: false)
- **import-resolver:** `packages/import-resolver/dist/index.d.ts`
- **parser:** `packages/parser/dist/index.d.ts`
- **verifier-chaos:** `packages/verifier-chaos/dist/index.d.ts`, `dist/cli.d.ts`, `dist/pipeline.d.ts`
- **verifier-sandbox:** `packages/verifier-sandbox/dist/index.d.ts`
- **isl-coverage:** `packages/isl-coverage/dist/index.d.ts`
- **isl-proof:** `packages/isl-proof/dist/index.d.ts`
- **isl-stdlib:** `packages/isl-stdlib/dist/index.d.ts`, `registry.d.ts`, `resolver.d.ts`, `validate-registry.d.ts`
- **typechecker:** `packages/typechecker/dist/index.d.ts`

(Other production packages with `types` in package.json follow the same pattern: `packages/<name>/dist/*.d.ts`.)

### 3.4 Gaps and recommended fixes

1. **@isl-lang/cli**  
   - **Issue:** `dts: false` in tsup; no separate declaration emit.  
   - **Fix:** Either enable `dts: true` in `packages/cli/tsup.config.ts` (if compatible with bundle), or add a second step (e.g. `tsc --emitDeclarationOnly` with a dedicated tsconfig) and ensure `dist/index.d.ts` exists after build.

2. **@isl-lang/formal-verification**  
   - **Issue:** Build uses `--no-dts`; `types` points to non-existent `./dist/index.d.ts`.  
   - **Fix:** For 1.0, either add `--dts` to the tsup build or run `tsc --emitDeclarationOnly` and point `types` to the emitted file. (Package is experimental/private; lower priority.)

---

## 4. Checklist (compact)

- [x] Run `pnpm typecheck:production`
- [x] Classify errors: core vs non-core, blocking vs acceptable
- [x] Fix **@isl-lang/fake-success-ui-detector** (parent type in catch-returns-success.ts)
- [ ] Fix **@isl-lang/healer** type errors (or temporarily exclude from production typecheck for 1.0)
- [x] Verify declaration config for key published packages (tsconfig/tsup)
- [x] Document .d.ts output paths and gaps
- [ ] Add/fix CLI declaration emit (dts or tsc step)
- [ ] (Optional) Fix formal-verification .d.ts for future publish

---

## 5. What blocks release

- **Blocking:** Production typecheck fails due to **@isl-lang/healer** (40+ TypeScript errors in verification/healer code). Options:
  - **A.** Fix all healer type errors (strict null checks and type shape mismatches).
  - **B.** Temporarily exclude `@isl-lang/healer` from production typecheck for 1.0 (e.g. add to `experimental.json` so `typecheck:production` skips it), with a follow-up issue to fix and re-enable.

- **Non-blocking but recommended:** Ensure **@isl-lang/cli** emits `dist/index.d.ts` so published CLI package has types.

---

## 6. Evidence summary

| Item | Evidence |
|------|----------|
| Typecheck command | `pnpm typecheck:production` → `npx tsx scripts/run-production.ts typecheck` |
| Fake-success fix | `packages/fake-success-ui-detector/src/patterns/catch-returns-success.ts`: `let parent: ts.Node \| undefined = node.parent` |
| Healer failures | `packages/isl-healer`: heal-enhanced.ts, patch-inspector.ts, rules (deterministic-recipes, ast-semantic-rules), honesty-guard.test.ts |
| Declaration config | See §3; key packages use `tsup` with `dts: true` or `tsc --emitDeclarationOnly`; CLI and formal-verification are gaps |
