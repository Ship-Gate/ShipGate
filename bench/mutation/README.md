# ISL Mutation Testing Harness

A mutation testing framework that validates the ISL verification system catches real bugs by intentionally breaking code and ensuring the verifier properly fails.

## Purpose

Mutation testing answers the question: **"Does our verification actually catch bugs?"**

This harness:
1. Runs baseline verification on correct code (should PASS)
2. Applies specific mutations that break contracts
3. Re-runs verification (should FAIL with lower score)
4. Asserts that the verifier detected the mutation

## Mutation Types

### 1. Remove Runtime Assert
Deletes assert statements that enforce preconditions/invariants at runtime.

```typescript
// Before
assert(amount > 0, 'Amount must be positive');
return processPayment(amount);

// After (mutated)
return processPayment(amount);
```

### 2. Change Comparator
Weakens boundary conditions by changing strict comparators.

```typescript
// Before
if (balance > 0) { ... }

// After (mutated - > to >=)
if (balance >= 0) { ... }
```

### 3. Delete Test Expectation
Removes postcondition checks from test assertions.

```typescript
// Before
expect(result.status).toBe('success');
expect(result.data).toBeDefined();

// After (mutated)
expect(result.status).toBe('success');
// expect(result.data).toBeDefined(); // DELETED
```

### 4. Bypass Precondition
Short-circuits precondition validation.

```typescript
// Before
function checkPreconditions(input: Input): boolean {
  return input.amount > 0 && input.userId !== null;
}

// After (mutated)
function checkPreconditions(input: Input): boolean {
  return true; // BYPASSED
}
```

## Usage

### Run All Mutation Tests

```bash
npx tsx bench/mutation/src/runner.ts
```

### Run Specific Mutation Type

```bash
npx tsx bench/mutation/src/runner.ts --mutation remove-assert
npx tsx bench/mutation/src/runner.ts --mutation change-comparator
npx tsx bench/mutation/src/runner.ts --mutation delete-expectation
npx tsx bench/mutation/src/runner.ts --mutation bypass-precondition
```

### Options

```
-m, --mutation <type>   Run only specific mutation type
-f, --fixture <name>    Run only specific fixture
-v, --verbose           Enable verbose output
--bail                  Stop on first mutation that survives
```

## Directory Structure

```
bench/mutation/
├── README.md              # This file
├── src/
│   ├── index.ts           # Main exports
│   ├── runner.ts          # CLI runner
│   ├── harness.ts         # Mutation harness logic
│   ├── mutators/
│   │   ├── index.ts       # Mutator registry
│   │   ├── remove-assert.ts
│   │   ├── change-comparator.ts
│   │   ├── delete-expectation.ts
│   │   └── bypass-precondition.ts
│   └── types.ts           # Type definitions
└── fixtures/
    ├── baseline/
    │   ├── counter.impl.ts    # Reference implementation
    │   ├── counter.isl        # ISL spec
    │   └── counter.test.ts    # Test file
    └── mutations/
        ├── assert-removed.ts
        ├── comparator-changed.ts
        ├── expectation-deleted.ts
        └── precondition-bypassed.ts
```

## Expected Results

Each mutation should:
1. **Compile successfully** - Mutations are syntactically valid
2. **Fail verification** - The verifier catches the contract violation
3. **Show score drop** - Trust score decreases from baseline
4. **Identify violated clause** - Reports which contract clause failed

Example output:

```
Mutation Testing Results
========================

Fixture: counter
  Baseline: VERIFIED (score: 100)
  
  Mutations:
    ✗ remove-assert
      Status: KILLED (good!)
      Score: 100 → 65 (-35)
      Failed: postcondition_success_1 (result.value > 0)
      
    ✗ change-comparator
      Status: KILLED (good!)
      Score: 100 → 50 (-50)
      Failed: invariant_1 (balance > 0)
      
    ✗ delete-expectation
      Status: KILLED (good!)
      Score: 100 → 80 (-20)
      Failed: postcondition_success_2 (result.data != null)
      
    ✗ bypass-precondition
      Status: KILLED (good!)
      Score: 100 → 0 (-100)
      Failed: precondition_1 (amount > 0)

Summary: 4/4 mutations killed (100% mutation score)
```

## How It Works

1. **Parse baseline** - Load the ISL spec and reference implementation
2. **Run baseline verify** - Execute verification, record score
3. **Apply mutation** - Transform the source code
4. **Re-run verify** - Execute verification on mutated code
5. **Assert detection** - Verify score dropped and correct clause failed

## Writing New Fixtures

Create a new fixture directory with:

```
fixtures/my-fixture/
├── spec.isl           # ISL specification
├── impl.ts            # Reference implementation
├── mutations.json     # Mutation definitions
└── expected.json      # Expected verification results
```

`mutations.json` example:
```json
{
  "mutations": [
    {
      "id": "remove-balance-check",
      "type": "remove-assert",
      "target": "impl.ts",
      "line": 15,
      "expectedFailedClause": "invariant_balance_positive"
    }
  ]
}
```

## Integration with CI

Add to your CI pipeline:

```yaml
- name: Run mutation tests
  run: npx tsx bench/mutation/src/runner.ts --bail
```

A non-zero exit code indicates surviving mutations (verification gaps).
