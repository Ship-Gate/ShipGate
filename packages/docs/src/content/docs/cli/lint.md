---
title: "CLI: lint"
description: Lint ISL specifications for best practices and common issues.
---

The `lint` command checks ISL files for best practice violations, style issues, and potential problems.

## Usage

```bash
shipgate lint <file> [options]
```

## Options

| Flag          | Description                              |
| ------------- | ---------------------------------------- |
| `--strict`    | Treat warnings as errors                 |

## Examples

```bash
# Lint a single file
shipgate lint user-service.isl

# Lint with strict mode
shipgate lint user-service.isl --strict

# Lint all specs in a directory
shipgate lint specs/*.isl
```

## What lint checks

### Missing postconditions

```
⚠ behavior CreateUser: missing failure postconditions
  → Add "failure implies { ... }" to ensure state is preserved on error
```

### Missing error cases

```
⚠ behavior UpdateUser: no error cases defined in output
  → Define expected errors in output { errors { ... } }
```

### Weak preconditions

```
⚠ behavior DeleteAll: no preconditions
  → Add preconditions to validate inputs
```

### Sensitive data handling

```
⚠ entity User: field "ssn" contains sensitive data but is not marked [sensitive]
  → Add [sensitive] modifier: ssn: String [sensitive]
```

### Naming conventions

```
⚠ entity user: entity names should be PascalCase
  → Rename to "User"

⚠ behavior create_user: behavior names should be PascalCase
  → Rename to "CreateUser"
```

### Unused entities

```
⚠ entity AuditLog: defined but never referenced in any behavior
  → Remove if unused, or add behaviors that use it
```

## Output

```bash
$ shipgate lint payment-service.isl

payment-service.isl:
  line 15  ⚠ behavior ProcessPayment: missing failure postconditions
  line 23  ⚠ entity Payment: field "card_number" should be marked [sensitive]
  line 45  ⚠ behavior RefundPayment: no rate_limit in security block

2 warnings, 0 errors
```

### With `--strict`

```bash
$ shipgate lint payment-service.isl --strict

payment-service.isl:
  line 15  ✗ behavior ProcessPayment: missing failure postconditions
  line 23  ✗ entity Payment: field "card_number" should be marked [sensitive]
  line 45  ✗ behavior RefundPayment: no rate_limit in security block

0 warnings, 3 errors (strict mode)
Exit code: 1
```

## Spec quality scoring

For a more detailed quality analysis, use `spec-quality`:

```bash
# Score a spec on 5 quality dimensions
shipgate spec-quality user-service.isl

# Fail if below threshold
shipgate spec-quality user-service.isl --min-score 70

# Get fix suggestions
shipgate spec-quality user-service.isl --fix
```

## Formatting

The `fmt` command auto-formats ISL files:

```bash
# Format a file in place
shipgate fmt user-service.isl

# Check formatting without writing
shipgate fmt user-service.isl --check

# Print formatted output
shipgate fmt user-service.isl --no-write
```

## Exit codes

| Code | Meaning                          |
| ---- | -------------------------------- |
| `0`  | No issues (or warnings only)     |
| `1`  | Errors found (or warnings in strict mode) |
