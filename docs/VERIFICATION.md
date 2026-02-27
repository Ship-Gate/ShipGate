# ISL Verification System

This document explains the verification model, tri-state logic, and what "PROVEN" means in ISL.

## Overview

ISL uses a multi-layered verification approach:

1. **Gate Checks** - Static analysis rules (SHIP/NO_SHIP)
2. **Build Verification** - TypeScript compilation
3. **Test Verification** - Runtime test execution
4. **Proof Bundles** - Immutable verification records

---

## Tri-State Logic

### The Problem with Boolean Verification

Traditional verification uses boolean logic: `true` or `false`. But real-world verification often can't determine truth:

```typescript
// Can we verify this postcondition?
postconditions {
  User.exists(result.id)  // Requires database access at verification time
}
```

Without runtime context, we can't know if the user exists.

### The Tri-State Solution

ISL uses **tri-state logic** with three values:

| Value | Meaning | When |
|-------|---------|------|
| `true` | Definitely satisfied | Evidence proves the condition |
| `false` | Definitely violated | Evidence proves the condition is violated |
| `'unknown'` | Cannot determine | Insufficient evidence or unreachable |

### Implementation

```typescript
// packages/verifier-runtime/src/evaluator.ts
export type TriState = true | false | 'unknown';

// Check if a value is unknown
export function isUnknown(value: unknown): value is 'unknown' {
  return value === 'unknown';
}

// Tri-state logical operations
export function triStateAnd(left: TriState, right: TriState): TriState {
  if (left === false || right === false) return false;
  if (left === 'unknown' || right === 'unknown') return 'unknown';
  return true;
}

export function triStateOr(left: TriState, right: TriState): TriState {
  if (left === true || right === true) return true;
  if (left === 'unknown' || right === 'unknown') return 'unknown';
  return false;
}

export function triStateNot(operand: TriState): TriState {
  if (operand === 'unknown') return 'unknown';
  return !operand;
}

export function triStateImplies(left: TriState, right: TriState): TriState {
  if (left === false) return true;  // false implies anything is true
  if (left === true && right === 'unknown') return 'unknown';
  if (left === true) return right;
  return 'unknown';
}
```

### Evaluation Results

Every expression evaluation returns a structured result:

```typescript
export interface EvaluationResult {
  /** Tri-state result: true, false, or 'unknown' */
  value: TriState;
  
  /** Source location of the expression */
  location: AST.SourceLocation;
  
  /** Why evaluation failed (if value is false or unknown) */
  reason?: string;
  
  /** Nested evaluation results for compound expressions */
  children?: EvaluationResult[];
}
```

---

## Proof Verdicts

### The Four Verdicts

Proof bundles use a **four-state verdict** system:

| Verdict | Definition | Requirements |
|---------|------------|--------------|
| `PROVEN` | All requirements met | Gate SHIP + Build PASS + Tests PASS (count > 0) |
| `INCOMPLETE_PROOF` | Partial evidence | Gate SHIP + Build PASS + Tests = 0 |
| `VIOLATED` | Requirement failed | Gate NO_SHIP OR Build FAIL OR Tests FAIL |
| `UNPROVEN` | Cannot determine | Manual review required |

### What "PROVEN" Means

**PROVEN does NOT mean mathematically proven.** It means:

1. **Gate Verdict = SHIP**
   - All semantic rules pass
   - No hard blockers
   - Score >= threshold

2. **Build = PASS**
   - TypeScript compilation succeeds
   - No type errors

3. **Tests = PASS with count > 0**
   - Test suite executed
   - All tests passed
   - At least one test ran

### Verdict Calculation

```typescript
// packages/isl-proof/src/manifest.ts
export function calculateVerdict(
  gateResult: ManifestGateResult,
  buildResult: BuildResult,
  testResult: TestResult,
  testDeclaration?: DomainTestDeclaration
): { verdict: ProofVerdict; reason: string } {
  // Gate must be SHIP
  if (gateResult.verdict !== 'SHIP') {
    return {
      verdict: 'VIOLATED',
      reason: `Gate verdict is NO_SHIP (score: ${gateResult.score}, blockers: ${gateResult.blockers})`,
    };
  }
  
  // Build must pass
  if (buildResult.status === 'fail') {
    return {
      verdict: 'VIOLATED',
      reason: `Build failed with ${buildResult.errorCount} errors`,
    };
  }
  
  // Tests must pass (if there are any)
  if (testResult.status === 'fail') {
    return {
      verdict: 'VIOLATED',
      reason: `Tests failed: ${testResult.failedTests}/${testResult.totalTests}`,
    };
  }
  
  // Check for test count
  if (testResult.totalTests === 0) {
    // Domain can explicitly declare no tests needed
    if (testDeclaration?.noTestsRequired) {
      return {
        verdict: 'PROVEN',
        reason: `Gate SHIP, build pass, no tests required: ${testDeclaration.reason}`,
      };
    }
    
    return {
      verdict: 'INCOMPLETE_PROOF',
      reason: 'Gate SHIP and build pass, but testCount = 0',
    };
  }
  
  // All checks passed
  return {
    verdict: 'PROVEN',
    reason: `Gate SHIP (score: ${gateResult.score}), build pass, ${testResult.passedTests}/${testResult.totalTests} tests pass`,
  };
}
```

---

## Verification Evidence

### Clause Evidence

Each postcondition/invariant produces evidence:

```typescript
export interface ClauseEvidence {
  clauseId: string;
  type: 'postcondition' | 'invariant';
  behavior?: string;
  sourceSpan: {
    file: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  evaluatedResult: {
    status: 'proven' | 'not_proven' | 'failed';
    value?: boolean;
    reason?: string;
    expected?: boolean;
    actual?: boolean;
    error?: string;
  };
}
```

### Postcondition Verification Result

```typescript
export interface PostconditionVerificationResult {
  verdict: 'PROVEN' | 'NOT_PROVEN' | 'INCOMPLETE_PROOF' | 'VIOLATED';
  evidence: ClauseEvidence[];
  summary: {
    totalClauses: number;
    provenClauses: number;
    notProvenClauses: number;
    failedClauses: number;
    incompleteClauses: number;
  };
  durationMs: number;
}
```

---

## Proof Bundle Structure

### Manifest Schema (v2)

```typescript
export interface ProofBundleManifest {
  schemaVersion: '2.0.0';
  bundleId: string;  // SHA-256 hash of contents
  generatedAt: string;
  
  spec: {
    domain: string;
    version: string;
    specHash: string;  // SHA-256 of spec content
    specPath?: string;
  };
  
  policyVersion: {
    bundleVersion: string;
    shipgateVersion: string;
    packs: RulepackVersion[];
  };
  
  gateResult: ManifestGateResult;
  buildResult: BuildResult;
  testResult: TestResult;
  testDeclaration?: DomainTestDeclaration;
  
  // Optional verification results
  verificationEvaluation?: VerificationEvaluationResult;
  postconditionVerification?: PostconditionVerificationResult;
  
  iterations: IterationRecord[];  // Healing history
  
  verdict: ProofVerdict;
  verdictReason: string;
  
  files: string[];  // Files in bundle
  
  project: {
    root: string;
    repository?: string;
    branch?: string;
    commit?: string;
    author?: string;
  };
  
  signature?: {
    algorithm: 'hmac-sha256' | 'ed25519';
    value: string;
    keyId?: string;
  };
}
```

### Bundle Files

```
proof-bundle/
├── manifest.json      # Full manifest with verdict
├── spec.isl           # Original specification
├── gate-result.json   # Gate check details
├── test-result.json   # Test execution results
├── build-result.json  # Build output
├── iterations/        # Healing iterations (if any)
│   ├── 1-diff.patch
│   └── 2-diff.patch
└── evidence/          # Raw evidence files
```

---

## Verification Commands

### Create Proof Bundle

```bash
shipgate proof create \
  --spec auth.isl \
  --output ./proof-bundle \
  --sign-secret $ISL_SIGN_SECRET
```

### Verify Proof Bundle

```bash
shipgate proof verify ./proof-bundle \
  --sign-secret $ISL_SIGN_SECRET
```

Output:
```
═══════════════════════════════════════════════════════════════
 Proof Bundle Verification
═══════════════════════════════════════════════════════════════

Status: ✓ VALID
Verdict: PROVEN
Complete: Yes
Signature: Valid

──────────────────────────────────────────────────────────────
 Checks: 8/8 passed
──────────────────────────────────────────────────────────────

Bundle Info:
  ID: a1b2c3d4e5f6...
  Domain: auth v1.0.0
  Generated: 2026-02-02T10:30:00Z
  Gate: SHIP (score: 100)
  Build: pass
  Tests: 15/15

═══════════════════════════════════════════════════════════════
```

### Check Proof Completeness

```typescript
import { checkProofCompleteness } from '@isl-lang/pipeline';

const result = checkProofCompleteness({
  gateScore: 100,
  gateVerdict: 'SHIP',
  testsPassed: 15,
  testsFailed: 0,
  typecheckPassed: true,
  buildPassed: true,
  hasStubs: false,
});

console.log(result);
// { complete: true, status: 'PROVEN', missing: [], warnings: [] }
```

---

## Verification Levels

### Level 1: Gate Check (Static Analysis)

```bash
shipgate gate ./src --policy intent-pack
```

Checks:
- Semantic rules (audit, rate-limit, PII)
- Code quality rules
- No stubbed handlers

### Level 2: Build Verification

```bash
pnpm tsc --noEmit
```

Checks:
- Type safety
- Import resolution
- No compilation errors

### Level 3: Test Verification

```bash
pnpm vitest run
```

Checks:
- Precondition tests
- Postcondition assertions
- Integration tests

### Level 4: Proof Bundle

Combines all levels into an immutable record with:
- Cryptographic integrity (bundle ID)
- Optional signing
- Audit trail

---

## Best Practices

### 1. Avoid INCOMPLETE_PROOF

```isl
domain Auth {
  // BAD: No tests, gets INCOMPLETE_PROOF
  behavior Login { ... }
  
  // GOOD: Either add tests OR declare no tests needed
  @noTestsRequired("Pure validation, tested via integration")
  behavior ValidateEmail { ... }
}
```

### 2. Handle 'unknown' Gracefully

```typescript
const result = evaluateExpression(postcondition, context);

if (result.value === 'unknown') {
  // Don't fail - escalate to runtime verification
  return { status: 'deferred', reason: result.reason };
}

if (result.value === false) {
  return { status: 'violated', evidence: result };
}

return { status: 'proven', evidence: result };
```

### 3. Provide Evaluation Context

```typescript
const context: EvaluationContext = {
  domain: parsedDomain,
  input: requestBody,
  result: responseData,
  variables: new Map(),
  store: entityStore,  // For User.exists(), etc.
  oldState: snapshot,  // For old() expressions
};
```

---

## Related Documentation

- [IMPORTS.md](./IMPORTS.md) - Module resolution
- [SEMANTICS.md](./SEMANTICS.md) - Semantic diagnostics
- [rules/README.md](./rules/README.md) - Semantic rule reference
