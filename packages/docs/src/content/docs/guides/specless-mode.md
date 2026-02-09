---
title: Specless Mode
description: How ShipGate verifies code without ISL specifications.
---

Not every project has ISL specifications. ShipGate's **specless mode** verifies code using heuristic analysis, security scanning, and truthpack validation — no `.isl` files required.

## How it works

When you run `shipgate verify` on a codebase without ISL specs, ShipGate automatically switches to specless mode. It runs a suite of built-in checks:

```bash
# Specless verification (auto-detected when no .isl files found)
shipgate verify src/

# Explicitly request specless mode
shipgate verify src/ --mode specless
```

## What specless mode checks

### Security scanning

- **Hardcoded credentials** — API keys, passwords, tokens in source code
- **Missing authentication** — Routes that handle sensitive data without auth middleware
- **PII in logs** — Personal data (emails, names, IPs) passed to logging functions
- **Insecure patterns** — `eval()`, SQL injection vectors, XSS vulnerabilities

### Truthpack validation

If your project has a truthpack (`.shipgate/truthpack/`), specless mode validates against it:

- **Ghost routes** — Code references API routes that don't exist in the truthpack
- **Ghost env vars** — Code uses environment variables not declared in the truthpack
- **Ghost imports** — Code imports modules that don't exist
- **Ghost files** — Code references files that don't exist in the project

### Hallucination detection

Specless mode is particularly good at catching AI hallucinations:

- Functions that return hardcoded values instead of real logic
- API endpoints that don't connect to actual services
- Error handlers that swallow errors silently
- Test files with assertions that always pass

### Code quality

- Missing error handling on async operations
- Unhandled promise rejections
- Missing input validation on API endpoints
- Inconsistent patterns across the codebase

## Setting up truthpack

The truthpack is an auto-generated snapshot of your project's "ground truth". Generate it with:

```bash
shipgate init
```

This creates `.shipgate/truthpack/` with:
- `routes.json` — all API routes
- `env.json` — all environment variables
- `contracts.json` — all TypeScript types and interfaces

## Mixed mode

When some code has ISL specs and some doesn't, ShipGate uses **mixed mode**:

```bash
# Auto-detect: ISL verification where specs exist, specless elsewhere
shipgate verify .
```

Mixed mode is the default when `shipgate verify` finds some `.isl` files but not for all source files. It applies:
1. Full ISL verification for code with specs
2. Specless checks for code without specs

## Configuring strictness

Control how strict specless verification is:

```bash
# Fail only on errors (default)
shipgate verify src/ --fail-on error

# Fail on warnings too
shipgate verify src/ --fail-on warning

# Fail if any code is unspecced (forces writing specs)
shipgate verify src/ --fail-on unspecced
```

## Specless output

```bash
$ shipgate verify src/ --mode specless

Specless Verification Results:

Security:
  ✓ No hardcoded credentials found
  ✓ All sensitive routes have auth middleware
  ⚠ PII detected in logging at src/users.ts:45

Truthpack:
  ✓ All routes verified against truthpack
  ✓ All env vars declared
  ✗ Ghost import: src/api.ts imports "@/services/analytics" (not found)

Hallucination:
  ✓ No hardcoded return values detected
  ⚠ src/payment.ts:23 — error handler returns empty object

Quality:
  ✓ Error handling present on async operations
  ⚠ Missing input validation on POST /api/orders

Verdict: WARN  Trust Score: 72/100
Findings: 0 errors, 3 warnings
```

## Specless in CI

```yaml
# Good for projects without ISL specs
- name: ShipGate Specless Check
  run: shipgate verify src/ --ci --fail-on error
```

## Moving from specless to ISL

Once specless mode identifies issues, you can gradually add ISL specs:

```bash
# Generate ISL specs from your existing code
shipgate isl-generate src/ --output specs/

# Review and edit the generated specs
# Then verify with full ISL mode
shipgate verify specs/ --impl src/
```

See [Migration Guide](/guides/migration/) for a step-by-step process.
