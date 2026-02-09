# Post-Release Verification Runbook (Shipgate 1.0)

Repeatable checklist to validate installs and integrations after a release. Run this **after** publishing the `shipgate` npm package (e.g. 1.0.0) to confirm the CLI is installable and basic commands work.

---

## Quick run

From repo root:

- **Linux/macOS:** `./scripts/post_release_verify.sh [1.0.0]`
- **Windows (PowerShell):** `.\scripts\post_release_verify.ps1 [-Version 1.0.0]`

Logs are written to `artifacts/post_release/`. Exit code 0 = pass, 1 = fail.

---

## What the script does

| Step | Command / behavior | Purpose |
|------|--------------------|--------|
| 1 | `npm install -g shipgate[@version]` | Install CLI globally (optional; may skip if no permissions) |
| 2 | `shipgate --version` | Confirm global binary runs and prints version |
| 3 | `shipgate init verify-project --template minimal` (in temp dir) | Confirm `init` creates a valid project (package.json / isl.config.json) |
| 4 | `npx shipgate --version` | Confirm npx path resolves and runs the published package |

Each step’s stdout/stderr is captured under `artifacts/post_release/post_release_verify_<timestamp>_<step>.log`.

---

## Expected outputs

### `shipgate --version` (and `npx shipgate --version`)

- **Expected:** A single line with a **semver** (e.g. `1.0.0`).
- **Example:** `1.0.0`
- **Exit code:** 0.

Failure: non‑zero exit, or output that is not a semver (e.g. stack trace, "command not found").

### `shipgate init verify-project --template minimal`

- **Expected:** Creates a directory (e.g. `verify-project/`) containing at least:
  - `package.json`
  - `isl.config.json`
- **Exit code:** 0.

Failure: non‑zero exit, or missing `package.json` / `isl.config.json` in the created project.

### Global install (`npm install -g shipgate`)

- **Expected:** Install completes with exit 0 (or script skips global checks if install fails).
- If install fails (e.g. no admin/sudo), the script still runs **npx** and **init**; only the global `shipgate --version` step is skipped.

---

## Rollback-worthy failures

Treat as **rollback-worthy** (consider unpublishing or yanking the release) if **any** of the following happen in a **clean environment** (e.g. fresh Node/npm, or CI):

1. **`npx shipgate --version` fails**  
   - Exit code ≠ 0, or output is not a semver.  
   - Indicates the published package is broken or not runnable via npx.

2. **`npx shipgate init ... --template minimal` fails**  
   - Non‑zero exit or missing `package.json` / `isl.config.json`.  
   - Indicates the main “first-run” flow is broken for new users.

3. **Package not installable**  
   - `npm install -g shipgate` or `npm install shipgate` fails consistently (e.g. missing dependencies, invalid tarball).  
   - Indicates a packaging/publish error.

4. **Version mismatch**  
   - `shipgate --version` or `npx shipgate --version` prints a version that does not match the released tag (e.g. released 1.0.0 but CLI prints 0.x or wrong number).  
   - Indicates a release/build tagging or packaging mistake.

**Not rollback-worthy by default:**

- Global install failing due to permissions (no sudo/admin).
- Cosmetic or help-text issues that do not affect `--version` or `init`.
- Failures only in environments with broken Node/npm or custom registries (first confirm in a clean environment).

---

## After a failure

1. Inspect the latest logs in `artifacts/post_release/` (e.g. `post_release_verify_<timestamp>_*.log`).
2. Re-run in a clean environment (different machine or CI) to rule out local/cache issues.
3. If the failure is rollback-worthy, follow your release process (e.g. npm yank, incident comms, fix and republish).

---

## Optional: CI

You can run the same script in CI after a release job:

- Install Node 18+, then run `./scripts/post_release_verify.sh 1.0.0` (or the released version).
- Use the script’s exit code to fail the job and block “release complete” if verification fails.
