# Release Manifest 1.0 — Metadata & Tag Manager

**Agent:** 13 — Manifest & Tag Manager  
**Date:** 2026-02-09  
**Purpose:** Exact release metadata, tag convention, manifest generation, and version consistency for Release 1.0.

---

## 1. Tag convention

**Decision: use `v1.0.0`** (not `shipgate@1.0.0`).

| Option | Recommendation | Reason |
|--------|----------------|--------|
| **v1.0.0** | **Yes** | Standard semver git tag; works with GitHub Releases, CI, and tooling; one tag for the whole repo/commit. |
| shipgate@1.0.0 | No | `shipgate@1.0.0` is an **npm package name** (the CLI in `packages/cli`). Git tags of the form `name@version` are non-standard and can conflict with npm install syntax in docs/scripts. |

**Usage:** Create git tag `v1.0.0` on the release commit after `pnpm release` (or after the commit that includes the manifest and version bumps). Do not use `shipgate@1.0.0` as the git tag.

---

## 2. Release manifest command and output

- **Command:** `pnpm release:manifest`
- **Implementation:** `npx tsx scripts/generate-release-manifest.ts`
- **Verify:** `pnpm release:manifest:verify` or `npx tsx scripts/generate-release-manifest.ts --verify [path]`
- **Output file:** `reports/release-manifest.json`

The manifest records:

- **Schema:** `schemaVersion: "1.0.0"`
- **Git:** `commitSha`, `branch`, `tag`, `dirty`
- **Environment:** `nodeVersion`, `pnpmVersion`, `os`, `arch`, `ci`
- **Lockfile:** SHA-256 of `pnpm-lock.yaml`
- **Packages:** all workspace packages (name, version, private)
- **Commands:** `buildCommand`, `testCommand`

**Note:** The script does not output per-package commit hash or per-package build artifact path. The **commit hash applies to the whole repository**. Build artifact paths follow the convention below.

---

## 3. Canonical manifest: package → version → commit → artifact path

Single **commit hash** for the release tree: **`38a68b18c334cda0348324cc11430c83e9f862cf`** (from last `pnpm release:manifest` run; re-run at release time to refresh).

**Build artifact path convention:** For each built package, the artifact directory is:

`packages/<package-dir>/dist`

where `<package-dir>` is the folder under `packages/` (e.g. `evaluator`, `cli`, `parser`). Entry points are declared in each package’s `package.json` (`main`, `types`, `exports`), usually under `./dist/`.

### Machine-readable manifest

- **Path:** `reports/release-manifest.json`
- **Generated:** `pnpm release:manifest`

### Human-readable summary (public packages only)

| Package | Version | Commit (repo) | Build artifact path |
|---------|----------|----------------|----------------------|
| @isl-lang/cli-ux | 0.1.0 | 38a68b18c334 | packages/cli-ux/dist |
| @isl-lang/codegen | 0.1.0 | 38a68b18c334 | packages/codegen/dist |
| @isl-lang/codegen-core | 0.1.0 | 38a68b18c334 | packages/codegen-core/dist |
| @isl-lang/codegen-types | 0.1.0 | 38a68b18c334 | packages/codegen-types/dist |
| @isl-lang/contract-testing | 0.1.0 | 38a68b18c334 | packages/contract-testing/dist |
| @isl-lang/core | 0.1.0 | 38a68b18c334 | packages/core/dist |
| @isl-lang/coverage | 0.1.0 | 38a68b18c334 | packages/isl-coverage/dist |
| @isl-lang/dashboard-api | 1.0.0 | 38a68b18c334 | packages/dashboard-api/dist |
| @isl-lang/errors | 1.0.0 | 38a68b18c334 | packages/errors/dist |
| @isl-lang/evaluator | 0.1.0 | 38a68b18c334 | packages/evaluator/dist |
| @isl-lang/evidence-schema | 1.0.0 | 38a68b18c334 | packages/isl-evidence/dist (or evidence-schema subpath) |
| @isl-lang/gate | 0.1.0 | 38a68b18c334 | packages/isl-gate/dist |
| @isl-lang/healer | 0.1.0 | 38a68b18c334 | packages/isl-healer/dist |
| @isl-lang/import-resolver | 0.1.0 | 38a68b18c334 | packages/import-resolver/dist |
| @isl-lang/isl-core | 0.1.0 | 38a68b18c334 | packages/isl-core/dist |
| @isl-lang/isl-coverage | 1.0.0 | 38a68b18c334 | packages/isl-coverage/dist |
| @isl-lang/isl-discovery | 0.1.0 | 38a68b18c334 | packages/isl-discovery/dist |
| @isl-lang/isl-lsp | 0.1.0 | 38a68b18c334 | packages/isl-lsp/dist |
| @isl-lang/isl-smt | 0.1.0 | 38a68b18c334 | packages/isl-smt/dist |
| @isl-lang/isl-stdlib | 1.0.0 | 38a68b18c334 | packages/isl-stdlib/dist |
| @isl-lang/isl-verify | 0.1.0 | 38a68b18c334 | packages/isl-verify/dist |
| @isl-lang/java-resolver | 0.1.0 | 38a68b18c334 | packages/java-resolver/dist |
| @isl-lang/language-server | 1.0.0 | 38a68b18c334 | packages/language-server/dist |
| @isl-lang/lsp-core | 0.1.0 | 38a68b18c334 | packages/lsp-core/dist |
| @isl-lang/lsp-server | 0.1.0 | 38a68b18c334 | packages/lsp-server/dist |
| @isl-lang/observability | 0.1.0 | 38a68b18c334 | packages/observability/dist |
| @isl-lang/parser | 0.1.0 | 38a68b18c334 | packages/parser/dist |
| @isl-lang/pbt | 1.0.0 | 38a68b18c334 | packages/isl-pbt/dist |
| @isl-lang/pipeline | 0.1.0 | 38a68b18c334 | packages/isl-pipeline/dist |
| @isl-lang/proof | 0.1.0 | 38a68b18c334 | packages/isl-proof/dist |
| @isl-lang/prover | 0.1.0 | 38a68b18c334 | packages/prover/dist |
| @isl-lang/reality-probe | 0.1.0 | 38a68b18c334 | packages/reality-probe/dist |
| @isl-lang/repl | 0.1.0 | 38a68b18c334 | packages/repl/dist |
| @isl-lang/runtime-adapters | 0.1.0 | 38a68b18c334 | packages/runtime-adapters/dist |
| @isl-lang/runtime-sdk | 0.1.0 | 38a68b18c334 | packages/runtime-sdk/dist |
| @isl-lang/runtime-universal | 1.0.0 | 38a68b18c334 | packages/runtime-universal/dist |
| @isl-lang/runtime-verify | 0.1.0 | 38a68b18c334 | packages/runtime-verify/dist |
| @isl-lang/sdk-react-native | 1.0.0 | 38a68b18c334 | packages/sdk-react-native/dist |
| @isl-lang/sdk-typescript | 0.1.0 | 38a68b18c334 | packages/sdk-typescript/dist |
| @isl-lang/sdk-web | 1.0.0 | 38a68b18c334 | packages/sdk-web/dist |
| @isl-lang/secrets-hygiene | 0.1.0 | 38a68b18c334 | packages/secrets-hygiene/dist |
| @isl-lang/semantic-analysis | 0.1.0 | 38a68b18c334 | packages/isl-semantic-analysis/dist |
| @isl-lang/semantics | 0.1.0 | 38a68b18c334 | packages/semantics/dist |
| @isl-lang/simulator | 0.1.0 | 38a68b18c334 | packages/simulator/dist |
| @isl-lang/snapshot-testing | 0.1.0 | 38a68b18c334 | packages/snapshot-testing/dist |
| @isl-lang/solver-z3-wasm | 0.1.0 | 38a68b18c334 | packages/solver-z3-wasm/dist |
| @isl-lang/static-analyzer | 0.1.0 | 38a68b18c334 | packages/static-analyzer/dist |
| @isl-lang/stdlib-actors | 0.1.0 | 38a68b18c334 | packages/stdlib-actors/dist |
| @isl-lang/stdlib-analytics | 1.0.0 | 38a68b18c334 | packages/stdlib-analytics/dist |
| @isl-lang/stdlib-api | 0.1.0 | 38a68b18c334 | packages/stdlib-api/dist |
| @isl-lang/stdlib-audit | 1.0.0 | 38a68b18c334 | packages/stdlib-audit/dist |
| @isl-lang/stdlib-auth | 1.0.0 | 38a68b18c334 | packages/stdlib-auth/dist |
| @isl-lang/stdlib-billing | 1.0.0 | 38a68b18c334 | packages/stdlib-billing/dist |
| @isl-lang/stdlib-cache | 0.1.0 | 38a68b18c334 | packages/stdlib-cache/dist |
| @isl-lang/stdlib-core | 0.1.0 | 38a68b18c334 | packages/stdlib-core/dist |
| @isl-lang/stdlib-database | 0.1.0 | 38a68b18c334 | packages/stdlib-database/dist |
| @isl-lang/stdlib-distributed | 1.0.0 | 38a68b18c334 | packages/stdlib-distributed/dist |
| @isl-lang/stdlib-email | 0.1.0 | 38a68b18c334 | packages/stdlib-email/dist |
| @isl-lang/stdlib-events | 0.1.0 | 38a68b18c334 | packages/stdlib-events/dist |
| @isl-lang/stdlib-files | 1.0.0 | 38a68b18c334 | packages/stdlib-files/dist |
| @isl-lang/stdlib-http | 0.1.0 | 38a68b18c334 | packages/stdlib-http/dist |
| @isl-lang/stdlib-idempotency | 1.0.0 | 38a68b18c334 | packages/stdlib-idempotency/dist |
| @isl-lang/stdlib-messaging | 1.0.0 | 38a68b18c334 | packages/stdlib-messaging/dist |
| @isl-lang/stdlib-notifications | 1.0.0 | 38a68b18c334 | packages/stdlib-notifications/dist |
| @isl-lang/stdlib-observability | 0.1.0 | 38a68b18c334 | packages/stdlib-observability/dist |
| @isl-lang/stdlib-payments | 1.0.0 | 38a68b18c334 | packages/stdlib-payments/dist |
| @isl-lang/stdlib-queue | 0.1.0 | 38a68b18c334 | packages/stdlib-queue/dist |
| @isl-lang/stdlib-rate-limit | 1.0.0 | 38a68b18c334 | packages/stdlib-rate-limit/dist |
| @isl-lang/stdlib-realtime | 0.1.0 | 38a68b18c334 | packages/stdlib-realtime/dist |
| @isl-lang/stdlib-runtime | 1.0.0 | 38a68b18c334 | packages/stdlib-runtime/dist |
| @isl-lang/stdlib-saas | 1.0.0 | 38a68b18c334 | packages/stdlib-saas/dist |
| @isl-lang/stdlib-scheduling | 1.0.0 | 38a68b18c334 | packages/stdlib-scheduling/dist |
| @isl-lang/stdlib-search | 0.1.0 | 38a68b18c334 | packages/stdlib-search/dist |
| @isl-lang/stdlib-workflow | 0.1.0 | 38a68b18c334 | packages/stdlib-workflow/dist |
| @isl-lang/test-generator | 0.1.0 | 38a68b18c334 | packages/test-generator/dist |
| @isl-lang/test-runtime | 0.1.0 | 38a68b18c334 | packages/test-runtime/dist |
| @isl-lang/test-runtime-legacy | 0.1.0 | 38a68b18c334 | packages/test-runtime-legacy/dist |
| @isl-lang/trace-format | 0.1.0 | 38a68b18c334 | packages/isl-trace-format/dist |
| @isl-lang/trust-score | 0.1.0 | 38a68b18c334 | packages/trust-score/dist |
| @isl-lang/typechecker | 0.1.0 | 38a68b18c334 | packages/typechecker/dist |
| @isl-lang/verified-build | 0.1.0 | 38a68b18c334 | packages/verified-build/dist |
| @isl-lang/verifier | 0.1.0 | 38a68b18c334 | packages/verifier/dist |
| @isl-lang/verifier-chaos | 0.2.0 | 38a68b18c334 | packages/verifier-chaos/dist |
| @isl-lang/verifier-formal | 0.1.0 | 38a68b18c334 | packages/verifier-formal/dist |
| @isl-lang/verifier-runtime | 0.1.0 | 38a68b18c334 | packages/verifier-runtime/dist |
| @isl-lang/verifier-sandbox | 1.0.0 | 38a68b18c334 | packages/verifier-sandbox/dist |
| @isl-lang/verifier-security | 0.1.0 | 38a68b18c334 | packages/verifier-security/dist |
| @isl-lang/verifier-temporal | 0.1.0 | 38a68b18c334 | packages/verifier-temporal/dist |
| @isl-lang/verify-pipeline | 0.1.0 | 38a68b18c334 | packages/isl-verify-pipeline/dist |
| @shipgate/sdk | 0.1.0 | 38a68b18c334 | packages/sdk/dist |
| shipgate | 1.0.0 | 38a68b18c334 | packages/cli/dist |
| shipgate-isl | 0.1.0 | 38a68b18c334 | packages/vscode/dist (or packaged extension) |

**Totals (from last manifest run):** 224 workspace packages, **92 public**. Commit and lockfile hash above are from the manifest run on 2026-02-09; regenerate with `pnpm release:manifest` at release time and update this doc if needed.

---

## 4. Version consistency: root vs workspace

| Location | Current version | Notes |
|----------|-----------------|--------|
| **Root** `package.json` | **0.1.0** | `isl-lang-monorepo` (private) |
| **Workspace packages** | Mixed | 0.1.0, 1.0.0, 0.2.0 (e.g. verifier-chaos), 2.0.0 (truthpack-v2) |
| **shipgate (CLI)** | 1.0.0 | Primary user-facing package |
| **Public packages at 1.0.0** | Many | stdlib-*, evidence, errors, sdk-web, language-server, etc. |

Root is the monorepo container and is not published; workspace packages are versioned (and optionally published) independently. Versions are **not** required to match the root.

---

## 5. Recommendation: root version for Release 1.0

**Recommendation: set root `package.json` version to `1.0.0` for Release 1.0.**

| Option | Recommendation | Consequences |
|--------|----------------|--------------|
| **Bump root to 1.0.0** | **Recommended** | Aligns monorepo version with “Release 1.0”; clearer for docs, CI, and release automation; no publish impact (root is private). |
| Keep root at 0.1.0 | Acceptable | Some confusion (“1.0 release” with root 0.1.0); no functional impact. |

**How to apply:** In root `package.json`, set `"version": "1.0.0"`. Then run `pnpm release:manifest` again so the manifest and this document refer to the same release snapshot.

---

## 6. Checklist for release day

1. Version bumps and changesets applied (e.g. `pnpm version-packages` or manual).
2. Root version set to `1.0.0` (recommended).
3. Run `pnpm release:manifest` and commit `reports/release-manifest.json`.
4. Run `pnpm release:manifest:verify` to confirm.
5. Create git tag **`v1.0.0`** on the release commit.
6. Publish packages per release process (`pnpm release` or `pnpm publish-packages` as configured).
7. Update this document’s commit hash and timestamp if the manifest was regenerated.

---

*Generated by Agent 13 — Manifest & Tag Manager. Canonical machine-readable manifest: `reports/release-manifest.json`.*
