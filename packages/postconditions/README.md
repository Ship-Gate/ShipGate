# @isl-lang/postconditions

Postcondition evaluation engine with evidence-based **PASS/PARTIAL/FAIL** semantics.

## Overview

This package provides deterministic evaluation of postconditions based on collected evidence. It implements an **evidence ladder** that prioritizes different types of evidence to determine the verification status of each postcondition clause.

## Installation

```bash
pnpm add @isl-lang/postconditions
```

## Usage

```typescript
import { evaluatePostconditions } from '@isl-lang/postconditions';

const result = evaluatePostconditions({
  specClauses: [
    { id: 'post-user-created', expression: 'result.id != null' },
    { id: 'post-email-sent', expression: 'sideEffects.emailSent == true' },
  ],
  evidence: [
    {
      type: 'EXECUTED_TEST',
      source: 'tests/user.test.ts',
      description: 'Test verifies post-user-created',
      coverage: 95,
    },
    {
      type: 'RUNTIME_ASSERT',
      source: 'src/services/user.ts',
      description: 'Assert for post-email-sent exists',
    },
  ],
});

console.log(result.clauseResults);
// [
//   { clauseId: 'post-user-created', status: 'PASS', evidenceType: 'EXECUTED_TEST', ... },
//   { clauseId: 'post-email-sent', status: 'PARTIAL', evidenceType: 'RUNTIME_ASSERT', ... },
// ]
```

## Status Definitions

### PASS ✅

The postcondition is **proven** by strong evidence:

- **BINDING_PROOF**: Static type system or formal verification proves the postcondition
- **EXECUTED_TEST**: Test executed with assertion passing and sufficient coverage (≥70% by default)

**What this means**: The postcondition is verified. No further action required.

### PARTIAL ⚠️

The postcondition has **some evidence** but is not fully proven:

- **EXECUTED_TEST** with low coverage (<70%): Test exists but coverage is insufficient
- **RUNTIME_ASSERT**: Runtime assertion present but not yet executed in tests
- **HEURISTIC_MATCH**: Heuristic analysis suggests compliance but no proof

**What this means**: The postcondition is partially verified. Additional work needed.

### FAIL ❌

The postcondition has **no evidence** or **contradicting evidence**:

- **NO_EVIDENCE**: No tests, assertions, or proofs found
- **Contradicting evidence**: Test failed or evidence explicitly contradicts the postcondition

**What this means**: The postcondition is not verified. Immediate action required.

## Evidence Ladder

The evaluator uses a deterministic **evidence ladder** to prioritize evidence types (strongest to weakest):

| Priority | Evidence Type      | Status  | Description |
|----------|-------------------|---------|-------------|
| 1        | `BINDING_PROOF`   | PASS    | Static proof via type system or formal verification |
| 2        | `EXECUTED_TEST`   | PASS*   | Test executed with passing assertion (*PARTIAL if low coverage) |
| 3        | `RUNTIME_ASSERT`  | PARTIAL | Runtime assertion present but not executed in tests |
| 4        | `HEURISTIC_MATCH` | PARTIAL | Heuristic/pattern matching suggests compliance |
| 5        | `NO_EVIDENCE`     | FAIL    | No evidence found |

When multiple evidence types exist for a clause, the **strongest** (lowest priority number) is used.

## Turning PARTIAL → PASS

### For EXECUTED_TEST with low coverage:

```
requiredNextStep: "Increase test coverage from 50% to at least 70%"
```

**Actions:**
1. Add more test cases covering edge cases
2. Ensure all branches in the code path are covered
3. Use coverage tools to identify gaps

### For RUNTIME_ASSERT:

```
requiredNextStep: "Execute tests that trigger the runtime assertion"
```

**Actions:**
1. Write tests that exercise the code path containing the assertion
2. Ensure the assertion is actually evaluated during test execution
3. Verify the assertion passes with valid inputs

### For HEURISTIC_MATCH:

```
requiredNextStep: "Add explicit test for: result.status == 'success'"
```

**Actions:**
1. Write an explicit test that checks the postcondition
2. Add a runtime assertion if applicable
3. Consider if a type-level proof is possible

## API Reference

### `evaluatePostconditions(input, config?)`

Evaluate postconditions with evidence-based semantics.

**Parameters:**

- `input.specClauses`: Array of `SpecClause` objects to evaluate
- `input.evidence`: Array of `Evidence` objects collected from various sources
- `config`: Optional `EvaluatorConfig` for customization

**Returns:** `EvaluationResult` with:
- `clauseResults`: Array of `ClauseResult` for each clause
- `summary`: Statistics (total, passed, partial, failed, passRate)
- `evaluatedAt`: ISO timestamp

### `compareEvidenceTypes(a, b, priority?)`

Compare two evidence types by priority.

**Returns:** Negative if `a` is stronger, positive if `b` is stronger, zero if equal.

### `isEvidenceSufficientFor(evidenceType, targetStatus, config?)`

Check if an evidence type is strong enough for a given status.

### `getRequiredEvidenceFor(targetStatus)`

Get the evidence types that can achieve a target status.

## Configuration

```typescript
interface EvaluatorConfig {
  // Minimum coverage for EXECUTED_TEST to achieve PASS (default: 70)
  minCoverageForPass?: number;

  // Require executed tests for PASS, not just BINDING_PROOF (default: false)
  requireExecutedTests?: boolean;

  // Allow HEURISTIC_MATCH to contribute to PARTIAL (default: true)
  allowHeuristicPartial?: boolean;

  // Custom evidence priority overrides
  evidencePriority?: Partial<Record<EvidenceType, number>>;
}
```

## Types

### SpecClause

```typescript
interface SpecClause {
  id: string;                    // Unique identifier
  expression: string;            // Condition expression
  description?: string;          // Human-readable description
  category?: 'success' | 'error' | 'invariant' | 'state_change' | 'general';
  behaviorId?: string;           // Parent behavior ID
  isConditional?: boolean;       // Is this an implies condition?
  antecedent?: string;           // Antecedent for conditional postconditions
}
```

### Evidence

```typescript
interface Evidence {
  type: EvidenceType;            // Type of evidence
  source: string;                // Source file/test name
  description: string;           // Human-readable description
  location?: {                   // Optional source location
    file: string;
    line?: number;
    column?: number;
  };
  coverage?: number;             // Coverage percentage (for EXECUTED_TEST)
  metadata?: Record<string, unknown>;  // Additional metadata
}
```

### ClauseResult

```typescript
interface ClauseResult {
  clauseId: string;              // Clause that was evaluated
  status: PostconditionStatus;   // PASS | PARTIAL | FAIL
  evidenceType: EvidenceType;    // Primary evidence type
  evidence: Evidence[];          // All matched evidence
  notes: string[];               // Explanation notes
  requiredNextStep?: string;     // Action to improve status
  confidence: number;            // Confidence score (0-1)
}
```

## Evidence Matching

Evidence is matched to clauses using:

1. **Clause ID in source**: Evidence source contains the clause ID
2. **Clause ID in description**: Evidence description mentions the clause ID
3. **Expression patterns**: Keywords from the expression appear in evidence
4. **Behavior ID**: Evidence source matches the clause's behavior ID

## License

MIT
