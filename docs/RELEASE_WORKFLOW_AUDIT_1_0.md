# Release Workflow Audit 1.0 — release-shipgate.yml

**Auditor:** Agent 11 (Release Workflow Surgeon)  
**Date:** 2026-02-09  
**Workflow:** `.github/workflows/release-shipgate.yml`  
**Scope:** Prevent "tag triggers publish broken stuff"; ensure safe, auditable releases.

---

## 1. Extracted workflow summary

### 1.1 Triggers

| Trigger | Pattern | Notes |
|--------|---------|--------|
| **push (tags)** | `shipgate@*` | e.g. `shipgate@1.0.0` |
| **push (tags)** | `v*` | e.g. `v1.0.0`, `v0.1.0` |
| **workflow_dispatch** | Manual | Input: `version` (e.g. `shipgate@1.0.0`) |

**Risk:** Any push to a matching tag immediately runs the workflow and publishes. No branch gate (e.g. “only tags from `main`”).

### 1.2 Required secrets

| Secret | Used in step | Required for |
|--------|--------------|--------------|
| **NPM_TOKEN** | Publish to npm | `npm publish` |
| **GITHUB_TOKEN** | Create GitHub Release | `softprops/action-gh-release` (provided by Actions by default) |

**Note:** `GITHUB_TOKEN` is automatically supplied; only `NPM_TOKEN` must be configured in repo secrets.

### 1.3 Publish steps

1. **Update package version** — `npm version <version> --no-git-tag-version` in `packages/cli`
2. **Publish to npm** — `npm publish --access public --provenance` (uses `NODE_AUTH_TOKEN` / `NPM_TOKEN`)
3. **Verify published package** — `npm view shipgate@<version> version`
4. **Create GitHub Release** — `softprops/action-gh-release@v1` with tag `shipgate@<version>`, draft: false

### 1.4 Artifact steps

**None.** This workflow does not upload artifacts (unlike `release.yml`, which uploads release-manifest and compliance artifacts). Acceptable for a single-package CLI release.

---

## 2. Validation results

### 2.1 Builds production?

| Check | Status | Notes |
|-------|--------|--------|
| Builds CLI | ✅ | `pnpm run build` in `packages/cli` |
| Production build | ⚠️ **Partial** | Does **not** run `pnpm build:production`. Only builds the CLI in isolation; CLI’s workspace deps are built as part of `pnpm install` + CLI build. May miss monorepo-wide production build issues. |
| Verify build output | ✅ | Checks `dist/cli.cjs` exists (matches package.json bin), non-empty, shebang present |

**Recommendation:** For 1.0, consider adding an optional job that runs `pnpm build:production` (or at least `pnpm turbo build --filter=shipgate^...`) so that the exact dependency graph used in production is built before publish. Current setup is acceptable if CI (e.g. `ci.yml` / `critical-tests.yml`) already gates `main` with production build.

### 2.2 Runs critical tests?

| Check | Status | Notes |
|-------|--------|--------|
| Smoke (help/version) | ✅ | Inline: `node dist/cli.js --help`, `node dist/cli.js --version` |
| Vitest smoke suite | ⚠️ **No** | `pnpm test:smoke` (e.g. `vitest run tests/smoke.test.ts`) is **not** run. |
| Critical tests (evaluator, import-resolver, semantic) | ❌ **No** | No dependency on `critical-tests.yml` or inline run of `pnpm test:critical`. |

**Risk:** A tag can be pushed and publish can succeed even if critical tests are failing on `main`. Mitigation: enforce “only create release tags from `main` after critical-tests pass” in process, or add a reusable workflow / check that critical tests passed for the commit being tagged.

**Recommendation:** Add `pnpm test:smoke` in `packages/cli` in the release workflow so the full smoke test suite runs. Optionally document that release tags must be created only from a `main` commit that has passed critical-tests.

### 2.3 Publishes only intended packages?

| Check | Status | Notes |
|-------|--------|--------|
| Single package | ✅ | Only `packages/cli` (npm name `shipgate`) is built and published. |
| No changesets | ✅ | Version comes from tag or workflow_dispatch input, not from changesets. |
| No accidental scope publish | ✅ | No `pnpm changeset publish` or multi-package publish in this workflow. |

Publish surface is correct: **only the Shipgate CLI** is published to npm.

### 2.4 Tag consistency (v1.0.0 vs shipgate@1.0.0)

| Aspect | Status | Notes |
|--------|--------|--------|
| Version extraction | ✅ | Both `shipgate@X.Y.Z` and `vX.Y.Z` are normalized to `X.Y.Z` (strip `shipgate@` and `v`). |
| GitHub Release tag | ✅ | Release is always created with tag **`shipgate@<version>`** (e.g. `shipgate@1.0.0`). So pushing `v1.0.0` still yields a GitHub Release tagged `shipgate@1.0.0`. |
| npm version | ✅ | `npm version <version> --no-git-tag-version` sets package version to the extracted number; npm sees e.g. `shipgate@1.0.0`. |

**Recommendation:** Document in release runbook: prefer **`shipgate@1.0.0`** for the tag so that the git tag and GitHub Release tag match. Using `v1.0.0` is supported and yields the same npm and release outcome.

---

## 3. Risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tag push publishes immediately; no dry-run | High | Add **dry-run** mode (workflow_dispatch input): run all build and test steps, skip `npm publish` and GitHub Release. |
| No gate from critical tests | Medium | Process: only tag from `main` after critical-tests pass. Optional: add job that runs `pnpm test:critical` or call critical-tests workflow. |
| No full smoke test suite in workflow | Medium | Run `pnpm test:smoke` in `packages/cli` before publish. |
| No production build verification | Low | Rely on CI on `main`; optionally add `pnpm build:production` or turbo build for CLI deps in release workflow. |
| workflow_dispatch allows arbitrary version string | Low | Document that version must be semver (e.g. `1.0.0` or `shipgate@1.0.0`). Optional: add step to validate semver. |

---

## 4. Safe dry-run procedure

### 4.1 Option A: Branch run with publishing disabled (recommended)

1. **Add a `dry_run` input** to `workflow_dispatch` (e.g. checkbox, default `true` for manual runs).
2. When `dry_run == true`:
   - Run checkout, setup, install, build, verify build output, extract version, **optional** “update package version” (can be skipped or done in a way that doesn’t commit).
   - Run smoke tests (inline + `pnpm test:smoke`).
   - **Skip** “Publish to npm”.
   - **Skip** “Verify published package”.
   - **Skip** “Create GitHub Release”.
3. Run the workflow manually from `main` (or a release branch) with `dry_run: true` and `version: shipgate@1.0.0` (or `1.0.0`) to validate the full path without publishing.

### 4.2 Option B: Run on a branch (no tag) with dry_run

- Trigger via **workflow_dispatch** only (do not push a tag).
- Set `version` to the candidate version and `dry_run` to true.
- Ensures no tag-based publish can fire from that run.

### 4.3 Option C: “Noop publish” (not recommended)

- Wrapping `npm publish` in `if: env.DRY_RUN != 'true'` and using `npm pack --dry-run` when dry-run is sufficient for “would publish” checks. Prefer **Option A** so the same workflow file clearly separates “dry-run” (no publish, no release) from “real release”.

---

## 5. Changes applied (PR)

The following updates were made in the workflow and docs:

1. **workflow_dispatch inputs**
   - **`dry_run`**: boolean (default **`true`** for manual runs). When `true`, skip npm publish, verify published, and GitHub Release.
   - **`version`**: unchanged (required for manual run).

2. **Tag runs**
   - On **push (tags)**, the workflow sets `dry_run` to `false`, so tag pushes still perform full publish (no change in behaviour for tag-based releases).

3. **Steps when `dry_run == true`**
   - “Publish to npm”, “Verify published package”, and “Create GitHub Release” run only when `steps.dry_run.outputs.value != 'true'`.
   - New step “Dry run summary” runs when `dry_run == true` to confirm build and tests passed and publish was skipped.

4. **Stronger validation before publish**
   - **`pnpm run test:smoke`** is run in `packages/cli` (vitest smoke suite) in addition to the existing inline `--help` / `--version` checks.

5. **Workflow comments**
   - Top-of-file comment: tag triggers run full publish; use workflow_dispatch with `dry_run: true` to validate without publishing; prefer creating release tags from `main` after CI and critical-tests pass.

6. **Documentation**
   - This audit: `docs/RELEASE_WORKFLOW_AUDIT_1_0.md` (risks, validation, dry-run procedure).

---

## 6. Checklist before first 1.0 tag

- [ ] `NPM_TOKEN` is set in repo secrets (and is a valid npm automation token).
- [ ] Run a **dry-run** via workflow_dispatch (`dry_run: true`, `version: shipgate@1.0.0`) from `main` and confirm all steps pass except publish/release.
- [ ] Ensure **critical-tests** (and main CI) are green on `main` before creating the release tag.
- [ ] Create tag `shipgate@1.0.0` (or `v1.0.0`) from the intended commit on `main`.
- [ ] After publish, verify `npm install -g shipgate` and `shipgate --version` and `npx shipgate init`.

---

**Document version:** 1.0  
**Next review:** After first 1.0 release or on next workflow change.
