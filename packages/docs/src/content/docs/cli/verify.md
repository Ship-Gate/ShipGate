---
title: "CLI: verify"
description: Verify code against ISL specifications or run specless checks.
---

The `verify` command is ShipGate's primary verification tool. It checks implementations against ISL specifications and produces a trust score with a SHIP/NO_SHIP verdict.

## Usage

```bash
shipgate verify [path] [options]
```

## Modes

The `verify` command auto-detects the appropriate mode:

| Mode       | When                                    | What it does                          |
| ---------- | --------------------------------------- | ------------------------------------- |
| **ISL**    | Path contains `.isl` spec files         | Full spec-based verification          |
| **Specless** | Path has code but no `.isl` files     | Heuristic security and quality checks |
| **Mixed**  | Some files have specs, some don't       | ISL + specless combined               |

## Options

### Spec and implementation

| Flag                     | Description                                   |
| ------------------------ | --------------------------------------------- |
| `--spec <file>`          | ISL spec file (legacy mode)                   |
| `-i, --impl <file>`     | Implementation file or directory              |
| `--proof <bundleDir>`   | Verify using a proof bundle instead of path   |

### Output

| Flag                     | Description                                   |
| ------------------------ | --------------------------------------------- |
| `--json`                 | Output structured JSON to stdout              |
| `--ci`                   | CI mode: JSON stdout, GitHub Actions annotations |
| `-d, --detailed`         | Show detailed breakdown of results            |
| `-r, --report <format>`  | Generate report: `md`, `pdf`, `json`, `html`  |
| `-o, --report-output <path>` | Output path for report file              |

### Strictness

| Flag                     | Description                                   |
| ------------------------ | --------------------------------------------- |
| `--fail-on <level>`      | Fail on: `error` (default), `warning`, `unspecced` |
| `-s, --min-score <score>` | Minimum trust score to pass (default: `70`)  |
| `-t, --timeout <ms>`     | Test timeout in milliseconds (default: `30000`) |

### Verification modes

| Flag                           | Description                              |
| ------------------------------ | ---------------------------------------- |
| `--smt`                        | Enable SMT verification for pre/postconditions |
| `--smt-timeout <ms>`           | SMT solver timeout (default: `5000`)     |
| `--pbt`                        | Enable property-based testing            |
| `--pbt-tests <num>`            | Number of PBT iterations (default: `100`) |
| `--pbt-seed <seed>`            | PBT random seed for reproducibility      |
| `--pbt-max-shrinks <num>`      | Max PBT shrinking iterations (default: `100`) |
| `--temporal`                   | Enable temporal verification (latency SLAs) |
| `--temporal-min-samples <num>` | Min samples for temporal checks (default: `10`) |
| `--all`                        | Enable all verification modes            |

## Examples

### Basic verification

```bash
# Verify a spec against an implementation
shipgate verify user-service.isl --impl ./src/user-service.ts

# Verify all specs in a directory
shipgate verify specs/ --impl src/

# Verify with specless mode (no .isl files needed)
shipgate verify src/
```

### CI usage

```bash
# CI mode with JSON output and annotations
shipgate verify specs/ --impl src/ --ci --fail-on error

# Set minimum trust score
shipgate verify specs/ --impl src/ --min-score 85
```

### Advanced verification

```bash
# Enable all verification modes
shipgate verify specs/ --impl src/ --all

# Property-based testing with custom parameters
shipgate verify specs/ --impl src/ --pbt --pbt-tests 500 --pbt-seed 42

# SMT formal verification
shipgate verify specs/ --impl src/ --smt --smt-timeout 10000

# Generate HTML report
shipgate verify specs/ --impl src/ --report html --report-output ./report.html
```

## Output

### Pretty output (default)

```
Running verification...

CreateUser:
  Preconditions:
    ✓ email.is_valid
    ✓ name.length > 0
    ✓ not User.exists(email)
  Postconditions:
    ✓ User.count == old(User.count) + 1
    ✓ result.email == email
    ✓ result.status == PENDING
  Invariants:
    ✓ email.is_valid (entity)
    ✓ name.length > 0 (entity)
  Scenarios:
    ✓ "successful creation"
    ✓ "duplicate email rejected"

Verdict: SHIP ✓  Trust Score: 100/100
```

### JSON output

```bash
shipgate verify specs/ --impl src/ --json
```

```json
{
  "verdict": "SHIP",
  "score": 100,
  "confidence": 95,
  "results": [
    {
      "behavior": "CreateUser",
      "preconditions": { "passed": 3, "failed": 0 },
      "postconditions": { "passed": 3, "failed": 0 },
      "invariants": { "passed": 2, "failed": 0 },
      "scenarios": { "passed": 2, "failed": 0 }
    }
  ],
  "duration_ms": 1234
}
```

## Exit codes

| Code | Name             | Meaning                       |
| ---- | ---------------- | ----------------------------- |
| `0`  | SUCCESS          | SHIP — all checks passed      |
| `1`  | ISL_ERROR        | NO_SHIP — verification failed |
| `2`  | USAGE_ERROR      | Invalid arguments or flags    |
| `3`  | INTERNAL_ERROR   | Unexpected error              |

## See also

- [Quick Start](/getting-started/quickstart/) — first verification in 5 minutes
- [CI/CD Integration](/guides/ci-integration/) — add verification to your pipeline
- [Specless Mode](/guides/specless-mode/) — verification without ISL specs
