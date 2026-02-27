# Package Decisions for 1.0 — Below-Threshold Triage

**Agent:** 06 — Package Readiness Triage Lead  
**Date:** 2026-02-09  
**Scope:** Packages below readiness threshold (75%) that are in or adjacent to production config.

This document records the triage decision for each package: **SHIP**, **QUARANTINE**, or **NEXT**, and the rationale. The goal is to ensure 1.0 does not ship packages that overstate readiness.

---

## Summary Table

| Package | Build | Tests | Used-by-core | Decision |
|---------|--------|--------|----------------|----------|
| @isl-lang/codegen | ❌ (DTS) | No tests | Yes (umbrella) | **NEXT** |
| @isl-lang/codegen-openapi | ✅ | Yes | Via codegen | **NEXT** |
| @isl-lang/codegen-tests | ❌ | Yes | Yes (verify, e2e) | **QUARANTINE** |
| @isl-lang/isl-verify | ❌ | No | Yes (cli, gate, e2e) | **QUARANTINE** |
| @isl-lang/language-server | ✅ | No | LSP tier (not vscode) | **NEXT** |
| @isl-lang/semantics | ✅ | Yes | Core tier (no deps) | **SHIP** |
| @isl-lang/stdlib-auth | ✅ | Yes | stdlib-saas, examples | **SHIP** |
| @isl-lang/codegen-graphql | ✅ | No | Via codegen | **NEXT** |
| @isl-lang/codegen-python | ✅ | No | Via codegen | **NEXT** |
| @isl-lang/codegen-runtime | ❌ (DTS) | No | mcp-server | **NEXT** |

---

## 1. @isl-lang/codegen

- **Build:** Fails on DTS step: `Module '"@isl-lang/codegen-go"' has no exported member 'default'` (codegen/go.ts re-exports default from codegen-go).
- **Tests:** No test files; script uses `vitest run --passWithNoTests`. Readiness: 63%.
- **Used-by-core:** Yes. Umbrella package for codegen; consumed by build-runner (via codegen-tests) and CLI codegen flows. Depends on codegen-python, codegen-openapi, codegen-graphql, codegen-types, codegen-rust, codegen-go, codegen-validators, codegen-tests, codegen-mocks, codegen-docs.

**Decision: NEXT**  
Publish only under dist-tag `next` (or clearly marked experimental) until the codegen-go default export is fixed and DTS build passes. Do not ship as default 1.0 stable.

---

## 2. @isl-lang/codegen-openapi

- **Build:** Passes (tsup ESM/CJS/DTS).
- **Tests:** Test files and script present; readiness 63%. Marked **private: true** in package.json.
- **Used-by-core:** Only as dependency of @isl-lang/codegen.

**Decision: NEXT**  
Keep **private: true** for 1.0. If published, use dist-tag `next` and document as experimental. Prefer not listing in default 1.0 install path until codegen umbrella is stable.

---

## 3. @isl-lang/codegen-tests

- **Build:** Fails. `tsc` cannot resolve `@isl-lang/parser` in this package’s context (workspace resolution/ordering), and many files have implicit `any` (violates project rules).
- **Tests:** Test files and script exist; real implementation but type-unsafe.
- **Used-by-core:** Yes. Direct dependency of build-runner, isl-verify, codegen, demos (flagship-auth-payments), and tests/e2e. Critical for verification and e2e pipeline.

**Decision: QUARANTINE**  
Do not publish. Keep in workspace for internal use. Remove from production publish list and from any “public 1.0” story until:
- Build passes (parser resolution and/or build order fixed).
- Implicit `any` removed and typecheck passes.

See [Quarantine implementation](#quarantine-implementation) below for exact steps.

---

## 4. @isl-lang/isl-verify

- **Build:** Fails. Missing dependency `@isl-lang/verifier-sandbox` (not resolved at build time). Additional TS6307 errors: runner/reporter subpaths not listed in tsconfig file list.
- **Tests:** No test files; script uses `vitest run --passWithNoTests`. Readiness 63%.
- **Used-by-core:** Yes. Used by cli, isl-gate, isl-cli, github-action, compliance, comparator, mcp-server, slack-bot, agent-os, demos, tests/e2e. Core verification path.

**Decision: QUARANTINE**  
Do not publish until:
- Dependency on `@isl-lang/verifier-sandbox` is added to package.json and sandbox is built first, or sandbox is inlined/stubbed for 1.0.
- tsconfig include/list fixed so runner and reporter are part of the project.

Keep in workspace for internal use; exclude from npm publish and default 1.0 prod build path until build is green.

See [Quarantine implementation](#quarantine-implementation) below.

---

## 5. @isl-lang/language-server

- **Build:** Passes (`tsc`).
- **Tests:** No test files; script uses `vitest run --passWithNoTests`. Readiness 63%.
- **Used-by-core:** Listed in production.lsp in experimental.json. VS Code extension uses **@isl-lang/lsp-server**, not this package. So this is an alternate LSP implementation (e.g. isl-core-based), not the one in the shipped extension.

**Decision: NEXT**  
Publish only under dist-tag `next` or clearly marked as experimental. Document that the primary LSP for the IDE is @isl-lang/lsp-server; this package is an alternative implementation.

---

## 6. @isl-lang/semantics

- **Build:** Passes (`tsc`). Readiness report had noted “no dist/” at scan time; build succeeds when run.
- **Tests:** Test files and script present.
- **Used-by-core:** Listed in production.core in experimental.json. No other package declares it as a dependency in package.json; it is part of the core semantics API surface.

**Decision: SHIP**  
Safe to include in 1.0. Ensure `pnpm --filter @isl-lang/semantics build` is run before release so dist/ is present in the published artifact.

---

## 7. @isl-lang/stdlib-auth

- **Build:** Passes (`tsc`). Readiness had noted “no dist/” at scan time; build succeeds when run.
- **Tests:** Test files and script present. Good README and exports.
- **Used-by-core:** Used by stdlib-saas and by stdlib-auth examples (express-app, fastify-app). Required for the stdlib auth story.

**Decision: SHIP**  
Safe to include in 1.0. Ensure build is run before release so dist/ is present.

---

## 8. @isl-lang/codegen-graphql

- **Build:** Passes (tsup).
- **Tests:** No test files; readiness 50%. Marked **private: true**.
- **Used-by-core:** Only as dependency of @isl-lang/codegen.

**Decision: NEXT**  
Keep **private: true** for 1.0. If published, use dist-tag `next` and document as experimental.

---

## 9. @isl-lang/codegen-python

- **Build:** Passes (tsup ESM/CJS; DTS observed in run).
- **Tests:** No test files; readiness 50%. Marked **private: true**.
- **Used-by-core:** Only as dependency of @isl-lang/codegen.

**Decision: NEXT**  
Same as codegen-graphql: keep private for 1.0; if published, use dist-tag `next` and mark experimental.

---

## 10. @isl-lang/codegen-runtime

- **Build:** ESM build succeeds; DTS build fails (TS6307: generator.ts not in file list of project — tsup/tsconfig project layout).
- **Tests:** No test files; script uses `vitest run --passWithNoTests`.
- **Used-by-core:** Used by mcp-server. Marked **private: true**.

**Decision: NEXT**  
Publish only under dist-tag `next` (or keep private) until DTS build is fixed. Do not ship as default 1.0 stable.

---

## Quarantine implementation

Apply only to packages labeled **QUARANTINE**: @isl-lang/codegen-tests, @isl-lang/isl-verify.

### 1. package.json

- Ensure **"private": true** so they are never published by `pnpm publish` or changeset publish.
- No change required if already private (codegen-tests is already private; isl-verify is not — add `"private": true` for isl-verify if we want to block publish until build is fixed).

### 2. experimental.json / run-production.ts — DONE

- **Option A:** Move both packages from `production` into a dedicated `quarantine` array in experimental.json, and in `scripts/run-production.ts` treat `quarantine` like `experimental` (exclude from production build/typecheck/test).
- **Option B:** Move them into `experimental` (e.g. under a key like `quarantine_build_broken`) so they are excluded from production pipeline by the existing “exclude experimental” logic.

**Implemented:** `quarantine` section added to experimental.json; both packages removed from production lists. run-production.ts excludes quarantine.packages from the production filter.

### 3. Publish ignore

- **changeset:** Do not add these packages to any release changeset until they are un-quarantined.
- **Scripts:** In `scripts/publish.ts` or equivalent, skip packages in the quarantine list (or rely on `private: true` so they are never selected for publish).

### 4. Workspace filters

- Turbo/CI: Production pipeline already excludes experimental (and quarantine if implemented as above). No need to change workspace package list; they remain in `packages/*` for local and internal use.
- Optional: In release manifest or release notes, list quarantined packages with a short note: “Not published in 1.0; build broken; internal use only.”

### 5. PR checklist (for the PR that applies quarantine)

- [x] experimental.json: add quarantine category and list codegen-tests, isl-verify.
- [x] run-production.ts: exclude quarantine category when building production filter.
- [ ] isl-verify: add `"private": true` if we intend to block publish until build is fixed (optional).
- [ ] README or RELEASE_1_0.md: note that codegen-tests and isl-verify are not published in 1.0 and are internal until build passes.

---

## NEXT packages: publish under dist-tag `next`

For packages labeled **NEXT**, if they are published at all for 1.0:

- Use npm dist-tag **next**: e.g. `pnpm publish --tag next`.
- In docs (e.g. EXPERIMENTAL.md or README), state that these packages are available under `next` and are not part of the stable 1.0 contract.
- Optionally keep **private: true** for codegen-openapi, codegen-graphql, codegen-python, codegen-runtime so they are not published by default; only the umbrella or explicitly opted-in consumers use them.

---

## References

- Readiness report: `reports/readiness.json` (threshold 75%; all 10 packages below).
- Production filter: `scripts/run-production.ts` + `experimental.json`.
- Stub inventory: `reports/stub-inventory.json` (some of these packages have stub/placeholder hits).
