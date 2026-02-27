# ISL Pipeline Demo: stdlib-auth Login

This demo demonstrates the core ISL promise using the `stdlib-auth` Login specification:

1. **Import** stdlib-auth login.isl
2. **Generate** code + tests
3. **Verify** (real expression evaluation)
4. **Produce** proof bundle
5. **Proof verify** => PROVEN

## Quick Start

### Windows (PowerShell)

```powershell
# Success demo
.\scripts\demo-login.ps1

# Failure mode demo (healer patches violations)
.\scripts\demo-login.ps1 -failure
```

### Linux/macOS (Bash)

```bash
# Make executable (first time only)
chmod +x scripts/demo-login.sh

# Success demo
./scripts/demo-login.sh

# Failure mode demo (healer patches violations)
./scripts/demo-login.sh --failure
```

### npm scripts

```bash
# From packages/isl-pipeline directory
npm run demo:login
npm run demo:login:failure

# From repo root
pnpm --filter @isl-lang/pipeline demo:login
```

## Prerequisites

- Node.js 18+
- pnpm installed
- Dependencies installed (`pnpm install` from repo root)

## Demo Flow

### Success Demo

```
Import → Generate → Verify → Proof Bundle → PROVEN
```

1. **Import Spec**: Loads `stdlib-auth/intents/behaviors/login.isl`
2. **Generate Code**: Creates TypeScript implementation with:
   - `@intent rate-limit-required`
   - `@intent audit-required`  
   - `@intent no-pii-logging`
   - All postconditions implemented
3. **Run Verify**: Evaluates all postconditions and invariants
4. **Produce Proof Bundle**: Creates v2 proof bundle with evidence
5. **Proof Verify**: Validates bundle integrity → PROVEN

### Failure Mode Demo

```
Break Clause → VIOLATED → Healer Patches → PROVEN
```

1. **Broken Code**: Shows implementation with deliberate violations
2. **Gate → NO_SHIP**: Detects 6 violations
3. **Generate Patches**: Healer creates fixes for each violation
4. **Apply Patches**: Shows healed code with changes highlighted
5. **Re-run Gate → SHIP**: All intents satisfied

## Expected Output

### Success Demo Transcript

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ISL Pipeline Demo: stdlib-auth Login                               ║
║                                                                      ║
║   Import → Generate → Verify → Proof Bundle → PROVEN                 ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

━━━ Step 1: Import stdlib-auth Login Specification ━━━
  Loading: packages/stdlib-auth/intents/behaviors/login.isl

  ✓ Parsed Auth.Behaviors v0.1.0

  Behaviors:
    Login
      Authenticate a user with email and password, creating a new session
      Preconditions: 4, Postconditions: 14
      Invariants: 4

      Intents:
        @intent rate-limit-required
        @intent audit-required
        @intent no-pii-logging

  Spec Hash: a1b2c3d4e5f6g7h8

━━━ Step 2: Generate Code + Tests ━━━
  ✓ Generated types.ts
  ✓ Generated login.impl.ts
  ✓ Generated login.test.ts

  Implementation includes @intent markers for: rate-limit-required, audit-required, no-pii-logging
  Generated 14 postcondition tests

  Running gate checks...
  Gate: SHIP (100/100)

  Running tests...
  Tests: 21/21 passed

━━━ Step 3: Run Verify (Real Expression Evaluation) ━━━
  Evaluating postconditions...

  ✓ post-1: success implies Session.exists(result.session.id)
  ✓ post-2: success implies result.session.user_id == result.user.id
  ✓ post-3: success implies result.session.status == ACTIVE
  ✓ post-4: success implies result.session.ip_address == input.ip_address
  ✓ post-5: success implies result.session.created_at == now()
  ✓ post-6: input.remember_me == true implies result.session.expires_at == now() + 30d
  ✓ post-7: input.remember_me == false implies result.session.expires_at == now() + 24h
  ✓ post-8: success implies result.token != null
  ✓ post-9: success implies result.token.length >= 64
  ✓ post-10: success implies User.lookup(result.user.id).last_login == now()
  ✓ post-11: success implies User.lookup(result.user.id).failed_attempts == 0
  ✓ post-12: INVALID_CREDENTIALS implies no Session created
  ✓ post-13: failure implies no Session created
  ✓ post-14: failure implies no token generated

  Evaluating invariants...

  ✓ inv-1: password never stored in plaintext
  ✓ inv-2: password never appears in logs
  ✓ inv-3: password comparison is constant-time (timing attack resistant)
  ✓ inv-4: session token cryptographically secure (256-bit minimum entropy)

  Results:
    18 PROVEN / 0 NOT_PROVEN / 0 VIOLATED
    Score: 100%

  Verdict: PROVEN

━━━ Step 4: Produce Proof Bundle ━━━

  ═════════════════════════════════════════════════════════
  PROOF BUNDLE
  ═════════════════════════════════════════════════════════

  Bundle ID:     a1b2c3d4e5f6g7h8
  Schema:        v2.0
  Domain:        Auth.Behaviors v0.1.0
  Spec Hash:     a1b2c3d4e5f6g7h8

  Verification:  PROVEN
    Clauses:     18/18 proven
    Expressions: 18 evaluated

  Gate:          SHIP
    Score:       100/100
    Violations:  0

  Tests:         21/21 passed

  ═════════════════════════════════════════════════════════
  VERDICT:       PROVEN
  ═════════════════════════════════════════════════════════

━━━ Step 5: Proof Verify ━━━

  ✓ Bundle ID integrity
  ✓ Schema version valid
  ✓ Spec hash valid
  ✓ Verification completed
  ✓ All clauses proven
  ✓ Gate passed
  ✓ No violations
  ✓ Tests passed
  ✓ Tests exist
  ✓ Verdict is PROVEN

  ✓ PROOF BUNDLE VERIFIED: PROVEN

════════════════════════════════════════════════════════════════════════
  DEMO SUMMARY
════════════════════════════════════════════════════════════════════════

  Spec:           Auth.Behaviors v0.1.0
  Spec Hash:      a1b2c3d4e5f6g7h8
  Bundle ID:      a1b2c3d4e5f6g7h8

  Verification:   18/18 clauses proven
  Gate:           SHIP (score: 100/100)
  Tests:          21/21 passed

  Proof Verdict:  PROVEN

  ✓ DEMO PASSED - Code is PROVABLY CORRECT!

════════════════════════════════════════════════════════════════════════

  Output saved to: packages/isl-pipeline/demo-login/output/
```

### Failure Mode Demo Transcript

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ISL Pipeline Demo: FAILURE MODE                                    ║
║                                                                      ║
║   Break Clause → VIOLATED → Healer Patches → PROVEN                  ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

━━━ Step 1: Deliberately Broken Implementation ━━━

  Code with intentional violations:
  ──────────────────────────────────────────────────────────────────────
    1 │ // BROKEN IMPLEMENTATION - Missing required intents
   ...
   20 │ console.log('Login attempt:', { email, password, ip_address });  ← PII LOGGED
   ...
   24 │     return { success: false, error: { code: 'INVALID_CREDENTIALS' } };  ← NO AUDIT
   ...
   40 │     token: randomUUID(), // ← TOKEN LENGTH < 64
   ...
   47 │ // ← MISSING __isl_intents export
  ──────────────────────────────────────────────────────────────────────

━━━ Step 2: Run Gate => NO_SHIP (Violations Detected) ━━━

  Verdict: NO_SHIP (score: 15/100)
  Violations: 6 detected

  ✗ [CRITICAL] intent/rate-limit-required
      Missing rate limiting before body parsing
      login.ts:17

  ✗ [CRITICAL] pii/console-in-production
      Sensitive data (email, password) logged to console
      login.ts:20
      Expected: "No PII in logs"
      Actual: "console.log('Login attempt:', { email, password, ip_address })"

  ✗ [HIGH] intent/audit-required
      Missing audit logging on failure path
      login.ts:24

  ✗ [HIGH] intent/audit-required
      Missing audit logging on success path
      login.ts:38

  ✗ [HIGH] postcondition/token-length
      Token length < 64 (postcondition: result.token.length >= 64)
      login.ts:40
      Expected: ">= 64"
      Actual: "36 (UUID length)"

  ✗ [MEDIUM] intent/declaration-missing
      Missing __isl_intents export
      login.ts:1

━━━ Step 3: Healer Generates Patches ━━━

  Generated 6 patches:

  + Add rate limiting before body parsing
      login.ts:17 (insert)
      + const rateLimit = checkRateLimit(ip_address);...

  + Remove PII logging
      login.ts:20 (delete)
      - console.log('Login attempt:', { email, password, ip_address });
      + // @intent no-pii-logging - Removed console.log with sensitive data

  + Add audit logging on failure path
      login.ts:24 (insert)
      + audit({ action: 'login', ip: ip_address, success: false, reason: 'invalid_credentials' });

  + Add audit logging on success path
      login.ts:38 (insert)
      + audit({ action: 'login', userId: user.id, ip: ip_address, success: true });

  + Use cryptographically secure token with >= 64 chars
      login.ts:40 (replace)
      - token: randomUUID(),
      + const token = randomBytes(64).toString('hex'); // 128 chars (512 bits)

  + Add machine-checkable intent declaration
      login.ts:999 (insert)
      + export const __isl_intents = ['rate-limit-required', 'audit-required', 'no-pii-logging'];

━━━ Step 4: Apply Patches ━━━

  Healed implementation:
  ──────────────────────────────────────────────────────────────────────
   18 │ // @intent rate-limit-required                                    ← ADDED
   19 │ function checkRateLimit(ip) {                                     ← ADDED
   ...
   32 │ // @intent audit-required                                         ← ADDED
   33 │ function audit(entry) {                                           ← ADDED
   ...
   56 │   const token = randomBytes(64).toString('hex');                  ← FIXED
   ...
   62 │   audit({ action: 'login', userId: user.id, ip, success: true }); ← ADDED
   ...
   76 │ export const __isl_intents = ['rate-limit-required', ...];        ← ADDED
  ──────────────────────────────────────────────────────────────────────

━━━ Step 5: Re-Run Gate => SHIP ━━━

  Verdict: SHIP (score: 100/100)
  Violations: 0 detected

  ✓ All intents satisfied
  ✓ All postconditions verified
  ✓ No PII in logs

════════════════════════════════════════════════════════════════════════
  HEALING SUMMARY
════════════════════════════════════════════════════════════════════════

  Initial:        NO_SHIP (6 violations)
  Patches:        6 applied
  Iterations:     1
  Final:          SHIP (0 violations)

  Violations Fixed:
    ✓ intent/rate-limit-required
    ✓ pii/console-in-production
    ✓ intent/audit-required
    ✓ intent/audit-required
    ✓ postcondition/token-length
    ✓ intent/declaration-missing

  ✓ HEALING SUCCESSFUL - Code now PROVABLY CORRECT!

════════════════════════════════════════════════════════════════════════

  Key Changes:

    + Added rate limiting before body parsing (@intent rate-limit-required)
    + Added audit logging on all exit paths (@intent audit-required)
    - Removed console.log with sensitive data (@intent no-pii-logging)
    + Changed token generation to 64+ chars (postcondition)
    + Added __isl_intents export (machine-checkable)
```

## Output Files

After running the demo, the following files are generated in `demo-login/output/`:

| File | Description |
|------|-------------|
| `types.ts` | Generated TypeScript types from ISL |
| `login.impl.ts` | Generated implementation with intents |
| `login.test.ts` | Generated tests for postconditions |
| `proof-bundle.json` | Proof bundle with verification evidence |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        stdlib-auth/login.isl                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ behavior Login {                                             │   │
│  │   @intent rate-limit-required                                │   │
│  │   @intent audit-required                                     │   │
│  │   @intent no-pii-logging                                     │   │
│  │                                                              │   │
│  │   postconditions {                                           │   │
│  │     success implies Session.exists(result.session.id)        │   │
│  │     success implies result.token.length >= 64                │   │
│  │     ...                                                      │   │
│  │   }                                                          │   │
│  │ }                                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           ISL Pipeline                              │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │  Parse   │ → │ Generate │ → │  Verify  │ → │   Proof Bundle   │ │
│  │   ISL    │   │   Code   │   │ Clauses  │   │                  │ │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────────┘ │
│                                                        │            │
│                                                        ▼            │
│                                              ┌──────────────────┐   │
│                                              │  proof-bundle    │   │
│                                              │  verdict: PROVEN │   │
│                                              └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Related

- [stdlib-auth](../../stdlib-auth/) - Authentication standard library
- [ISL Healer](../../isl-healer/) - Self-healing pipeline
- [ISL Proof](../../isl-proof/) - Proof bundle generation and verification
