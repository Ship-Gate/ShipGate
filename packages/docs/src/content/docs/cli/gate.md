---
title: "CLI: gate"
description: SHIP/NO_SHIP gate — verify implementation against spec and get a definitive decision for CI.
---

The `gate` command is the definitive SHIP/NO_SHIP decision for your pipeline. It verifies an implementation against an ISL specification, computes a trust score, and returns exit code `0` (SHIP) or `1` (NO_SHIP). Use it in CI to block unverified code from shipping.

## Usage

```bash
shipgate gate <spec> -i <impl> [options]
```

The spec is the path to an ISL file; the implementation is the file or directory containing code that implements the spec.

## Options

| Flag | Description |
| ---- | ----------- |
| `-i, --impl <file>` | **Required.** Implementation file or directory to verify |
| `-t, --threshold <score>` | Minimum trust score to SHIP (default: `95`) |
| `-o, --output <dir>` | Output directory for evidence bundle (default: current directory) |
| `--ci` | CI mode: minimal output, exit code only |
| `--verbose` | Verbose output |
| `--format <format>` | Output format: `pretty`, `json`, `quiet` |

## Examples

### Basic gate

```bash
shipgate gate user-service.isl --impl ./src/user-service.ts
```

### Custom threshold

```bash
shipgate gate user-service.isl --impl ./src/user-service.ts --threshold 80
```

### CI usage

```bash
# Minimal output; rely on exit code (0 = SHIP, 1 = NO_SHIP)
shipgate gate specs/auth.isl --impl src/ --ci

# With minimum score
shipgate gate specs/auth.isl --impl src/ --ci --threshold 90
```

### JSON output

```bash
shipgate gate user-service.isl --impl ./src/user-service.ts --format json
```

## Output

### Pretty output (default)

```
┌─────────────────────────────┐
│ Verdict: SHIP               │
│ Trust Score: 100/100        │
│ Confidence: 95%             │
│ Duration: 1.2s              │
└─────────────────────────────┘
```

Exit code `0` means SHIP; exit code `1` means NO_SHIP. Use this in your CI pipeline.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | SHIP — verification passed, score meets threshold |
| `1` | NO_SHIP — verification failed or score below threshold |
| `2` | Usage error (e.g. missing `--impl`) |
| `3` | Internal error |

## See also

- [Quick Start](/getting-started/quickstart/) — uses `shipgate gate` in step 6
- [CLI: check](/cli/check/) — type-check specs before verification
- [CLI: verify](/cli/verify/) — full verification with options (SMT, PBT, temporal)
- [CI/CD Integration](/guides/ci-integration/) — add the gate to GitHub Actions
