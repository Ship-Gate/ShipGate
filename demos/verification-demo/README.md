# ISL Verification Demo

This demo showcases the ISL verification pipeline:

1. **Evaluator verifies real postconditions** - The expression evaluator checks actual postcondition clauses
2. **Stdlib import works** - Demonstrates importing from `@isl/stdlib/auth/session-create`
3. **Semantic analysis catches invalid specs** - Shows rule violations like missing audit, rate limit ordering
4. **Verify outputs PROVEN with non-zero tests** - Gate produces PROVEN verdict when tests pass

## Quick Start

### Windows (PowerShell)

```powershell
.\scripts\demo-verification.ps1
```

### Unix/Linux/macOS (Bash)

```bash
./scripts/demo-verification.sh
```

## Demo Structure

```
demos/verification-demo/
├── spec/
│   ├── valid-auth.isl          # Valid spec with stdlib import
│   └── invalid-missing-audit.isl  # Invalid spec (semantic violations)
├── src/
│   ├── auth.ts                 # Valid implementation
│   ├── auth.test.ts            # Tests verifying postconditions
│   └── invalid-impl.ts         # Invalid implementation (violations)
├── package.json
├── vitest.config.ts
└── README.md
```

## Expected Terminal Output

### Step 1: Parsing Valid Spec with Stdlib Import

```
[1/4] Parsing valid spec with stdlib import...

  File: demos/verification-demo/spec/valid-auth.isl

  ✓ Valid spec parsed successfully
  ✓ Stdlib import '@isl/stdlib/auth/session-create' resolved
```

### Step 2: Semantic Analysis on Invalid Spec

```
[2/4] Semantic analysis on invalid spec...

  File: demos/verification-demo/spec/invalid-missing-audit.isl

  Expected violations:
    • Missing @intent audit-required on DeleteUser
    • Rate limit after body parsing pattern

🚦 ISL Gate
   Spec: demos/verification-demo/spec/invalid-missing-audit.isl
   Impl: demos/verification-demo/src/invalid-impl.ts

═══════════════════════════════════════════════════════════
  NO-SHIP: 3 violation(s)
═══════════════════════════════════════════════════════════

  [CRITICAL] intent/no-pii-logging
    File: src/invalid-impl.ts:48
    Message: console.log in production code - use structured logger
    Evidence: console.log(`Importing ${usersToImport.length} users from ${ip}`)

  [CRITICAL] intent/no-pii-logging
    File: src/invalid-impl.ts:62
    Message: PII (personal-info): "email" may be logged
    Evidence: console.log(`Imported user: ${userData.email}`)

  [HIGH] intent/rate-limit-required
    File: src/invalid-impl.ts:51
    Message: Rate limit check happens AFTER body parsing (must be before)
    Evidence: Body parsed before rate limit check

  ✓ Semantic analysis caught violations!
```

### Step 3: Running Tests That Verify Postconditions

```
[3/4] Running tests that verify postconditions...

  Running vitest...

 ✓ src/auth.test.ts (12)
   ✓ Authenticate behavior (8)
     ✓ Postcondition: Session is created with user_id (1)
       ✓ creates a session linked to the authenticated user
     ✓ Postcondition: Session expires in the future (1)
       ✓ creates a session with future expiry
     ✓ Postcondition: Login count is incremented (1)
       ✓ increments user login count on success
     ✓ Intent: audit-required (2)
       ✓ records audit on successful login
       ✓ records audit on failed login
     ✓ Intent: rate-limit-required (1)
       ✓ rate limits after too many attempts
     ✓ Intent: no-pii-logging (1)
       ✓ does not log actual email in audit
     ✓ Error cases (2)
       ✓ returns INVALID_CREDENTIALS for wrong password
       ✓ returns INVALID_CREDENTIALS for non-existent user
   ✓ GetUserProfile behavior (1)
     ✓ Postcondition: User exists and is active (1)
       ✓ returns active user for valid session

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Duration  1.23s

  ✓ All tests passed
  ✓ Postconditions verified:
      • Session.exists(result.session.id)
      • result.session.user_id == result.user.id
      • result.session.expires_at > now()
      • result.user.login_count > old(login_count)
```

### Step 4: Gate Produces PROVEN Verdict

```
[4/4] Running gate to produce PROVEN verdict...

  Running: isl gate spec/valid-auth.isl --impl src/

🚦 ISL Gate
   Spec: spec/valid-auth.isl
   Impl: src/

═══════════════════════════════════════════════════════════
  SHIP: All checks passed
═══════════════════════════════════════════════════════════

  ✓ Semantic rules: 0 violations
  ✓ TypeScript: No errors
  ✓ Tests: 12 passed, 0 failed

  ═══════════════════════════════════════════════════════════════
                         VERDICT: PROVEN
  ═══════════════════════════════════════════════════════════════

  ✓ Gate passed with SHIP verdict
  ✓ Tests executed (non-zero test count)
  ✓ All postconditions verified by evaluator
```

### Demo Complete Summary

```
═══════════════════════════════════════════════════════════════════════════════
  Demo Complete!

  Summary:
    [1] ✓ Stdlib import resolved
    [2] ✓ Semantic analysis caught invalid spec
    [3] ✓ Tests verified postconditions
    [4] ✓ Gate produced PROVEN verdict

═══════════════════════════════════════════════════════════════════════════════
```

## What Gets Verified

### Postconditions (from `valid-auth.isl`)

```isl
post success {
  # Session was created for the authenticated user
  Session.exists(result.session.id)
  result.session.user_id == result.user.id

  # Session expires in the future
  result.session.expires_at > now()

  # User login count was incremented
  result.user.login_count > old(result.user.login_count)
}
```

### Semantic Rules

| Rule | Description |
|------|-------------|
| `intent/audit-required` | All exit paths must have audit calls |
| `intent/rate-limit-required` | Rate limit must happen BEFORE body parsing |
| `intent/no-pii-logging` | No PII in console.log or audit payloads |
| `quality/no-stubbed-handlers` | No `throw new Error("Not implemented")` |

### PROVEN Requirements

For a verdict of `PROVEN`:
- Gate verdict: `SHIP`
- Build/typecheck: `PASS`
- Tests: `PASS` AND `testCount > 0`
- All postconditions: evaluated to `true`
- All invariants: satisfied

## Running Individual Steps

```bash
# Parse and check specs
pnpm isl check spec/*.isl

# Run tests
pnpm test

# Run gate on valid implementation
pnpm isl gate spec/valid-auth.isl --impl src/

# Run gate on invalid implementation (will fail)
pnpm isl gate spec/invalid-missing-audit.isl --impl src/invalid-impl.ts
```

## Files

### `spec/valid-auth.isl`

A valid authentication spec that:
- Imports from stdlib: `import { CreateSession } from "@isl/stdlib/auth/session-create"`
- Has real postconditions the evaluator verifies
- Uses intent decorators: `@intent rate-limit-required`, `@intent audit-required`

### `spec/invalid-missing-audit.isl`

An intentionally invalid spec that semantic analysis catches:
- Missing `@intent audit-required` on sensitive operations
- Implementation has rate limit AFTER body parsing

### `src/auth.ts`

Implementation that satisfies all postconditions:
- Creates sessions with correct `user_id`
- Sets `expires_at` in the future
- Increments `login_count`
- Calls `auditAttempt()` on all exit paths
- Checks rate limit BEFORE processing
- Redacts PII in logs

### `src/auth.test.ts`

Tests that verify each postcondition:
- `Session.exists(result.session.id)` ✓
- `result.session.user_id == result.user.id` ✓
- `result.session.expires_at > now()` ✓
- `result.user.login_count > old(login_count)` ✓
