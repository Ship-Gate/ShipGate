# ISL 1.0 CLI Demo Session

This document demonstrates the complete ISL workflow:
**quickstart → certify → status → ship**

## Prerequisites

```bash
# Install ISL CLI globally
npm install -g @isl-lang/cli@1.0.0

# Verify installation
isl --version
# Output: 1.0.0
```

## Session Recording

### Step 1: Quickstart - Initialize Project

```bash
$ isl init my-auth-service
```

**Output:**
```
ISL Project Initialized ✓

Created:
  + my-auth-service/
  + my-auth-service/specs/
  + my-auth-service/specs/auth.isl
  + my-auth-service/.shipgate/
  + my-auth-service/.shipgate/config.json

Next steps:
  cd my-auth-service
  isl check specs/
  isl build specs/**/*.isl
```

### Step 2: Create Specification

```bash
$ cd my-auth-service
$ cat specs/auth.isl
```

**Output:**
```isl
domain Auth version "1.0.0"

use stdlib-auth

entity User {
  id: string
  email: string @format("email")
  passwordHash: string @hidden
  isActive: boolean
  createdAt: timestamp
}

behavior Login {
  input: {
    email: string @format("email")
    password: string @minLength(8) @maxLength(128)
  }
  output: {
    token: string
    user: User
    expiresAt: timestamp
  }

  pre: input.email.contains("@") && input.password.length >= 8
  post: result.token.length > 0 && result.user.isActive == true

  within 200ms (p99)
}

behavior Logout {
  input: { token: string }
  output: { success: boolean }

  pre: input.token.length > 0
  post: result.success == true
}
```

### Step 3: Check Specification

```bash
$ isl check specs/auth.isl
```

**Output:**
```
ISL Check
─────────────────────────────────────────────

✓ specs/auth.isl

  Domain: Auth v1.0.0
  Entities: 1
  Behaviors: 2
  Imports: 1 resolved

  0 errors, 0 warnings

Completed in 45ms
```

### Step 4: Generate Implementation Scaffolds

```bash
$ isl build specs/auth.isl -o ./src
```

**Output:**
```
🔧 ISL Build Pipeline
  Pattern: specs/auth.isl
  Files: 1
  Output: ./src

✓ Parse        [18ms]
✓ Typecheck    [12ms]
✓ Codegen      [35ms]
✓ Testgen      [28ms]

✓ Build complete!

  Files generated: 6
  Output directory: ./src

  Output breakdown:
    Types: 2 files
    Tests: 2 files
    Helpers: 2 files

Completed in 93ms
```

### Step 5: Implement the Service

```bash
$ cat src/auth.ts
```

**Output (after implementation):**
```typescript
import { LoginInput, LoginOutput, User } from './auth.types';
import { hashPassword, verifyPassword, generateToken } from './helpers';

export async function login(input: LoginInput): Promise<LoginOutput> {
  // Validate email format
  if (!input.email.includes('@')) {
    throw new Error('Invalid email format');
  }
  
  // Validate password length
  if (input.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  // Lookup user
  const user = await findUserByEmail(input.email);
  if (!user || !user.isActive) {
    throw new Error('User not found or inactive');
  }
  
  // Verify password
  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }
  
  // Generate token
  const token = await generateToken(user.id);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  return {
    token,
    user,
    expiresAt,
  };
}
```

### Step 6: Certify - Run Verification

```bash
$ isl verify specs/auth.isl --impl src/auth.ts --detailed
```

**Output:**
```
Spec: specs/auth.isl
Impl: src/auth.ts

┌─────────────────────────────────────────────┐
│           EVIDENCE SCORE SUMMARY            │
└─────────────────────────────────────────────┘

  Evidence Score: 97/100
  Confidence:     95%

  Checks: 12 passed / 0 failed (100% pass rate)

  Recommendation: Production Ready - High confidence in implementation

Trust Score: 97/100
Confidence: 95%

Recommendation: Production Ready

Breakdown:
  Postconditions   ████████████████████ 6/6
  Invariants       ████████████████████ 2/2
  Scenarios        ████████████████████ 2/2
  Temporal         ████████████████████ 2/2

Test Results:
  ✓ 12 passed
  Duration: 234ms

✓ Verification passed
  Completed in 278ms
```

### Step 7: Status - Run Gate Check

```bash
$ isl gate specs/auth.isl --impl src/auth.ts
```

**Output:**
```
🚦 ISL Gate
   Spec: specs/auth.isl
   Impl: src/auth.ts
   Threshold: 95%

  ┌─────────────────────────────────────┐
  │            ✓  SHIP                  │
  └─────────────────────────────────────┘

  SHIP: All 12 verifications passed. Trust score: 97%

  Trust Score: 97%
  Confidence:  95%

  Tests: 12 passed 0 failed 0 skipped

  Evidence: evidence/
  Fingerprint: a1b2c3d4e5f6g7h8

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Verified by ShipGate ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 8: Ship - Verify Proof Bundle

```bash
$ isl proof verify ./evidence
```

**Output:**
```
Proof Bundle Verification
─────────────────────────────────────────────

Bundle: ./evidence
ID: proof-2026-02-02-abc123

Manifest Validation:
  ✓ Schema version: 2.0.0
  ✓ Bundle ID verified
  ✓ Spec hash matches
  ✓ All 8 files present

Gate Result:
  ✓ Verdict: SHIP
  ✓ Score: 97/100
  ✓ Blockers: 0

Build Result:
  ✓ Status: pass
  ✓ TypeScript: 5.3.3

Test Result:
  ✓ Status: pass
  ✓ Tests: 12/12 passed
  ✓ Framework: vitest 1.2.0

Evidence:
  ✓ Evaluator trace: 12 decisions
  ✓ Import graph: 1 resolved
  ✓ Run metadata: recorded

─────────────────────────────────────────────
VERDICT: PROVEN

All requirements met: Gate SHIP, Verify PROVEN, 12 tests, imports resolved

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verified by ShipGate ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Complete Flow Summary

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  QUICKSTART  │────▶│   CERTIFY    │────▶│    STATUS    │────▶│     SHIP     │
│  isl init    │     │  isl verify  │     │  isl gate    │     │  isl proof   │
│  isl build   │     │  --detailed  │     │              │     │    verify    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
   Create spec      Run verification      SHIP/NO-SHIP        Verify proof
   & scaffolds      with evidence         decision            bundle

                              │
                              ▼
                   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                   Verified by ShipGate ✓
                   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## JSON Output Mode

All commands support `--json` for machine-readable output:

```bash
$ isl gate specs/auth.isl --impl src/ --json
```

```json
{
  "decision": "SHIP",
  "exitCode": 0,
  "trustScore": 97,
  "confidence": 95,
  "summary": "SHIP: All 12 verifications passed. Trust score: 97%",
  "bundlePath": "evidence/",
  "manifest": {
    "fingerprint": "a1b2c3d4e5f6g7h8",
    "specHash": "sha256:...",
    "implHash": "sha256:...",
    "timestamp": "2026-02-02T12:00:00.000Z"
  },
  "results": {
    "clauses": [...],
    "summary": {
      "total": 12,
      "passed": 12,
      "failed": 0,
      "skipped": 0
    },
    "blockers": []
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | SHIP - All checks passed |
| 1 | NO-SHIP - Verification failed |
| 2 | Usage error (bad arguments) |
| 3 | Internal error |

## Next Steps

1. Integrate gate check into CI/CD pipeline
2. Store proof bundles as release artifacts
3. Monitor temporal SLAs in production
4. Set up baseline for existing violations

---

**Verified by ShipGate ✓**
