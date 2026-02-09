# Shipgate 1.0 Release Board

**Release:** Shipgate / ISL v1.0.0  
**Last Updated:** 2026-02-09  
**Orchestrator:** Release Orchestrator Agent

---

## GO / NO-GO Criteria (Minimal)

| Criterion | Required |
|-----------|----------|
| **CLI works** via `npx shipgate --version` and global install `shipgate --version` | GO |
| **Core build + typecheck + critical tests** pass | GO |
| **No broken packages** accidentally published (quarantine incomplete packages) | GO |

**Verdict:** See [RELEASE_EVIDENCE_1_0.md](./RELEASE_EVIDENCE_1_0.md) for evidence and final GO/NO-GO.

---

## 1. Pre-Release

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Update README.md status to v1.0.0 | Docs agent | ✅ Done | `README.md` | Changed from pre-release to v1.0.0 |
| Fix `@isl-lang/stdlib-idempotency` tsconfig | Build agent | ✅ Done | `packages/stdlib-idempotency/tsconfig.json` | rootDir restriction removed |
| Verify CLI works (npx + global) | Orchestrator | ⚠️ Partial | [RELEASE_EVIDENCE_1_0.md](./RELEASE_EVIDENCE_1_0.md) | Local `node packages/cli/dist/cli.cjs --version` → 1.0.0; fresh build fails; npx timed out |

---

## 2. Build

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Run `pnpm build:production` | Orchestrator | 🔴 Not run | — | Blocked by CLI build dependency; see Build CLI |
| Build core packages (parser, typechecker, evaluator, cli, isl-core, verifier-runtime) | Build agent | ⚠️ Mixed | [RELEASE_EVIDENCE_1_0.md](./RELEASE_EVIDENCE_1_0.md) | CLI build fails (see evidence) |
| Build CLI (shipgate) | Build agent | 🔴 Fail | `pnpm --filter shipgate run build` | Parser dist missing; duplicate symbols; unresolved isl-discovery/codegen-python/codegen-graphql; await in non-async |

---

## 3. Typecheck

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Run `pnpm typecheck:production` | Orchestrator | 🔴 Fail | [RELEASE_EVIDENCE_1_0.md](./RELEASE_EVIDENCE_1_0.md) | `@isl-lang/fake-success-ui-detector` TS2339 (Property 'parent' on type 'never') |
| No critical type errors in production packages | Typecheck agent | 🔴 Blocked | — | 1 package blocks full run |
| `.d.ts` generated for published packages | Build agent | ⏳ Pending | — | Verify post-build |

---

## 4. Tests

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Run `pnpm test:production` | Orchestrator | ⏳ Not run | — | Optional for minimal GO |
| Run `pnpm test:critical` | Orchestrator | 🔴 Fail | [RELEASE_EVIDENCE_1_0.md](./RELEASE_EVIDENCE_1_0.md) | No package `@isl-lang/isl-pipeline` in workspace (actual name: `@isl-lang/pipeline`) |
| CLI smoke tests `pnpm --filter shipgate test:smoke` | Orchestrator | ⏳ Blocked | — | Smoke expects `dist/cli.js`; build outputs `dist/cli.cjs` |

---

## 5. Packages

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Production packages 75% readiness (32/42+) | Readiness script | ✅ Done | `reports/readiness.json`, `reports/readiness.md` | 136 ready, 88 not ready; threshold 75% |
| Packages below threshold accepted for 1.0 | Product | ⏳ Decision | `reports/readiness.md` | codegen*, isl-verify, language-server, semantics, stdlib-auth, etc. |
| CLI published shipgate v1.0.0 | Publish agent | ✅ Asserted | npm package `shipgate@1.0.0` | Treat as true; verify with `npm view shipgate version` |
| Core packages published (parser, typechecker, evaluator, isl-core) | Publish agent | ⏳ Verify | — | If needed for consumers |

---

## 6. Docs

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| README version/status | Docs agent | ⏳ Check | `README.md` | Align with v1.0.0 |
| Release notes | Docs agent | ✅ Exists | `docs/RELEASE_NOTES_1_0.md` | Review for accuracy |
| Homepage / quickstart | Docs agent | ⏳ Verify | https://shipgate.dev | Manual check |
| Release board & evidence | Orchestrator | ✅ Done | This file, `docs/RELEASE_EVIDENCE_1_0.md` | — |

---

## 7. CI

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| `.github/workflows/release-shipgate.yml` | CI agent | ✅ Exists | `.github/workflows/release-shipgate.yml` | Tags: shipgate@*, v*; verifies dist/cli.js (mismatch with current dist/cli.cjs) |
| Release workflow dry-run | CI agent | ⏳ Optional | — | — |
| CI badges in README | Docs agent | ⏳ Optional | — | — |

---

## 8. Release

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Create tag v1.0.0 / shipgate@1.0.0 | Release agent | ⏳ Pending | — | After GO |
| `pnpm release:manifest` | Release agent | ⏳ Pending | `scripts/generate-release-manifest.ts` | — |
| `pnpm compliance:all` | Compliance agent | ⏳ Pending | `scripts/compliance/` | — |

---

## 9. Post-Release

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Fresh install `npm install -g shipgate` | QA | ⏳ Pending | — | — |
| `shipgate --version` shows 1.0.0 | QA | ⏳ Pending | — | — |
| `npx shipgate init` works | QA | ⏳ Pending | — | npx timed out in pre-release check |

---

## 10. Comms

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Draft announcement | Comms agent | ⏳ Pending | — | — |
| Support channels / FAQ | Comms agent | ⏳ Pending | — | — |

---

## 11. Rollback

| Item | Owner | Status | Evidence | Notes |
|------|--------|--------|----------|--------|
| Document rollback procedure | Release agent | ⏳ Pending | — | — |
| Critical issues that require rollback | Release agent | ⏳ Pending | — | — |
| Hotfix process | Release agent | ⏳ Pending | — | — |

---

## Quarantine (Do Not Publish / Mark Experimental)

- Packages failing build/typecheck that are in production tier: fix or move to experimental.
- **CLI** until build passes from clean repo (parser build order, duplicate symbols, dynamic imports).
- **test:critical** script: fix filter to use `@isl-lang/pipeline` (not `@isl-lang/isl-pipeline`).
- **Smoke test**: align with build output (`cli.cjs` vs `cli.js`); or CI to expect `cli.cjs`.

---

*Board maintained by Shipgate 1.0 Release Orchestrator. Evidence in `docs/RELEASE_EVIDENCE_1_0.md`.*
