# PR: Release workflow audit and dry-run safety (release-shipgate.yml)

## Summary

Audit of `.github/workflows/release-shipgate.yml` and changes to prevent “tag triggers publish broken stuff” and enable safe dry-runs.

## Changes

### Workflow (`.github/workflows/release-shipgate.yml`)

- **Dry-run mode (workflow_dispatch):** New input `dry_run` (default `true`). When `true`, the workflow runs build, version extraction, and all tests but **skips** npm publish, “Verify published package”, and “Create GitHub Release”. Tag pushes always run with `dry_run=false` (unchanged behaviour).
- **Smoke tests:** Added `pnpm run test:smoke` in `packages/cli` in addition to existing `--help` / `--version` checks.
- **Publish/release gating:** “Publish to npm”, “Verify published package”, and “Create GitHub Release” run only when `dry_run != 'true'`.
- **Dry run summary step:** When `dry_run == true`, a final step confirms that build and tests passed and publish was skipped.
- **Comments:** Top-of-file note to prefer creating release tags from `main` after CI/critical-tests pass and to use workflow_dispatch with `dry_run: true` for validation without publishing.

### Documentation

- **`docs/RELEASE_WORKFLOW_AUDIT_1_0.md`:** Audit report with:
  - Triggers, required secrets, publish steps, artifact steps
  - Validation: production build, critical tests, single-package publish, tag consistency (v1.0.0 vs shipgate@1.0.0)
  - Risks and mitigations
  - Safe dry-run procedure (branch run with publishing disabled)
  - Pre–1.0 release checklist

## How to dry-run

1. Go to **Actions → Release Shipgate CLI → Run workflow**.
2. Select branch (e.g. `main`), set **version** to `shipgate@1.0.0` (or `1.0.0`).
3. Leave **dry_run** checked (default).
4. Run workflow. All steps run except npm publish and GitHub Release.

## Checklist before merging

- [ ] Review audit doc and workflow diff.
- [ ] Confirm `NPM_TOKEN` is set in repo secrets for real releases.
- [ ] Optionally run the workflow once with `dry_run: true` from this branch to confirm it passes.
