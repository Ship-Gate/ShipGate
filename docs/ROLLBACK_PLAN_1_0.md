# Rollback & Hotfix Runbook — 1.0

**Agent 16 — Rollback & Hotfix Commander**  
**Scope:** Shipgate/ISL 1.0.x (npm `shipgate`, GitHub releases)  
**Use when:** A 1.0.x release is broken and must be reverted or patched under pressure.

---

## 1. Rollback triggers

Execute this runbook when **any** of the following is true:

| # | Trigger | How to confirm |
|---|--------|----------------|
| **T1** | **Install broken** | `npm install -g shipgate` or `npx shipgate --version` fails; users cannot get the package or get wrong/corrupt files. |
| **T2** | **CLI init broken** | `npx shipgate init` (or `shipgate init`) fails, throws, or produces invalid output for a new project. |
| **T3** | **Critical crash on startup** | `shipgate` or `isl` binary exits immediately (e.g. uncaught exception, missing native dep, broken entry). |
| **T4** | **Publish included quarantined packages** | A 1.0.x publish accidentally included experimental/quarantined packages or unstable code in the shipped bundle or dependencies. |

**Decision:** If any trigger matches → treat as rollback incident. Proceed to Section 2.

---

## 2. Rollback steps (in order)

### 2.1 Point `latest` away from the broken version (npm dist-tag)

**Goal:** New installs get the last known-good version, not the broken one.

1. Identify **last known-good version** (e.g. `1.0.0` if the broken one is `1.0.1`, or a pre-1.0 tag if `1.0.0` is broken).
2. From a machine with npm auth to the publishing scope:
   ```bash
   # If 1.0.0 is good and 1.0.1 is broken: move latest back to 1.0.0
   npm dist-tag add shipgate@1.0.0 latest
   ```
3. Verify:
   ```bash
   npm view shipgate dist-tags
   npm install -g shipgate@latest
   shipgate --version
   ```

**If no prior good version exists:** Skip 2.1; use 2.2 to deprecate and 2.3 to publish a minimal hotfix as the new `latest`.

---

### 2.2 Deprecate the broken version

**Goal:** Warn users who already depend on the bad version; reduce new installs on it.

```bash
# Deprecate broken version (replace X.Y.Z with the broken version)
npm deprecate shipgate@X.Y.Z "This version is broken. Use shipgate@<last-good-or-hotfix-version>. See https://github.com/guardiavault-oss/ISL-LANG/issues/<ROLLBACK_ISSUE>"
```

---

### 2.3 Publish hotfix patch (e.g. 1.0.1) with minimal diff

**Goal:** Restore a working `latest` with minimal change (patch only).

1. **Branch from the last known-good tag** (e.g. `v1.0.0`):
   ```bash
   git fetch --tags
   git checkout -b hotfix/1.0.1 v1.0.0
   ```
2. **Apply only the minimal fix** (no features, no refactors). Bump version:
   - In `packages/cli/package.json`: set `"version": "1.0.1"`.
   - If using changesets: add a patch changeset or version only the CLI.
3. **Build and smoke-test locally:**
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter shipgate build
   pnpm --filter shipgate test:smoke
   node packages/cli/dist/cli.cjs --version
   node packages/cli/dist/cli.cjs init --help
   ```
4. **Publish the hotfix:**
   ```bash
   # From repo root; ensure you're logged in: npm whoami
   pnpm --filter shipgate publish --no-git-checks
   ```
5. **Set `latest` to the hotfix:**
   ```bash
   npm dist-tag add shipgate@1.0.1 latest
   ```
6. **Tag and push:**
   ```bash
   git tag v1.0.1
   git push origin hotfix/1.0.1
   git push origin v1.0.1
   ```
7. **Merge to main** (or your release branch) via PR so history reflects the fix.

---

## 3. Communications

### 3.1 GitHub release note update

1. Open the **broken** release (e.g. **Releases** → `v1.0.1`).
2. **Edit** the release and add at the **top** of the description:
   ```markdown
   **⚠️ This release is deprecated.** Use [v1.0.2](link-to-good-release) instead. See [issue #XX](link-to-pinned-issue) for details.
   ```
3. Create a **new release** for the hotfix (e.g. `v1.0.2`) with short release notes describing only the fix and pointing to the pinned issue.

### 3.2 Pinned issue template

Create a **pinned** GitHub issue (e.g. "Rollback: Shipgate 1.0.x — use 1.0.Y") and use this template:

**Title:** `[Rollback] Shipgate X.Y.Z — use X.Y.W instead`

**Body:**
```markdown
## Summary
Version **X.Y.Z** of Shipgate is broken [install / CLI init / startup crash / quarantined packages]. Do not use it.

## What to do
- **Install / upgrade:** Use `shipgate@X.Y.W` or `npx shipgate@X.Y.W`.
- **npm:** `npm install -g shipgate@latest` (after we've moved `latest` to X.Y.W).

## What we did
- [ ] Moved `latest` dist-tag to last known-good/hotfix version
- [ ] Deprecated X.Y.Z on npm
- [ ] Published hotfix X.Y.W (link to release)
- [ ] Updated release notes and pinned this issue

## References
- Release: [link to good release]
- Runbook: [docs/ROLLBACK_PLAN_1_0.md](link)
```

Pin the issue in the repo so it appears first in the Issues list.

---

## 4. Quick reference (checklist under pressure)

- [ ] **Trigger confirmed** (T1–T4)
- [ ] **Dist-tag:** `npm dist-tag add shipgate@<good> latest`
- [ ] **Deprecate:** `npm deprecate shipgate@<bad> "<message>"`
- [ ] **Hotfix:** Branch from last good tag → minimal fix → bump to 1.0.X → build → smoke test → publish → `npm dist-tag add shipgate@1.0.X latest` → tag `v1.0.X` → push
- [ ] **Release note:** Edit broken release (deprecation notice); create new release for hotfix
- [ ] **Pinned issue:** Create from template; pin in repo

---

## 5. Contacts and links

- **Runbook:** `docs/ROLLBACK_PLAN_1_0.md`
- **Release workflow:** `.github/workflows/release.yml`
- **CLI package:** `packages/cli` (npm name: `shipgate`)
- **Repo:** `https://github.com/guardiavault-oss/ISL-LANG`

---

*Last updated: 2026-02-09*
