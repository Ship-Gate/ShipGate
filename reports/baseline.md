# Monorepo Baseline Audit Report

**Generated:** 2026-02-09  
**Environment:** Node v24.12.0 · pnpm 8.15.0 · Turbo 2.8.1 · Windows  
**Workspace packages:** 219

---

## Executive Summary

| Command | Total Tasks | Passed | Failed | Pass Rate |
|---------|------------|--------|--------|-----------|
| `turbo typecheck --continue` | 193 | 184 | **9** | 95.3% |
| `turbo build --continue` | 210 | 192 | **18** | 91.4% |
| `turbo test --continue` | 440 | 262 | **178** | 59.5% |

> **Test note:** `turbo test` runs both build and test tasks (test depends on build). Of 178 failures, ~95 are build tasks and ~83 are test tasks. **33 packages have genuine test-only failures** (build passes, test fails). The rest cascade from build failures.

---

## Typecheck Failures (9 tasks)

| Package | First Error | Category | Effort |
|---------|-------------|----------|--------|
| `@isl-lang/firewall` | TS2694: Namespace 'Parser' has no exported member 'Language' | types | trivial |
| `@isl-lang/lsp` | TS2339: Property 'message' does not exist on type 'never' | types | trivial |
| `@isl-lang/verified-build` | TS18048: 'filesToCheck' is possibly 'undefined' | types | trivial |
| `@isl-lang/verifier-temporal` | TS2322: Type 'number \| undefined' not assignable to 'number' | types | trivial |
| `@isl-lang/verify-pipeline` | TS2459: 'TestRunnerOutput' not exported + 29 more | exports/types | medium |
| `checkout-api` | TS6142 --jsx not set, TS2307 module not found, TS2352 type mismatches | bad tsconfig | medium |
| `shipgate` | TS2307: Cannot find module '@isl-lang/core' | missing module | small |
| `shipgate-isl` | TS2307: Cannot find module '@isl-lang/parser' / '@isl-lang/isl-core' | missing module | small |

> `@isl-lang/verifier-temporal` fails both typecheck AND build from the same root cause.

---

## Build Failures (18 tasks)

### Types / Code Errors (5)

| Package | Error | Fix |
|---------|-------|-----|
| `@isl-lang/verifier-temporal` | TS2322 in `trace-timing.ts:931,954` — `number \| undefined` → `number` | Add `?? 0` defaults |
| `@isl-lang/verifier-runtime` | TS2741 in `truthpack-loader.ts:59` — missing `errors` property | Add `errors: []` to success return |
| `@isl-lang/lsp-server` | TS2339 in `actions.ts:183` — `isInDomain` not on type | Add missing methods to `ISLCodeActionProvider` |
| `@isl-lang/firewall` | TS2694 — `Parser.Language` not exported | (typecheck-only, build succeeds via tsup bundling) |
| `@isl-lang/verified-build` | TS18048 — possibly undefined | (typecheck-only, build succeeds) |

### Missing .d.ts / Declaration Files (5)

| Package | Missing From | Fix |
|---------|-------------|-----|
| `@isl-lang/runtime-interpreter` | `snapshot-testing/dist/index.d.ts` | Fix snapshot-testing tsup config to emit d.ts |
| `@isl-lang/feature-flags` | `runtime-interpreter/dist/index.d.cts` | Fix runtime-interpreter first (cascading) |
| `@isl-lang/interpreter` | `@isl-lang/runtime-interpreter` d.ts | Fix runtime-interpreter first (cascading) |
| `@isl-lang/policy-engine` | `stdlib-api/dist/crud.d.cts`, `stdlib-distributed/dist/*.d.ts` | Fix tsup multi-entry d.ts emission |
| `checkout-api` | `opentelemetry/dist/index.d.ts` | Build opentelemetry or add turbo dep |

### Bad tsconfig (3)

| Package | Error | Fix |
|---------|-------|-----|
| `@isl-lang/codegen-harness` | TS6059: `scripts/update-golden.ts` not under `rootDir` | Remove `scripts/**/*.ts` from include |
| `@isl-lang/adapters` | TS6307: `src/github/index.ts` not in file list | Add subdirs to tsconfig include |
| `@isl-lang/verifier-formal` | TS2835: Missing `.js` extensions (40+ files) | Set `moduleResolution: "bundler"` |

### Missing Dependencies (3)

| Package | Missing | Fix |
|---------|---------|-----|
| `@isl-lang/dashboard-web` | `@next/bundle-analyzer` | `pnpm add -D @next/bundle-analyzer` |
| `@isl-lang/marketplace-api` | `.prisma/client/default` + missing exports | `prisma generate` + export types |
| `@isl-lang/flagship-demo` | `isl` CLI command | Build shipgate CLI first |

### ESM/CJS / Module Resolution (2)

| Package | Error | Fix |
|---------|-------|-----|
| `shipgate` | esbuild can't resolve `@isl-lang/core` | Add to external list in tsup config |
| `shipgate-isl` | `require` not defined in ES module `esbuild.js` | Rename to `esbuild.cjs` |

### Other (2)

| Package | Error | Fix |
|---------|-------|-----|
| `@isl-lang/docs` | Starlight sidebar slug not found | Update sidebar config slugs |
| `@isl-lang/observability` | Source files not found, node_modules missing | `pnpm install` + verify src exists |

---

## Genuine Test Failures (33 packages)

These packages **build successfully** but have **failing tests**:

| # | Package | # | Package |
|---|---------|---|---------|
| 1 | `@isl-demos/e2e-login` | 18 | `@isl-lang/mock-server` |
| 2 | `@isl-lang/codegen-go` | 19 | `@isl-lang/mutation-testing` |
| 3 | `@isl-lang/codegen-terraform` | 20 | `@isl-lang/parser` |
| 4 | `@isl-lang/compliance` | 21 | `@isl-lang/phantom-dependency-scanner` |
| 5 | `@isl-lang/core` | 22 | `@isl-lang/pipeline` |
| 6 | `@isl-lang/diff-viewer` | 23 | `@isl-lang/semantic-analysis` |
| 7 | `@isl-lang/distributed-tracing` | 24 | `@isl-lang/sentry` |
| 8 | `@isl-lang/docs-advanced` | 25 | `@isl-lang/snapshot-testing` |
| 9 | `@isl-lang/e2e-tests` | 26 | `@isl-lang/stdlib-audit` |
| 10 | `@isl-lang/error-catalog` | 27 | `@isl-lang/stdlib-rate-limit` |
| 11 | `@isl-lang/fuzzer` | 28 | `@isl-lang/stdlib-workflow` |
| 12 | `@isl-lang/github-action` | 29 | `@isl-lang/verify-pipeline` |
| 13 | `@isl-lang/hallucination-scanner` | 30 | `@isl-lang/versioner` |
| 14 | `@isl-lang/import-resolver` | 31 | `playwright-showcase` |
| 15 | `@isl-lang/inference` | 32 | `repo-isl-verified` |
| 16 | `@isl-lang/isl-cli` | 33 | — |
| 17 | `@isl-lang/islstudio` | | |

---

## Fastest Unblock Path — Top 15

Ranked by: downstream dependents unblocked × inverse effort. Fix these first.

| Rank | Package | Fix | Effort | Unblocks |
|------|---------|-----|--------|----------|
| **1** | `@isl-lang/verifier-temporal` | `trace-timing.ts:931,954` — add `?? 0` to two optional numbers | **trivial** | shipgate, checkout-api, verifier-temporal tests |
| **2** | `@isl-lang/runtime-interpreter` | Fix snapshot-testing d.ts ref in tsconfig | **small** | interpreter, feature-flags (3 pkgs) |
| **3** | `@isl-lang/verifier-runtime` | `truthpack-loader.ts:59` — add `errors: []` | **trivial** | verify-pipeline |
| **4** | `shipgate` (cli) | Add `@isl-lang/core` to esbuild external | **trivial** | flagship-demo, CLI users |
| **5** | `shipgate-isl` (vscode) | Rename `esbuild.js` → `esbuild.cjs` | **trivial** | VSCode extension users |
| **6** | `@isl-lang/lsp-server` | Add 3 missing methods to `ISLCodeActionProvider` | **small** | shipgate-isl |
| **7** | `@isl-lang/firewall` | Update `Parser.Language` → current parser export name | **trivial** | verified-build |
| **8** | `@isl-lang/codegen-harness` | Remove `scripts/**/*.ts` from tsconfig include | **trivial** | — |
| **9** | `@isl-lang/adapters` | Add subdirs to tsconfig include | **trivial** | — |
| **10** | `@isl-lang/dashboard-web` | `pnpm add -D @next/bundle-analyzer` | **trivial** | — |
| **11** | `@isl-lang/observability` | `pnpm install` + verify src files | **trivial** | — |
| **12** | `@isl-lang/docs` | Fix Starlight sidebar slugs | **trivial** | — |
| **13** | `@isl-lang/verifier-formal` | Set `moduleResolution: "bundler"` in tsconfig | **medium** | — |
| **14** | `@isl-lang/verify-pipeline` | Export stage types, fix `Identifier.value` → `.name` | **medium** | — |
| **15** | `@isl-lang/policy-engine` | Fix stdlib-api/stdlib-distributed multi-entry d.ts | **medium** | — |

### Quick Win Summary

**7 trivial fixes (< 5 min each)** would unblock ranks 1, 3, 4, 5, 7, 8, 9, 10, 11, 12 — clearing **12 of 18 build failures** and **4 of 9 typecheck failures**.

---

## Error Category Distribution

| Category | Count | % of Failures |
|----------|-------|---------------|
| Type errors | 7 | 26% |
| Missing d.ts | 5 | 19% |
| Bad tsconfig | 4 | 15% |
| Missing dependency | 3 | 11% |
| Missing module / external | 3 | 11% |
| Exports not public | 2 | 7% |
| ESM/CJS mismatch | 1 | 4% |
| Missing install | 1 | 4% |
| Bad config (non-TS) | 1 | 4% |

---

## Repeatability

### Exact commands to reproduce

```bash
# Prerequisites: Node >=18, pnpm >=8
node --version   # v24.12.0
pnpm --version   # 8.15.0

# 1. Typecheck
pnpm turbo typecheck --continue 2>&1 | tee reports/typecheck.log
# Expected: 184/193 passed

# 2. Build
pnpm turbo build --continue 2>&1 | tee reports/build.log
# Expected: 192/210 passed

# 3. Test
pnpm turbo test --continue 2>&1 | tee reports/test.log
# Expected: 262/440 passed

# 4. Regenerate this report
npx tsx scripts/generate-baseline.ts
```

### Deterministic generation script

```
scripts/generate-baseline.ts
```

Run `npx tsx scripts/generate-baseline.ts` to regenerate `reports/baseline.json` and `reports/baseline.md`.

---

## Dependency Graph: Key Hubs

Packages with the most downstream dependents (from turbo build graph):

| Package | Direct Build Dependents |
|---------|------------------------|
| `@isl-lang/parser` | evaluator, verifier, verifier-runtime, static-analyzer, test-generator, typechecker, verify-pipeline, spec-assist, spec-federation, shipgate, @shipgate/sdk |
| `@isl-lang/isl-core` | verifier-chaos, verifier-formal, verifier-security, verifier-temporal, stdlib-cache, stdlib-email, stdlib-messaging, stdlib-notifications, streaming, state-machine, versioner, spec-reviewer, verify-pipeline |
| `@isl-lang/stdlib-core` | stdlib-ai, stdlib-events, stdlib-observability, stdlib-queue, stdlib-realtime, stdlib-search, stdlib-workflow |
| `@isl-lang/gate` | verified-build, verify-pipeline, shipgate, @shipgate/sdk |
| `@isl-lang/evidence` | trust-score, verified-build |
| `@isl-lang/trace-format` | static-analyzer, test-runtime, verifier-temporal, verify-pipeline |
| `@isl-lang/evaluator` | verify-pipeline, shipgate |
| `@isl-lang/core` | @shipgate/sdk, shipgate |

> **Critical path:** `parser` and `isl-core` are the two highest-fan-out packages. Both currently build clean. Protect them.
