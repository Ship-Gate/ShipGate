# Test Generation

The ISL test generator creates runnable, meaningful tests from ISL specifications with constraint-driven data synthesis and expected outcome computation.

## Overview

The test generator produces:

1. **Valid Input Tests** - Inputs satisfying all constraints
2. **Boundary Value Tests** - Inputs at constraint edges (min, max, min+1, max-1)
3. **Invalid Input Tests** - Negative tests violating constraints
4. **Precondition Violation Tests** - Tests for each precondition

## Deterministic Generation with Seeds

All generated tests are **deterministic by default**. Each test includes a recorded seed that enables exact reproduction.

### Seed Recording

Every generated test includes a `@dataTrace` comment with:

```typescript
/**
 * @dataTrace
 * Seed: 12345
 * Strategy: typical_midpoint
 * Generated: 2025-02-03T10:00:00.000Z
 * Constraints:
 *   - amount (Decimal): min: 0.01, max: 10000.00
 *   - quantity (Int): min: 1, max: 100
 */
```

### Reproducing Tests

To reproduce the exact same test data:

```typescript
import { synthesizeInputs } from '@isl-lang/test-generator';

// Use the same seed from the @dataTrace comment
const inputs = synthesizeInputs(behavior, domain, {
  seed: 12345, // From @dataTrace
});
```

### Seed Derivation

If no seed is provided, one is derived deterministically from the behavior name:

```typescript
// Seed is automatically derived from behavior name
const seed = generateSeed('CreateOrder'); // Always produces same value
```

## Constraint-Driven Data Synthesis

### Numeric Constraints

For types with `min`/`max` constraints:

```isl
type Amount = Decimal {
  min: 0.01
  max: 10000.00
  precision: 2
}
```

Generated boundary values:
- `at_min`: 0.01
- `min_plus_one`: 0.02
- `at_max`: 10000.00
- `max_minus_one`: 9999.99
- `zero`: 0 (if in range)

### String Constraints

For types with length and format constraints:

```isl
type Email = String {
  format: email
  max_length: 254
}

type Username = String {
  min_length: 3
  max_length: 30
  pattern: "^[a-zA-Z0-9_]+$"
}
```

Generated values:
- **Format-aware**: Emails generated as `user@example.com`
- **Length boundaries**: At min_length, at max_length
- **Pattern-matching**: Values satisfying regex patterns

Supported formats:
- `email` - Valid email addresses
- `uuid` - UUID v4 format
- `url` - Valid URLs
- `phone` - Phone numbers
- `date` - ISO date
- `date-time` - ISO datetime
- `ipv4`/`ipv6` - IP addresses
- `slug` - URL-safe slugs
- `credit_card` - Luhn-valid test card numbers

### Collection Constraints

For array/list types:

```isl
input {
  tags: List<String>      // Generates arrays of varying sizes
  items: List<CartItem>   // Generates with min/max items
}
```

Generated test cases:
- Empty array (if allowed)
- Single item
- At minimum items
- At maximum items

### Cross-Field Constraints

For preconditions relating multiple fields:

```isl
preconditions {
  input.max_price >= input.min_price
  input.check_out > input.check_in
}
```

The generator:
1. **Extracts** cross-field relationships
2. **Generates valid values** respecting relationships
3. **Generates violations** for negative testing

Example violation test:
```typescript
// Cross-field violation: max_price < min_price
const input = {
  min_price: 100,
  max_price: 50, // Violates max_price >= min_price
};
```

## Expected Outcome Computation

### From Postconditions

Postconditions are compiled to assertions:

```isl
postconditions {
  success implies {
    Order.exists(result.id)
    Order.lookup(result.id).amount == input.amount
    Order.lookup(result.id).quantity == input.quantity
  }
}
```

Generates:

```typescript
// Primary assertions
expect(result.success).toBe(true);
expect(result.data).toBeDefined();

// Computed expectations from postconditions
expect(result.data.amount).toEqual(input.amount);
expect(result.data.quantity).toEqual(input.quantity);

// Entity verification
expect(await Order.exists({ id: result.data.id })).toBe(true);
```

### Computed Values

When postconditions define result properties in terms of inputs, the generator computes expected values:

```isl
postconditions {
  success implies {
    result.subtotal == input.subtotal
    result.tax_rate == input.tax_rate
  }
}
```

The generator traces these and produces:

```typescript
// Computed expectation: result.subtotal should equal input value
expect(result.data.subtotal).toEqual(99.99); // Actual input value
```

### Error Case Assertions

For negative tests, assertions verify rejection:

```typescript
// Assert - error case
expect(result.success).toBe(false);
expect(result.error?.code ?? result.error).toBe('INVALID_AMOUNT');
```

## Configuration

### Generation Options

```typescript
import { generateWithSynthesis } from '@isl-lang/test-generator';

const result = generateWithSynthesis(domain, {
  // Test framework
  framework: 'vitest', // or 'jest'
  
  // Deterministic seed
  baseSeed: 12345,
  
  // Test categories
  includeBoundary: true,
  includeNegativeTests: true,
  includePreconditionViolations: true,
  
  // Limits
  maxInputsPerCategory: 5,
  
  // Output
  includeHelpers: true,
  emitMetadata: true,
});
```

### Synthesis Options

```typescript
import { synthesizeInputs } from '@isl-lang/test-generator';

const inputs = synthesizeInputs(behavior, domain, {
  seed: 12345,                    // Deterministic seed
  includeBoundary: true,          // Boundary value tests
  includeInvalid: true,           // Invalid input tests
  includePreconditionViolations: true, // Precondition violations
  maxInputsPerCategory: 5,        // Max tests per category
});
```

## Test Completeness Metrics

The generator tracks completeness:

```json
{
  "stats": {
    "totalBehaviors": 3,
    "totalAssertions": 45,
    "supportedAssertions": 40,
    "needsImplAssertions": 5,
    "unsupportedAssertions": 0
  }
}
```

Target: **80%+ completeness** - most generated tests include:
- Real input vectors (not placeholders)
- Real assertions (tied to spec semantics)

## CI Integration

### Running Generated Tests

```bash
# Generate tests
pnpm isl generate-tests specs/auth.isl --output tests/

# Run generated tests
pnpm vitest tests/
```

### Fixture Suite

The generator includes 5 E2E fixture specs for validation:

1. `e2e-numeric.isl` - Numeric constraint testing
2. `e2e-string.isl` - String pattern/format testing
3. `e2e-collection.isl` - Array/list testing
4. `e2e-cross-field.isl` - Cross-field constraint testing
5. `e2e-expected-outcomes.isl` - Postcondition computation

### Snapshot Testing

Generated output is snapshot tested for stability:

```typescript
// Normalized to remove timestamps
expect(normalizedContent).toMatchSnapshot();
```

## Example Generated Test

```typescript
// ============================================================================
// Generated Tests for CreateOrder
// Domain: NumericFixture
// Generated: 2025-02-03T10:00:00.000Z
// Seed: 12345
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createOrder } from '../src/CreateOrder';
import type { CreateOrderInput, CreateOrderResult } from '../src/types';
import { Order } from './fixtures';

describe('CreateOrder', () => {
  beforeEach(() => {
    Order.reset?.();
  });

  describe('Valid Inputs', () => {
    /**
     * @dataTrace
     * Seed: 12345
     * Strategy: typical_midpoint
     * Constraints:
     *   - amount (Decimal): min: 0.01, max: 10000.00
     *   - quantity (Int): min: 1, max: 100
     */
    it('Valid input with typical values within constraints', async () => {
      // Arrange
      const input: CreateOrderInput = {
        amount: 5000.01,
        quantity: 50,
        discount_percentage: 0,
      };

      // Act
      const result = await createOrder(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.amount).toEqual(5000.01);
      expect(result.data.quantity).toEqual(50);
    });
  });

  describe('Boundary Cases', () => {
    /**
     * @dataTrace
     * Seed: 12345
     * Strategy: boundary_at_min
     */
    it('Boundary: amount at minimum value (0.01)', async () => {
      // Arrange
      const input: CreateOrderInput = {
        amount: 0.01,
        quantity: 50,
      };

      // Act
      const result = await createOrder(input);

      // Assert
      expect(result.success).toBe(true);
      // Boundary: minimum value (0.01)
    });

    /**
     * @dataTrace
     * Seed: 12345
     * Strategy: boundary_at_max
     */
    it('Boundary: amount at maximum value (10000.00)', async () => {
      // Arrange
      const input: CreateOrderInput = {
        amount: 10000.00,
        quantity: 50,
      };

      // Act
      const result = await createOrder(input);

      // Assert
      expect(result.success).toBe(true);
      // Boundary: maximum value (10000.00)
    });
  });

  describe('Invalid Inputs (Negative Tests)', () => {
    /**
     * @dataTrace
     * Seed: 12345
     * Strategy: constraint_violation_below_min
     */
    it('Invalid: amount - below minimum (0)', async () => {
      // Arrange
      const input: CreateOrderInput = {
        amount: 0,
        quantity: 50,
      };

      // Act
      const result = await createOrder(input);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.code ?? result.error).toBe('INVALID_AMOUNT');
    });
  });

  describe('Precondition Violations', () => {
    /**
     * @dataTrace
     * Seed: 12345
     * Strategy: precondition_violation_>=_violation
     */
    it('Violates precondition: input.amount >= 0.01', async () => {
      // Arrange
      const input: CreateOrderInput = {
        amount: 0,
        quantity: 50,
      };

      // Act
      const result = await createOrder(input);

      // Assert
      expect(result.success).toBe(false);
      // Precondition violated: input.amount >= 0.01
    });
  });
});
```

## Troubleshooting

### Non-Deterministic Tests

If tests produce different values:

1. Check that the same seed is used
2. Ensure no external randomness (use seeded RNG)
3. Verify timestamps are normalized in comparisons

### Missing Boundary Values

If boundary tests aren't generated:

1. Verify constraints are defined in ISL types
2. Check `includeBoundary: true` option
3. Ensure type constraints are extractable

### Assertion Failures

If computed expectations fail:

1. Check postcondition syntax in ISL
2. Verify input-to-result mappings
3. Ensure entity mocks return expected data
