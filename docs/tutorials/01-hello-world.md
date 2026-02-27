# Tutorial 1: Hello World

**Time:** ~30 minutes  
**Goal:** Create your first IntentOS project with a spec, implementation, verification, and gate check.

## Overview

In this tutorial, you'll:
1. Create a simple "Greeter" domain specification
2. Implement the greeter in TypeScript
3. Verify the implementation matches the spec
4. Run the gate to get a SHIP/NO_SHIP decision

## Prerequisites

- Node.js 18+ installed
- Terminal/command line access
- Basic TypeScript knowledge (helpful but not required)

## Step 1: Install IntentOS CLI

```bash
# Install globally (recommended)
npm install -g shipgate

# Or use npx (no installation)
npx shipgate --version
```

**Expected output:**
```
shipgate/1.0.0
```

## Step 2: Create Project Directory

```bash
mkdir hello-world-tutorial
cd hello-world-tutorial
```

## Step 3: Initialize Project

```bash
shipgate init --template minimal
```

**Expected output:**
```
✓ Detected: typescript
✓ Created .shipgate.yml
✓ Created specs/ directory
✓ Created specs/example.isl
```

## Step 4: Create the Greeter Specification

Create `specs/greeter.isl`:

```isl
domain Greeter {
  version: "1.0.0"

  behavior Greet {
    input {
      name: String
    }

    output {
      success: String
      errors {
        EMPTY_NAME {
          when: "Name is empty or whitespace"
        }
      }
    }

    pre {
      name.length > 0
      name.trim().length > 0
    }

    post success {
      result.contains(input.name)
      result.length > input.name.length
    }
  }
}
```

**What this spec means:**
- `Greet` behavior takes a `name` string as input
- Preconditions: name must not be empty
- Postconditions: result must contain the name and be longer than the name
- Error: `EMPTY_NAME` if name is empty

## Step 5: Validate the Specification

```bash
shipgate check specs/greeter.isl
```

**Expected output:**
```
✓ Parsed specs/greeter.isl
✓ Type check passed
✓ No errors found
```

## Step 6: Create Implementation

Create `src/greeter.ts`:

```typescript
export function greet(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error('EMPTY_NAME');
  }
  
  return `Hello, ${name}!`;
}
```

## Step 7: Verify Implementation

```bash
shipgate verify specs/greeter.isl --impl src/greeter.ts
```

**Expected output:**
```
Running verification...

Greet:
  Preconditions:
    ✓ name.length > 0
    ✓ name.trim().length > 0
  Postconditions:
    ✓ result.contains(input.name)
    ✓ result.length > input.name.length
  Error handling:
    ✓ EMPTY_NAME thrown correctly

Verdict: SHIP ✓  Trust Score: 100/100
```

## Step 8: Run the Gate

The gate provides a SHIP/NO_SHIP decision based on trust score:

```bash
shipgate gate specs/greeter.isl --impl src/greeter.ts --threshold 80
```

**Expected output:**
```
═══════════════════════════════════════════════════════════════
  Gate Decision
═══════════════════════════════════════════════════════════════

Trust Score: 100/100
Confidence: 95%
Threshold: 80

Decision: SHIP ✓

All checks passed:
  ✓ Preconditions validated
  ✓ Postconditions validated
  ✓ Error handling correct
  ✓ Invariants maintained

Evidence bundle saved to: .shipgate/proofs/greeter-2026-02-09T12-00-00.zip
```

## Step 9: Test with Different Inputs

Create `src/greeter.test.ts`:

```typescript
import { greet } from './greeter';

describe('greet', () => {
  it('should greet a valid name', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });

  it('should throw EMPTY_NAME for empty string', () => {
    expect(() => greet('')).toThrow('EMPTY_NAME');
  });

  it('should throw EMPTY_NAME for whitespace', () => {
    expect(() => greet('   ')).toThrow('EMPTY_NAME');
  });
});
```

Run tests:
```bash
npm test
```

## Step 10: Generate Code from Spec (Optional)

You can generate TypeScript types from your spec:

```bash
shipgate gen specs/greeter.isl --target typescript --output src/generated
```

This creates type definitions you can use in your implementation.

## Complete Project Structure

```
hello-world-tutorial/
├── .shipgate.yml
├── specs/
│   └── greeter.isl
├── src/
│   ├── greeter.ts
│   └── greeter.test.ts
└── package.json
```

## Troubleshooting

### Error: "Command not found: shipgate"

**Solution:** Install globally or use npx:
```bash
npm install -g shipgate
# or
npx shipgate <command>
```

### Error: "Spec file not found"

**Solution:** Make sure you're in the project directory and the spec file exists:
```bash
ls specs/greeter.isl
```

### Error: "Implementation file not found"

**Solution:** Check the path to your implementation:
```bash
ls src/greeter.ts
```

### Verification fails with "NO_SHIP"

**Common causes:**
1. Implementation doesn't match spec preconditions/postconditions
2. Error handling doesn't match spec errors
3. Missing return type or incorrect return value

**Solution:** Review the verification output for specific failures and update your implementation.

### Gate fails with trust score below threshold

**Solution:** 
- Check verification output for failed checks
- Fix implementation to match spec
- Lower threshold temporarily for testing: `--threshold 70`

## Next Steps

- ✅ You've created your first IntentOS spec
- ✅ You've verified an implementation
- ✅ You've run the gate

**Continue to:** [Tutorial 2: REST API](./02-rest-api.md) to build a complete API with IntentOS.

## Summary

In this tutorial, you learned:
- How to create an ISL specification
- How to implement a behavior in TypeScript
- How to verify implementation against spec
- How to use the gate for SHIP/NO_SHIP decisions

The key concepts:
- **Specifications** define what code should do
- **Verification** checks if code matches the spec
- **Gate** provides a go/no-go decision based on trust score
