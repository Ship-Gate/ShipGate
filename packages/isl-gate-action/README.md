# ShipGate ISL Verify

**Verify AI-generated code against ISL behavioral specs in your CI/CD pipeline.**

ShipGate automatically detects ISL specification files, matches them to implementation code, runs verification, and reports a **SHIP**, **WARN**, or **NO_SHIP** verdict as a PR comment.

## Quick Start

```yaml
# .github/workflows/shipgate.yml
name: ShipGate
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4

      - uses: shipgate/isl-verify@v1
        with:
          fail-on: error
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

That's it. PRs that fail verification are blocked from merging.

## How It Works

1. On PR, the action detects changed files via `git diff`
2. It discovers `.isl` spec files in `specs/`, `.shipgate/specs/`, or alongside code
3. For each changed file:
   - **With ISL spec**: Runs full behavioral verification (preconditions, postconditions, invariants)
   - **Without ISL spec**: Runs specless verification (auth bypass, hardcoded secrets, stub detection)
4. Returns a verdict:
   - **SHIP** - All checks pass, safe to merge
   - **WARN** - Minor issues detected, review recommended
   - **NO_SHIP** - Critical issues, merge blocked

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `path` | No | `.` | Path to verify (default: entire repo) |
| `mode` | No | `auto` | Verification mode: `auto`, `strict`, `specless` |
| `fail-on` | No | `error` | Failure threshold: `error`, `warning`, `unspecced` |
| `config` | No | auto-detect | Path to `.shipgate.yml` configuration file |

### Modes

- **`auto`** (default): Runs ISL verification on files with specs, specless verification on the rest
- **`strict`**: Requires every changed file to have a matching ISL spec. Files without specs get NO_SHIP
- **`specless`**: Runs specless verification (firewall) on all files, ignoring ISL specs

### Failure Thresholds

- **`error`** (default): Only fail on critical errors (FAIL status)
- **`warning`**: Also fail on warnings (WARN status)
- **`unspecced`**: Fail if any file lacks an ISL spec

## Outputs

| Output | Description |
|--------|-------------|
| `verdict` | `SHIP`, `WARN`, or `NO_SHIP` |
| `score` | Confidence score (`0` to `1`) |
| `report` | Path to the JSON verification report |

### Using Outputs in Subsequent Steps

```yaml
steps:
  - uses: actions/checkout@v4

  - uses: shipgate/isl-verify@v1
    id: shipgate
    with:
      fail-on: error
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  - name: Check verdict
    if: always()
    run: |
      echo "Verdict: ${{ steps.shipgate.outputs.verdict }}"
      echo "Score: ${{ steps.shipgate.outputs.score }}"
```

## PR Comment

The action posts a structured comment on your PR:

---

**Verdict: WARN** (Score: 0.71)

> **Coverage:** 1/2 files have ISL specs (50%)

| File | Status | Method | Score |
|------|--------|--------|-------|
| `src/auth/login.ts` | PASS | ISL | 0.95 |
| `src/payments/refund.ts` | FAIL | Specless | 0.23 |

**Blockers:**
- `refund()` is a stub returning hardcoded `{ success: true }`

**Recommendations:**
- Generate specs: `shipgate isl generate src/payments/`

---
<sub>ShipGate ISL v0.1.0</sub>

## Configuration

Create a `.shipgate.yml` at your repo root for persistent settings:

```yaml
# .shipgate.yml
minScore: 70
mode: auto
failOn: error
```

This is auto-detected by the action. You can also pass an explicit path via the `config` input.

## Advanced Examples

### Strict Mode (require ISL specs for all files)

```yaml
- uses: shipgate/isl-verify@v1
  with:
    mode: strict
    fail-on: unspecced
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Verify a specific directory

```yaml
- uses: shipgate/isl-verify@v1
  with:
    path: src/api/
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Use with branch protection

```yaml
name: ShipGate
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for accurate git diff

      - uses: shipgate/isl-verify@v1
        with:
          fail-on: error
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then in your repo settings, add "ShipGate" as a required status check.

## What Gets Checked

| Check | Spec Required | Description |
|-------|---------------|-------------|
| Preconditions | Yes | Input validation, guards |
| Postconditions | Yes | Output correctness, state changes |
| Invariants | Yes | Properties that must always hold |
| Temporal | Yes | Latency SLAs, eventual consistency |
| Auth bypass | No | Middleware that never checks tokens |
| Hardcoded secrets | No | Passwords, API keys in source |
| Ghost routes | No | Endpoints not in truthpack |
| PII in logs | No | Sensitive data leaked to console |
| Stub detection | No | Functions returning hardcoded values |

## CLI Usage

For local development, use the ShipGate CLI:

```bash
# Install
npm install -g shipgate

# Verify locally (same logic as the action)
npx shipgate verify --ci

# Generate ISL specs from existing code
npx shipgate isl generate src/
```

## Links

- [Documentation](https://shipgate.dev/docs)
- [ISL Language Reference](https://shipgate.dev/docs/isl)
- [Examples](https://github.com/shipgate/examples)
