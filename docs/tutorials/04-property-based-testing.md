# Tutorial 4: Property-Based Testing

**Time:** ~45 minutes  
**Goal:** Use property-based testing (PBT) to automatically find edge cases and verify your implementation handles all valid inputs correctly.

## Overview

In this tutorial, you'll:
1. Create a calculator domain specification
2. Implement a calculator with basic operations
3. Use PBT to automatically generate test cases
4. Discover and fix edge cases found by PBT

## Prerequisites

- Completed [Hello World tutorial](./01-hello-world.md)
- Basic understanding of testing concepts
- Node.js 18+ installed

## Step 1: Create Project

```bash
mkdir pbt-tutorial
cd pbt-tutorial
shipgate init --template minimal
```

## Step 2: Create Calculator Specification

Create `specs/calculator.isl`:

```isl
domain Calculator {
  version: "1.0.0"

  behavior Add {
    input {
      a: Number
      b: Number
    }

    output {
      success: Number
      errors {
        OVERFLOW {
          when: "Result exceeds maximum safe integer"
        }
        UNDERFLOW {
          when: "Result below minimum safe integer"
        }
      }
    }

    pre {
      a.is_finite
      b.is_finite
    }

    post success {
      result == a + b
      result.is_finite
    }

    invariants {
      commutative: forall x, y: Add(x, y) == Add(y, x)
      associative: forall x, y, z: Add(Add(x, y), z) == Add(x, Add(y, z))
      identity: forall x: Add(x, 0) == x
    }
  }

  behavior Multiply {
    input {
      a: Number
      b: Number
    }

    output {
      success: Number
      errors {
        OVERFLOW {
          when: "Result exceeds maximum safe integer"
        }
      }
    }

    pre {
      a.is_finite
      b.is_finite
    }

    post success {
      result == a * b
      result.is_finite
    }

    invariants {
      commutative: forall x, y: Multiply(x, y) == Multiply(y, x)
      associative: forall x, y, z: Multiply(Multiply(x, y), z) == Multiply(x, Multiply(y, z))
      identity: forall x: Multiply(x, 1) == x
      zero: forall x: Multiply(x, 0) == 0
    }
  }

  behavior Divide {
    input {
      a: Number
      b: Number
    }

    output {
      success: Number
      errors {
        DIVIDE_BY_ZERO {
          when: "Division by zero"
        }
        OVERFLOW {
          when: "Result exceeds maximum safe integer"
        }
      }
    }

    pre {
      a.is_finite
      b.is_finite
      b != 0
    }

    post success {
      result == a / b
      result.is_finite
    }
  }
}
```

**Key features:**
- Mathematical invariants (commutative, associative, identity)
- Overflow/underflow error handling
- Division by zero protection

## Step 3: Validate Specification

```bash
shipgate check specs/calculator.isl
```

**Expected output:**
```
✓ Parsed specs/calculator.isl
✓ Type check passed
✓ Invariants validated
✓ No errors found
```

## Step 4: Implement Calculator

Create `src/calculator.ts`:

```typescript
const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const MIN_SAFE_INTEGER = Number.MIN_SAFE_INTEGER;

export function add(a: number, b: number): number {
  // Preconditions
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Input must be finite numbers');
  }

  const result = a + b;

  // Check overflow/underflow
  if (result > MAX_SAFE_INTEGER) {
    throw new Error('OVERFLOW');
  }
  if (result < MIN_SAFE_INTEGER) {
    throw new Error('UNDERFLOW');
  }

  // Postconditions
  if (!Number.isFinite(result)) {
    throw new Error('Result must be finite');
  }

  return result;
}

export function multiply(a: number, b: number): number {
  // Preconditions
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Input must be finite numbers');
  }

  const result = a * b;

  // Check overflow
  if (result > MAX_SAFE_INTEGER || result < MIN_SAFE_INTEGER) {
    throw new Error('OVERFLOW');
  }

  // Postconditions
  if (!Number.isFinite(result)) {
    throw new Error('Result must be finite');
  }

  return result;
}

export function divide(a: number, b: number): number {
  // Preconditions
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Input must be finite numbers');
  }
  if (b === 0) {
    throw new Error('DIVIDE_BY_ZERO');
  }

  const result = a / b;

  // Check overflow
  if (result > MAX_SAFE_INTEGER || result < MIN_SAFE_INTEGER) {
    throw new Error('OVERFLOW');
  }

  // Postconditions
  if (!Number.isFinite(result)) {
    throw new Error('Result must be finite');
  }

  return result;
}
```

## Step 5: Run Property-Based Testing

```bash
shipgate pbt specs/calculator.isl --impl src/calculator.ts --tests 1000
```

**Expected output:**
```
Running property-based tests...

Add:
  Testing commutative property...
    ✓ Passed 1000 tests
  Testing associative property...
    ✓ Passed 1000 tests
  Testing identity property...
    ✓ Passed 1000 tests

Multiply:
  Testing commutative property...
    ✓ Passed 1000 tests
  Testing associative property...
    ✓ Passed 1000 tests
  Testing identity property...
    ✓ Passed 1000 tests
  Testing zero property...
    ✓ Passed 1000 tests

Divide:
  Testing postconditions...
    ✓ Passed 1000 tests

All properties passed! ✓
```

## Step 6: Discover Edge Cases

Let's intentionally introduce a bug to see PBT find it. Update `src/calculator.ts`:

```typescript
export function add(a: number, b: number): number {
  // BUG: Missing overflow check for negative numbers
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Input must be finite numbers');
  }

  const result = a + b;

  // BUG: Only checking positive overflow
  if (result > MAX_SAFE_INTEGER) {
    throw new Error('OVERFLOW');
  }
  // Missing: if (result < MIN_SAFE_INTEGER) { throw new Error('UNDERFLOW'); }

  return result;
}
```

Run PBT again:

```bash
shipgate pbt specs/calculator.isl --impl src/calculator.ts --tests 1000
```

**Expected output:**
```
Running property-based tests...

Add:
  Testing commutative property...
    ✓ Passed 1000 tests
  Testing identity property...
    ✗ Failed after 234 tests
    Counterexample:
      a = -9007199254740991
      b = -1
      Expected: UNDERFLOW error
      Actual: -9007199254740992 (no error)

Shrinking counterexample...
  Minimal counterexample:
    a = -9007199254740991
    b = -1

Found violation! ✗
```

PBT found the bug! It generated test cases that discovered the missing underflow check.

## Step 7: Fix the Bug

Restore the correct implementation:

```typescript
export function add(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Input must be finite numbers');
  }

  const result = a + b;

  if (result > MAX_SAFE_INTEGER) {
    throw new Error('OVERFLOW');
  }
  if (result < MIN_SAFE_INTEGER) {
    throw new Error('UNDERFLOW');
  }

  if (!Number.isFinite(result)) {
    throw new Error('Result must be finite');
  }

  return result;
}
```

## Step 8: Run PBT with Shrinking

PBT automatically shrinks counterexamples to find the minimal failing case:

```bash
shipgate pbt specs/calculator.isl --impl src/calculator.ts --tests 1000 --max-shrinks 100
```

**Expected output:**
```
Running property-based tests with shrinking...

All properties passed! ✓
Shrinking enabled: will minimize any counterexamples found
```

## Step 9: Test Specific Properties

You can test individual properties:

```bash
shipgate pbt specs/calculator.isl --impl src/calculator.ts \
  --property "Add.commutative" \
  --tests 5000
```

## Step 10: Generate Test Report

Generate a detailed PBT report:

```bash
shipgate pbt specs/calculator.isl --impl src/calculator.ts \
  --tests 1000 \
  --json > pbt-report.json
```

## Complete Project Structure

```
pbt-tutorial/
├── .shipgate.yml
├── specs/
│   └── calculator.isl
├── src/
│   └── calculator.ts
├── pbt-report.json
└── package.json
```

## Troubleshooting

### PBT finds violations but implementation looks correct

**Solution:** 
- Check if your implementation matches all invariants
- Review the counterexample carefully
- Ensure edge cases are handled (NaN, Infinity, very large numbers)

### PBT runs slowly

**Solution:**
- Reduce test count: `--tests 100`
- Focus on specific properties: `--property "Add.commutative"`
- Use seed for reproducibility: `--seed 12345`

### Counterexample is too large

**Solution:**
- Enable shrinking: `--max-shrinks 100`
- PBT will automatically minimize the counterexample

### Properties not being tested

**Solution:**
- Ensure invariants are specified in the ISL spec
- Check that property names match spec invariant names
- Verify implementation exports match behavior names

## Advanced: Custom Generators

You can specify custom input generators in your spec:

```isl
behavior Add {
  input {
    a: Number [generator: "range(-1000, 1000)"]
    b: Number [generator: "range(-1000, 1000)"]
  }
  // ...
}
```

## Next Steps

- ✅ You've used PBT to verify mathematical properties
- ✅ You've discovered edge cases automatically
- ✅ You've fixed bugs found by PBT

**Continue to:** [Tutorial 5: Chaos Testing](./05-chaos-testing.md) to test resilience.

## Summary

In this tutorial, you learned:
- How to specify invariants in ISL
- How to run property-based testing
- How PBT finds edge cases automatically
- How shrinking minimizes counterexamples

Key concepts:
- **Invariants** are properties that must always hold
- **PBT** generates random inputs to test invariants
- **Shrinking** finds minimal counterexamples
- **Counterexamples** help identify bugs quickly
