# ISL Heal Command

Automatically fix violations in code to pass the gate.

## Overview

The `isl heal` command analyzes your codebase, identifies violations found by `isl gate`, and automatically applies safe, minimal patches to fix them. It supports dry-run and interactive modes for safe review before applying changes.

## Usage

```bash
# Basic usage - automatically fix violations
isl heal src/**/*.ts

# Dry-run mode - preview patches without applying
isl heal src/**/*.ts --dry-run

# Interactive mode - review and approve each patch
isl heal src/**/*.ts --interactive

# Specify output directory for dry-run patches
isl heal src/**/*.ts --dry-run -o ./patches

# Use specific ISL spec file
isl heal src/**/*.ts --spec specs/api.isl

# Limit iterations
isl heal src/**/*.ts --max-iterations 5
```

## Top 10 Healable Findings

The heal command can automatically fix these common violations:

1. **Missing Environment Variable** (`starter/no-missing-env-vars`)
   - Adds missing env vars to `.env.example` and Zod schemas

2. **Ghost Route** (`starter/no-ghost-routes`)
   - Registers missing route handlers in routing system

3. **Console.log in Production** (`pii/console-in-production`)
   - Removes console.log statements and replaces with proper logging

4. **Missing Rate Limiting** (`intent/rate-limit-required`)
   - Adds rate limiting middleware to route handlers

5. **Missing Input Validation** (`intent/input-validation`)
   - Adds Zod schema validation for request inputs

6. **Type Mismatch** (`starter/type-mismatch`)
   - Fixes type mismatches between ISL spec and implementation

7. **Missing Audit Logging** (`intent/audit-required`)
   - Adds audit logging calls on success/error paths

8. **Missing Authentication Check** (`auth/missing-auth-check`)
   - Adds authentication middleware to sensitive routes

9. **PII in Logs** (`intent/no-pii-logging`)
   - Sanitizes PII from log statements

10. **Missing Route Binding** (`starter/missing-route-binding`)
    - Adds proper exports and HTTP method bindings

## Modes

### Normal Mode (Default)

Applies all patches automatically:

```bash
isl heal src/**/*.ts
```

### Dry-Run Mode

Preview patches without applying them. Patches are written to `.isl-heal-patches/` directory:

```bash
isl heal src/**/*.ts --dry-run
```

Output includes:
- `patch-summary.txt` - Human-readable summary
- `*.patch` files - Individual patch files
- `all-patches.patch` - Unified diff format

### Interactive Mode

Review and approve each patch individually:

```bash
isl heal src/**/*.ts --interactive
```

For each patch, you'll see:
- File path
- Rule ID and rationale
- Full diff
- Prompt to apply (y/n)

## Patch Format

Patches are generated in unified diff format with rationale comments:

```diff
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -3,7 +3,7 @@
 export async function getUser(id: string) {
-  console.log('Getting user:', id); // Violation
+  // @intent no-pii-logging - no sensitive data in logs
   return await db.users.findUnique({ where: { id } });
 }
// Heal: Remove PII from Logs - Removes or sanitizes PII from log statements
```

## Safety Guarantees

The heal command **never**:
- Removes code that uses env vars
- Changes existing env var values
- Removes existing route registrations
- Removes error handling or important logging
- Removes existing auth checks
- Changes the ISL spec
- Adds suppressions automatically
- Downgrades severity
- Weakens security

## Examples

### Example 1: Fix Console.log Violations

```bash
# Before: console.log found in production code
# After: console.log removed, proper logging added

isl heal src/**/*.ts
```

### Example 2: Add Missing Rate Limiting

```bash
# Before: Route handler missing rate limiting
# After: Rate limiting middleware added

isl heal src/app/api/**/route.ts --spec specs/api.isl
```

### Example 3: Preview All Fixes

```bash
# Generate patches without applying
isl heal src/**/*.ts --dry-run -o ./review-patches

# Review patches
cat ./review-patches/patch-summary.txt

# Apply manually if approved
git apply ./review-patches/all-patches.patch
```

## Integration with CI/CD

```yaml
# .github/workflows/heal.yml
name: Heal Check

on: [pull_request]

jobs:
  heal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g @isl-lang/cli
      - run: isl heal src/**/*.ts --dry-run
      - name: Upload patches
        uses: actions/upload-artifact@v3
        with:
          name: heal-patches
          path: .isl-heal-patches/
```

## Exit Codes

- `0` - Success (all violations fixed, SHIP)
- `1` - Failure (violations remain, NO_SHIP)
- `2` - Usage error (bad flags, missing file)

## Limitations

The heal command can only fix violations for which recipes exist. Unknown rules will be reported but not fixed automatically. This is intentional - the healer refuses to guess fixes to ensure that passing the gate means something.

## Related Commands

- `isl gate` - Run the gate to check for violations
- `isl verify` - Verify code against ISL specs
- `isl check` - Type check ISL files
