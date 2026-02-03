# End-to-End Login Demo

**The demo that cannot be dismissed.**

This demo shows the complete ISL pipeline from natural language to verified proof:

```
"Write me a login" → ISL → Code → Gate → Heal → Test → PROVEN
```

## Quick Start

```bash
# From the monorepo root
pnpm install
npm run demo:login

# Or from this directory
cd demos/e2e-login-demo
pnpm install
npm run demo
```

## What This Demo Proves

1. **NL → ISL Translation**: User says "Write me a login", system generates structured ISL spec with intents
2. **Codegen with Intentional Bugs**: Generator produces code that's intentionally incomplete
3. **Gate Blocks NO_SHIP**: Static analysis detects semantic violations
4. **Healer Iterates Deterministically**: Patches are applied based on known fix recipes
5. **Tests Run (Non-Zero)**: Verification tests execute and pass
6. **Proof Bundle Verifies PROVEN**: Cryptographic proof that code satisfies spec

## Demo Steps

### Step 1: NL → ISL Translation

```
User: "Write me a login"

→ ISL Spec:
  domain Auth version "1.0.0"
  
  behavior UserLogin {
    @intent rate-limit-required
    @intent audit-required
    @intent no-pii-logging
    
    input { email: Email, password: String }
    output { success: Session, errors { ... } }
    
    invariant password.neverLogged()
    invariant email.redactedInLogs()
  }
```

### Step 2: Intentionally Broken Code

The generator produces code with these violations:

| Violation | Rule ID | Severity |
|-----------|---------|----------|
| Missing rate limiting | `intent/rate-limit-required` | High |
| Missing audit logging | `intent/audit-required` | High |
| PII logged to console | `pii/console-in-production` | High |
| Password logged | `pii/password-logged` | Critical |
| Missing `__isl_intents` | - | High |

### Step 3: Gate Check (NO_SHIP)

```
Verdict: NO_SHIP
Score:   25/100
Violations: 5

[CRITICAL] pii/password-logged
  Password may be logged - CRITICAL security violation

[HIGH] intent/rate-limit-required
  Missing @intent rate-limit-required enforcement

[HIGH] intent/audit-required
  Missing @intent audit-required enforcement

[HIGH] pii/console-in-production
  console.log in production code may leak PII
```

### Step 4: Self-Healing

The healer iterates until SHIP:

```
┌─ Iteration 1/8 ────────────────────────────────────┐
│ Score: 25/100
│ Verdict: NO_SHIP
│ Violations: 5
│
│ Applying fixes...
│   ✓ Removed console.log (PII risk)
│   ✓ Added rate limiting middleware
│   ✓ Added audit logging
│   ✓ Added __isl_intents export
└────────────────────────────────────────────────────┘

┌─ Iteration 2/8 ────────────────────────────────────┐
│ Score: 100/100
│ Verdict: SHIP
│
│ ✓ SHIP - All intents satisfied!
└────────────────────────────────────────────────────┘
```

### Step 5: Tests Run

```
✓ Precondition: email.isValidFormat() (23ms)
✓ Precondition: password.length >= 8 (18ms)
✓ Precondition: rateLimitNotExceeded(email, ip) (31ms)
✓ Error: ValidationError when email or password format invalid (15ms)
✓ Error: RateLimited when too many requests (22ms)
✓ Error: InvalidCredentials when email or password incorrect (19ms)
✓ Error: AccountLocked when too many failed attempts (17ms)
✓ Intent: @rate-limit-required (25ms)
✓ Intent: @audit-required (21ms)
✓ Intent: @no-pii-logging (18ms)
✓ Invariant: password.neverLogged() (29ms)
✓ Invariant: email.redactedInLogs() (24ms)

12 passed, 0 failed
```

### Step 6: Proof Bundle

```
═══════════════════════════════════════════════════════════════
PROOF BUNDLE
═══════════════════════════════════════════════════════════════

Bundle ID:  a1b2c3d4e5f6g7h8
Domain:     Auth v1.0.0
Spec Hash:  9876543210abcdef

Gate:       SHIP (score: 100)
Tests:      12 passed/12
Iterations: 2

Verdict:    PROVEN

═══════════════════════════════════════════════════════════════
```

### Step 7: Verification

```
✓ Bundle ID integrity
✓ Spec hash valid
✓ Gate passed
✓ No violations
✓ Tests passed
✓ Tests exist
✓ Verdict is PROVEN

✓ PROOF BUNDLE VERIFIED
```

## Failure Mode Demo

Run the failure mode demo to see what happens with unknown rules:

```bash
npm run demo:failure
```

This demonstrates the healer's **honest abort** behavior:

```
User: "Write me a login with quantum encryption"

Intents detected (including UNKNOWN):
  @intent rate-limit-required (known)
  @intent audit-required (known)
  @intent no-pii-logging (known)
  @intent quantum-encryption-required (UNKNOWN)
  @intent post-quantum-key-exchange (UNKNOWN)

┌─ Iteration 1/8 ────────────────────────────────────┐
│ Score: 25/100
│ Verdict: NO_SHIP
│ Violations: 6
│
│ ✗ UNKNOWN_RULE - Cannot fix automatically:
│   • intent/quantum-encryption-required
│   • intent/post-quantum-key-exchange
│
│ The healer REFUSES to guess fixes for unknown rules.
│ This is intentional: proof that passing means something.
└────────────────────────────────────────────────────┘
```

### The Moat

The healer is **NOT allowed to**:

- ✗ Guess fixes for unknown rules
- ✗ Add suppressions automatically
- ✗ Downgrade severity
- ✗ Change gate rules/packs
- ✗ Broaden allowlists / weaken security
- ✗ "Make it pass" by hiding violations

When the healer encounters unknown rules, it **aborts honestly** and reports what it cannot fix.

## Output Files

After running the demo, check the `output/` directory:

```
output/
├── healed-code/
│   └── src/app/api/login/route.ts  # Fixed implementation
├── proof-bundle.json               # Cryptographic proof
├── spec.isl                        # Generated ISL spec
└── terminal-recording.txt          # (if using demo:record)
```

## Recording Terminal Output

To record the terminal output for documentation:

```bash
npm run demo:record
```

This saves the output to `output/terminal-recording.txt`.

## Integration with CI

This demo can be integrated into CI pipelines:

```yaml
- name: Run E2E Demo
  run: npm run demo:login
  # Exit code 0 = PROVEN
  # Exit code 1 = FAILED
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User: "Write me a login"                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NL → ISL Translator                      │
│  - Pattern matching against known behaviors                 │
│  - Intent extraction (rate-limit, audit, no-pii)           │
│  - Confidence scoring                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ISL → Code Generator                     │
│  - Template-based code generation                           │
│  - Intentionally incomplete (for demo)                      │
│  - Proof links (ISL clause → code location)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Gate                                │
│  - Static analysis for intent compliance                    │
│  - PII detection in logs                                    │
│  - Fingerprinting for stuck detection                       │
│  - Verdict: SHIP or NO_SHIP                                │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              ┌─────────┐         ┌─────────┐
              │  SHIP   │         │ NO_SHIP │
              └─────────┘         └─────────┘
                    │                   │
                    │                   ▼
                    │   ┌─────────────────────────────────────┐
                    │   │              Healer                 │
                    │   │  - Fix recipe catalog               │
                    │   │  - Deterministic patches            │
                    │   │  - Weakening guard                  │
                    │   │  - Unknown rule → abort             │
                    │   └─────────────────────────────────────┘
                    │                   │
                    │                   ▼
                    │              (loop back to Gate)
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Test Runner                            │
│  - Tests derived from ISL preconditions                     │
│  - Tests derived from ISL postconditions                    │
│  - Intent enforcement tests                                 │
│  - Invariant tests                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Proof Bundle                             │
│  - Bundle ID (content hash)                                 │
│  - Spec hash                                                │
│  - Gate result                                              │
│  - Test results                                             │
│  - Iteration history                                        │
│  - Verdict: PROVEN / VIOLATED / INCOMPLETE_PROOF           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Verifier                              │
│  - Bundle ID integrity                                      │
│  - Spec hash validation                                     │
│  - Verdict calculation consistency                          │
│  - Signature verification (if signed)                       │
└─────────────────────────────────────────────────────────────┘
```

## Why This Matters

This demo proves that:

1. **Intent-driven development works**: Natural language → verified code
2. **Self-healing is deterministic**: No LLM hallucination in the fix loop
3. **Proof bundles are verifiable**: Cryptographic evidence of compliance
4. **Failure is honest**: Unknown rules cause abort, not guessing

The moat: **proof that passing means something**.
