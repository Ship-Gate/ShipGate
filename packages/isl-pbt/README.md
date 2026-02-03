# @isl-lang/pbt

Property-Based Testing for ISL (Intent Specification Language).

Generate random inputs satisfying preconditions and verify postconditions with automatic shrinking.

## Features

- **Type-aware generators**: Generate valid emails, passwords, UUIDs, etc.
- **Precondition filtering**: Only generates inputs that satisfy ISL preconditions
- **Postcondition verification**: Checks all postconditions after execution
- **Invariant checking**: Verifies invariants like `password never_logged`
- **Smart shrinking**: Finds minimal failing inputs using delta debugging
- **Reproducible**: Seeded PRNG for reproducible test failures
- **Vitest integration**: Easy integration with existing test suites

## Installation

```bash
pnpm add @isl-lang/pbt
```

## Quick Start

```typescript
import { runPBT, formatReport } from '@isl-lang/pbt';
import { parse } from '@isl-lang/parser';

// Parse your ISL spec
const domain = parse(`
  domain Auth {
    behavior Login {
      input {
        email: Email
        password: Password [sensitive]
      }
      
      pre {
        email.is_valid_format
        password.length >= 8
      }
      
      post success {
        Session.exists(result.id)
      }
      
      invariants {
        password never_logged
      }
    }
  }
`);

// Your implementation
const implementation = {
  async execute(input) {
    // Your login logic here
    return { success: true, result: { id: 'session-123' } };
  }
};

// Run property-based tests
const report = await runPBT(domain, 'Login', implementation, {
  numTests: 100,
  seed: 12345,
});

console.log(formatReport(report));
```

## Generators

### Built-in Generators

```typescript
import {
  email,
  password,
  uuid,
  timestamp,
  ipAddress,
  string,
  integer,
  float,
  boolean,
  array,
  oneOf,
  optional,
  record,
} from '@isl-lang/pbt';

// Generate random emails
const emailGen = email();
const randomEmail = emailGen.generate(prng, 50); // "abc123@example.com"

// Generate passwords with min length
const passGen = password(8, 128);
const randomPass = passGen.generate(prng, 50); // "aB3!xyzQ"

// Composite generators
const userGen = record({
  email: email(),
  name: string({ minLength: 1, maxLength: 50 }),
  age: optional(integer(0, 120)),
});
```

### Custom Generators

```typescript
import { BaseGenerator, createPRNG } from '@isl-lang/pbt';

// Create a custom generator
const colorGen = new BaseGenerator(
  (prng, size) => prng.pick(['red', 'green', 'blue']),
  function* (value) {
    // Shrink to first value
    if (value !== 'red') yield 'red';
  }
);

// Use with transformation
const hexColorGen = colorGen.map(color => ({
  red: '#ff0000',
  green: '#00ff00',
  blue: '#0000ff',
}[color]));
```

### Input Generation from ISL

```typescript
import { extractProperties, createInputGenerator } from '@isl-lang/pbt';

// Extract properties from behavior
const properties = extractProperties(behavior, domain);

// Create generator that satisfies preconditions
const generator = createInputGenerator(properties, {
  filterPreconditions: true,
  maxFilterAttempts: 1000,
});

// Generate valid inputs
const prng = createPRNG(12345);
const input = generator.generate(prng, 50);
// { email: "test@example.com", password: "aB3!xyzQ", ... }
```

## Shrinking

When a test fails, the shrinker finds the minimal failing input:

```typescript
import { shrinkInput, deltaDebug } from '@isl-lang/pbt';

// Simple shrinking
const result = await shrinkInput(
  failingInput,
  async (input) => await testPasses(input),
  { maxShrinks: 100 }
);

console.log('Original:', result.original);
console.log('Minimal:', result.minimal);
console.log('Shrink attempts:', result.shrinkAttempts);

// Delta debugging (more thorough)
const deltaResult = await deltaDebug(
  failingInput,
  async (input) => await testPasses(input),
  { maxShrinks: 500 }
);
```

## PII Detection

The `never_logged` invariant detects sensitive data in logs:

```typescript
// In your ISL spec
invariants {
  password never_logged
  ssn never_logged
}

// The PBT runner captures all console output and checks
// that sensitive field values don't appear in any log
const report = await runPBT(domain, 'Login', impl);

if (!report.success) {
  for (const violation of report.violations) {
    if (violation.property.name.includes('never_logged')) {
      console.error('PII leak detected!', violation);
    }
  }
}
```

## Test Suite API

```typescript
import { createPBTSuite } from '@isl-lang/pbt';

const suite = createPBTSuite(domain, 'Login', implementation, {
  numTests: 100,
  seed: 12345,
});

// Generate single input for inspection
const input = suite.generateInput();
console.log('Sample input:', input);

// Quick check with fewer iterations
const quickReport = await suite.quickCheck(10);

// Full run
const fullReport = await suite.run();
```

## Configuration

```typescript
interface PBTConfig {
  // Number of test iterations (default: 100)
  numTests: number;
  
  // Random seed for reproducibility
  seed?: number;
  
  // Maximum shrinking iterations (default: 100)
  maxShrinks: number;
  
  // Size growth: 'linear' or 'logarithmic' (default: 'linear')
  sizeGrowth: 'linear' | 'logarithmic';
  
  // Maximum size parameter (default: 100)
  maxSize: number;
  
  // Timeout per test in ms (default: 5000)
  timeout: number;
  
  // Filter inputs by preconditions (default: true)
  filterPreconditions: boolean;
  
  // Max attempts to find valid input (default: 1000)
  maxFilterAttempts: number;
  
  // Enable verbose output (default: false)
  verbose: boolean;
}
```

## Vitest Integration

```typescript
import { describe, it, expect } from 'vitest';
import { runPBT } from '@isl-lang/pbt';

describe('Login PBT', () => {
  it('should never log passwords', async () => {
    const report = await runPBT(domain, 'Login', implementation, {
      numTests: 100,
      seed: 12345,
    });
    
    expect(report.success).toBe(true);
    expect(report.violations).toHaveLength(0);
  });
  
  it('should reproduce failure with seed', async () => {
    // If a test fails, use the reported seed to reproduce
    const report = await runPBT(domain, 'Login', implementation, {
      numTests: 100,
      seed: 54321, // Seed from failed test
    });
    
    if (!report.success && report.shrinkResult) {
      console.log('Minimal failing input:', report.shrinkResult.minimal);
    }
  });
});
```

## Example: Login Behavior

```typescript
import { runPBT, formatReport } from '@isl-lang/pbt';

// Implementation that accidentally logs passwords
const unsafeImpl = {
  async execute(input) {
    console.log(`Login: ${input.email}, password: ${input.password}`); // BAD!
    return { success: true, result: { id: 'session-123' } };
  }
};

const report = await runPBT(domain, 'Login', unsafeImpl, {
  numTests: 10,
});

console.log(formatReport(report));
// Output:
// PBT Report: Login
// ==================================================
// ✗ FAILED after 0/10 tests
// 
// First Failure:
//   Iteration: 0
//   Size:      0
//   Error:     Invariant violated: password never_logged
// 
// Minimal Failing Input:
//   email: "a@b.co"
//   password: "aA1!aaaa"
//   (shrunk in 15 attempts)
```

## License

MIT
