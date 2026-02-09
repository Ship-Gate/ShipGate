---
title: "CLI: watch"
description: Watch ISL files for changes and automatically re-verify.
---

The `watch` command monitors ISL files for changes and automatically re-runs verification. Optionally runs the gate and auto-healer on each change.

## Usage

```bash
shipgate watch [files...] [options]
```

## Options

| Flag                     | Description                              |
| ------------------------ | ---------------------------------------- |
| `--gate`                 | Run gate after each check                |
| `--heal`                 | Run auto-healer after each check         |
| `--changed-only`         | Only process changed files (not all)     |
| `-i, --impl <file>`     | Implementation path (required with `--gate`) |
| `-t, --threshold <score>` | Gate threshold (default: `95`)         |

## Examples

### Basic watch

```bash
# Watch all ISL files and re-check on changes
shipgate watch specs/

# Watch specific files
shipgate watch specs/user-service.isl specs/payment-service.isl
```

### Watch with gate

```bash
# Re-run gate on every change
shipgate watch specs/ --gate --impl src/ --threshold 80
```

### Watch with auto-healing

```bash
# Automatically fix violations on change
shipgate watch specs/ --heal
```

### Watch only changed files

```bash
# Only re-check files that changed (faster for large projects)
shipgate watch specs/ --changed-only
```

## Output

```
[watch] Watching 5 ISL files...

[watch] specs/user-service.isl changed
  ✓ Parsed successfully
  ✓ Type checking passed
  ✓ 1 entity, 2 behaviors

[watch] specs/payment-service.isl changed
  ✓ Parsed successfully
  ✗ Type error: unknown type "PaymentCard" at line 12
```

### With `--gate`

```
[watch] specs/user-service.isl changed
  ✓ Parsed and type-checked
  Running gate...
  Verdict: SHIP ✓  Trust Score: 92/100
```

## Auto-healing

The `heal` command (and `--heal` flag on watch) automatically fixes violations in your code to pass the gate:

```bash
# Standalone healing
shipgate heal specs/*.isl --spec user-service.isl

# Options
shipgate heal specs/*.isl \
  --spec user-service.isl \
  --max-iterations 8 \
  --stop-on-repeat 2
```

| Flag                        | Description                              |
| --------------------------- | ---------------------------------------- |
| `-s, --spec <file>`         | ISL spec file                            |
| `--max-iterations <n>`      | Max healing iterations (default: `8`)    |
| `--stop-on-repeat <n>`      | Stop after N identical results (default: `2`) |

## Exit codes

| Code | Meaning                      |
| ---- | ---------------------------- |
| `0`  | Watch started successfully   |
| `1`  | Watch failed to start        |
