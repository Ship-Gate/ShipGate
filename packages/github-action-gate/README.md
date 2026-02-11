# ISL Gate GitHub Action

A GitHub Action that runs ISL/Shipgate gate checks and reports results via PR comments and Check Run annotations.

## Features

- **SHIP/NO_SHIP Decision Engine**: Runs authoritative gate checks on your code
- **PR Comments**: Idempotent comments that update existing bot comments
- **Check Run Annotations**: File-level annotations with severity levels
- **Changed Files Only**: In PR mode, only checks files that have changed
- **Configurable Thresholds**: Set custom score thresholds and failure conditions
- **Multiple Report Formats**: JSON, Markdown, and SARIF outputs

## Quick Start

Add to `.github/workflows/isl-gate.yml`:

```yaml
name: ISL Gate
on: [pull_request]

permissions:
  contents: read
  pull-requests: write
  checks: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: isl-lang/github-action-gate@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

That's it. Every PR will now:
- Get checked for security issues
- Receive a comment with the verdict
- Be blocked if unsafe (in enforce mode)

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `mode` | `check` (comment only) or `enforce` (block merge) | No | `enforce` |
| `threshold` | Minimum score to pass (0-100) | No | `80` |
| `config-path` | Path to config file | No | `.islstudio/config.json` |
| `fail-on` | Fail on: `any`, `blocker`, `none` | No | `blocker` |
| `changed-only` | Only check changed files (PR only) | No | `true` |
| `token` | GitHub token for API access | Yes | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `verdict` | `SHIP` or `NO_SHIP` |
| `score` | Score out of 100 |
| `violations` | Number of violations |
| `evidence-path` | Path to evidence directory |

## Example: Check Mode (Don't Block)

```yaml
- uses: isl-lang/gate-action@v1
  with:
    mode: check  # Comment only, don't block
```

## Example: Strict Mode

```yaml
- uses: isl-lang/gate-action@v1
  with:
    threshold: 90
    fail-on: any  # Block on any violation
```

## Example: Use Output

```yaml
- uses: isl-lang/gate-action@v1
  id: gate

- name: Handle Result
  run: |
    echo "Verdict: ${{ steps.gate.outputs.verdict }}"
    echo "Score: ${{ steps.gate.outputs.score }}"
```

## Configuration

Create `.islstudio/config.json`:

```json
{
  "preset": "startup-default",
  "packs": {
    "auth": { "enabled": true },
    "pii": { "enabled": true },
    "payments": { "enabled": false },
    "rate-limit": { "enabled": true }
  },
  "threshold": 70
}
```

## What It Checks

| Category | Examples |
|----------|----------|
| Auth | Bypass patterns, hardcoded credentials, unprotected routes |
| PII | Logging sensitive data, unmasked responses |
| Rate Limits | Missing limits on auth endpoints |
| Payments | Payment bypass, hardcoded cards |

## PR Comment Example

When the action runs, it posts a comment like:

> ## 🛑 ISL Gate: NO_SHIP
>
> **Score:** 45/100
>
> ### Violations (2)
>
> | Severity | Rule | File | Message |
> |----------|------|------|---------|
> | 🛑 Blocker | `auth/bypass-detected` | `src/auth.ts` | Auth bypass pattern found |
> | ⚠️ Warning | `pii/console-in-production` | `src/users.ts` | Console.log in production |
>
> ### How to Fix
>
> ```bash
> npx islstudio gate --explain
> ```

## License

MIT
