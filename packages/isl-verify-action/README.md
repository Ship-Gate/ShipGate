# isl-verify GitHub Action

Runs ISL verification on pull request code and posts results as a PR comment.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `isl-spec-path` | Path to ISL specification file | `./spec.isl` |
| `threshold` | Minimum trust score to pass (0-100) | `70` |
| `fail-on-no-ship` | Fail the workflow if verification results in NO_SHIP | `true` |
| `api-key` | API key for ISL verification (required; use `secrets.ISL_API_KEY`) | - |
| `working-directory` | Working directory for running verification | `.` |

## Outputs

| Output | Description |
|--------|-------------|
| `verdict` | `SHIP` or `NO_SHIP` |
| `score` | Trust score (0-100) |
| `passed` | `true` or `false` |

## Usage

```yaml
name: ISL Verify

on:
  pull_request:
    branches: [main, master]

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci  # or pnpm install

      - name: Build isl-verify-action (if using local action)
        run: pnpm --filter @isl-lang/isl-verify-action build

      - name: Run ISL Verify
        uses: ./.github/actions/isl-verify
        # Or: uses: ./packages/isl-verify-action
        with:
          isl-spec-path: ./spec.isl
          threshold: 70
          fail-on-no-ship: true
          api-key: ${{ secrets.ISL_API_KEY }}
```

## Requirements

- Add `isl` or `shipgate` to your project's `package.json` dependencies, or ensure it is available via `npx`
- Set `ISL_API_KEY` (or equivalent) in your repository secrets
