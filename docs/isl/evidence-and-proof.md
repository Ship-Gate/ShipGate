# Evidence and Proof in ISL

This document explains exactly what ISL verification proves, what it doesn't, and how evidence scoring works.

## The Honest Truth

**ISL is not a formal verification system.** It is an empirical testing framework.

When ISL says your implementation "passes verification," it means:

- Generated tests ran and passed
- Your code behaves correctly for the inputs we tested
- The trust score reflects test pass rates

It does **not** mean:

- Your code is mathematically proven correct
- All possible inputs have been tested
- No bugs exist in untested paths

## What ISL Verifies vs. Assumes

### Verified by Tests

| What | How | Confidence |
|------|-----|------------|
| Precondition checking | Tests with invalid inputs → expects error | High |
| Happy path behavior | Tests with valid inputs → expects success | High |
| Error case handling | Tests triggering each error → expects correct code | High |
| Type correctness | TypeScript compilation | High |
| Basic postconditions | Simple equality checks after execution | Medium |

### Verified Partially (PARTIAL state)

| What | Limitation |
|------|------------|
| Complex postconditions | Expression evaluator incomplete; many become `/* TODO */` |
| Entity existence checks | Requires runtime binding to actual data store |
| Aggregate constraints | `sum()`, `count()` require full data access |
| Temporal constraints | "within 200ms" tested but timing varies |

### Assumed (Not Verified)

| What | Why |
|------|-----|
| Concurrency correctness | No multi-threaded testing |
| Database transaction integrity | Tests use mock stores |
| Network failure handling | No chaos testing by default |
| Security properties | No penetration testing |
| Memory safety | Runtime language dependent |

## How Evidence Scoring Works

### The Scoring Formula

ISL calculates a trust score from 0-100 using weighted averages:

```
Trust Score = (Postconditions × 0.40) 
            + (Invariants × 0.30)
            + (Scenarios × 0.20)
            + (Temporal × 0.10)
```

### Clause States

Each test clause (precondition, postcondition, etc.) gets a state:

| State | Weight | Meaning |
|-------|--------|---------|
| `PASS` | 1.0 | Test passed completely |
| `PARTIAL` | 0.4 | Test ran but couldn't fully verify |
| `FAIL` | 0.0 | Test failed |

### Score Calculation Example

Given these clause results:

```
CreateUser postcondition "User.exists(result.id)"     → PASS
CreateUser postcondition "result.email == input.email" → PASS
CreateUser invariant "email is unique"                 → PASS
CreateUser scenario "happy path"                       → PASS
CreateUser scenario "duplicate email"                  → PASS
CreateUser temporal "within 200ms"                     → PARTIAL
DeleteUser postcondition "User.deleted"                → FAIL
```

Calculation:

```
Postconditions: (2 PASS) / 3 total → 2/3 = 66.7%
Invariants:     (1 PASS) / 1 total → 1/1 = 100%
Scenarios:      (2 PASS) / 2 total → 2/2 = 100%
Temporal:       (1 PARTIAL) / 1 total → 0.4/1 = 40%

Trust Score = (66.7 × 0.40) + (100 × 0.30) + (100 × 0.20) + (40 × 0.10)
            = 26.68 + 30 + 20 + 4
            = 80.68 ≈ 81/100
```

### Ship Decision

The default thresholds:

| Condition | Requirement |
|-----------|-------------|
| Minimum score | ≥ 85 |
| Maximum failures | 0 |

Ship decisions:

| Score | Failures | Decision |
|-------|----------|----------|
| ≥95 | 0 | `SHIP` (production ready) |
| ≥85 | 0 | `SHIP` (staging recommended) |
| ≥85 | >0 | `NO_SHIP` (failures block) |
| <85 | any | `NO_SHIP` |

## Evidence Report Structure

When verification runs, it produces an evidence report:

```json
{
  "version": "1.0",
  "reportId": "ev-123-456",
  "specFingerprint": "sha256:abc123...",
  "specName": "Auth",
  
  "clauseResults": [
    {
      "clauseId": "CreateUser.post.1",
      "state": "PASS",
      "clauseType": "postcondition",
      "evaluationTimeMs": 12,
      "message": "User.exists(result.id) verified"
    },
    {
      "clauseId": "CreateUser.post.2",
      "state": "PARTIAL",
      "clauseType": "postcondition",
      "message": "Expression evaluator could not fully compile: old(User.count) + 1 == User.count"
    }
  ],
  
  "scoreSummary": {
    "overallScore": 87,
    "passCount": 8,
    "partialCount": 2,
    "failCount": 0,
    "totalClauses": 10,
    "passRate": 80,
    "confidence": "medium",
    "recommendation": "ship"
  },
  
  "assumptions": [
    {
      "id": "assume-1",
      "description": "Database responds within timeout",
      "category": "environment",
      "impact": "high"
    }
  ],
  
  "openQuestions": [
    {
      "id": "q-1",
      "question": "How should concurrent CreateUser calls be handled?",
      "priority": "high"
    }
  ],
  
  "artifacts": [
    {
      "id": "art-1",
      "type": "test",
      "name": "auth.spec.ts",
      "location": "./generated/auth.spec.ts"
    }
  ],
  
  "metadata": {
    "startedAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:05Z",
    "durationMs": 5000,
    "agentVersion": "1.0.0",
    "mode": "full"
  }
}
```

## The Expression Evaluator Gap

The biggest limitation is the **expression evaluator**. Many ISL expressions cannot be automatically compiled into executable tests:

### Works Now

```isl
postconditions {
  result.email == input.email         # Simple equality
  result.status == PENDING            # Enum comparison
  result.id != null                   # Null checks
}
```

### Partially Works

```isl
postconditions {
  User.exists(result.id)              # Needs entity binding
  input.email.is_valid                # Needs method resolution
}
```

These get a `PARTIAL` state because we can generate a test structure but need manual completion.

### Doesn't Work Yet

```isl
postconditions {
  old(User.count) + 1 == User.count   # old() requires state snapshot
  sum(Order.amount) == expected       # Aggregate functions
  forall(items): item.valid           # Quantifiers
}
```

These become `/* TODO: verify old(User.count) + 1 == User.count */` in generated tests.

## What "Proven" vs "Tested" Means

### Tested (What ISL Does)

```
For specific inputs I₁, I₂, I₃...
  Run implementation
  Check outputs match postconditions
  
Result: "These specific cases passed"
```

### Proven (What ISL Does NOT Do)

```
For ALL possible inputs I
  Mathematically derive that
  postconditions MUST hold
  
Result: "This property always holds"
```

## Improving Your Trust Score

### 1. Write Testable Postconditions

```isl
# ✓ Easy to test
postconditions {
  result.status == ACTIVE
  result.email == input.email
}

# ✗ Hard to test (requires state)
postconditions {
  old(User.count) + 1 == User.count
}
```

### 2. Define All Error Cases

```isl
# More errors = more test coverage
errors {
  NOT_FOUND { when: "User doesn't exist" }
  INVALID_EMAIL { when: "Email format wrong" }
  DUPLICATE_EMAIL { when: "Email taken" }
  RATE_LIMITED { when: "Too many requests" }
}
```

### 3. Add Scenarios

```isl
scenarios CreateUser {
  scenario "successful creation" {
    given { no existing users }
    when { CreateUser(email: "new@example.com") }
    then { result is success }
  }
  
  scenario "duplicate email" {
    given { User.create(email: "taken@example.com") }
    when { CreateUser(email: "taken@example.com") }
    then { result is DUPLICATE_EMAIL }
  }
}
```

### 4. Use Invariants

```isl
invariants {
  # These are checked after every behavior
  email.is_valid implies User.email_verified or User.status == PENDING
  User.deleted implies User.sessions.empty
}
```

## Future: Formal Verification

ISL has a roadmap for actual formal verification:

| Feature | Status | Description |
|---------|--------|-------------|
| SMT Solver Integration | Planned | Use Z3/CVC5 for property proofs |
| Symbolic Execution | Planned | Explore all paths mathematically |
| Property-Based Testing | In Progress | QuickCheck-style generation |
| Model Checking | Planned | TLA+/Alloy integration |
| Mutation Testing | In Progress | Test the tests themselves |

When these ship, ISL will be able to provide actual proofs for suitable properties. Today, it provides rigorous testing.

## Summary

| Claim | Reality |
|-------|---------|
| "ISL proves correctness" | ISL tests for correctness |
| "Trust Score 95 = bug-free" | Trust Score 95 = 95% of tests pass |
| "Postconditions verified" | Postconditions tested (some partially) |
| "Production ready" | High confidence from testing, not proof |

ISL gives you **better confidence** than no testing and **structured verification** compared to ad-hoc tests. It does not give you mathematical certainty.

Be honest with yourself about what you're getting. It's still valuable—just not magic.
