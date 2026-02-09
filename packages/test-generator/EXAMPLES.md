# Test Generator Examples

This document provides three comprehensive examples demonstrating how `@isl-lang/test-generator` generates runnable test suites from ISL specifications.

## Example 1: Pure Function Behavior (Unit Tests)

This example shows how the generator creates unit tests for pure behaviors without side effects.

### ISL Specification

```isl
domain Math {
  version: "1.0.0"
  
  behavior CalculateTotal {
    description: "Calculate total price with tax"
    
    input {
      subtotal: Decimal
      tax_rate: Decimal
    }
    
    output {
      success: {
        total: Decimal
        tax_amount: Decimal
      }
    }
    
    preconditions {
      subtotal >= 0
      tax_rate >= 0
      tax_rate <= 1
    }
    
    postconditions {
      success implies {
        result.total == subtotal + result.tax_amount
        result.tax_amount == subtotal * tax_rate
        result.total >= subtotal
      }
    }
  }
}
```

### Generated Test (Vitest)

```typescript
// ============================================================================
// Generated Tests for CalculateTotal
// Domain: Math
// Seed: 12345
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Behavior implementation
import { calculateTotal } from '../src/CalculateTotal';
import type { CalculateTotalInput, CalculateTotalResult } from '../src/types';

describe('CalculateTotal', () => {

  describe('Valid Inputs', () => {

    it('valid subtotal and tax rate', async () => {
      // Arrange
      const input: CalculateTotalInput = {
        subtotal: 100.00,
        tax_rate: 0.10,
      };

      // Act
      const result = await calculateTotal(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.total).toBe(110.00);
      expect(result.data.tax_amount).toBe(10.00);
      expect(result.data.total).toBeGreaterThanOrEqual(input.subtotal);
    });
  });

  describe('Boundary Cases', () => {

    it('zero subtotal', async () => {
      const input: CalculateTotalInput = {
        subtotal: 0,
        tax_rate: 0.10,
      };

      const result = await calculateTotal(input);

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(0);
      expect(result.data.tax_amount).toBe(0);
    });

    it('maximum tax rate', async () => {
      const input: CalculateTotalInput = {
        subtotal: 100.00,
        tax_rate: 1.0,
      };

      const result = await calculateTotal(input);

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(200.00);
    });
  });

  describe('Invalid Inputs (Negative Tests)', () => {

    it('rejects negative subtotal', async () => {
      const input: CalculateTotalInput = {
        subtotal: -10.00,
        tax_rate: 0.10,
      };

      const result = await calculateTotal(input);

      expect(result.success).toBe(false);
    });

    it('rejects tax rate greater than 1', async () => {
      const input: CalculateTotalInput = {
        subtotal: 100.00,
        tax_rate: 1.5,
      };

      const result = await calculateTotal(input);

      expect(result.success).toBe(false);
    });
  });
});
```

**Key Features:**
- ✅ Pure function tests with no side effects
- ✅ Boundary value testing (zero, maximum)
- ✅ Negative test cases for precondition violations
- ✅ Deterministic assertions from postconditions

---

## Example 2: API Behavior (Integration Scaffolds)

This example demonstrates integration test scaffolds for API endpoints.

### ISL Specification

```isl
domain Payments {
  version: "1.0.0"
  
  entity Payment {
    id: UUID [immutable]
    amount: Decimal
    currency: String
    status: String
    created_at: Timestamp
  }
  
  behavior CreatePayment {
    description: "Create a new payment"
    
    input {
      amount: Decimal
      currency: String
      idempotency_key: String?
    }
    
    output {
      success: {
        payment: Payment
        charge_id: String
      }
      
      errors {
        INVALID_AMOUNT {
          when: "Amount must be positive"
          retriable: false
        }
        DUPLICATE_IDEMPOTENCY_KEY {
          when: "Idempotency key already used"
          retriable: false
        }
      }
    }
    
    preconditions {
      amount > 0
      currency.length == 3
    }
    
    postconditions {
      success implies {
        Payment.exists(result.payment.id)
        result.payment.amount == amount
        result.payment.status == "pending"
        result.charge_id != null
      }
    }
  }
}
```

### Generated Test (Vitest)

```typescript
// ============================================================================
// Generated Tests for CreatePayment
// Domain: Payments
// Seed: 67890
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Behavior implementation
import { createPayment } from '../src/CreatePayment';
import type { CreatePaymentInput, CreatePaymentResult } from '../src/types';

// Entity mocks
import { Payment } from './fixtures';

// Test context
let testContext: {
  reset: () => void;
  captureState: () => Record<string, unknown>;
};

beforeEach(() => {
  testContext = {
    reset: () => {
      Payment.reset?.();
    },
    captureState: () => ({
      timestamp: Date.now(),
    }),
  };
  testContext.reset();
});

afterEach(() => {
  // Cleanup
});

describe('CreatePayment', () => {

  describe('Valid Inputs', () => {

    it('creates payment with valid amount and currency', async () => {
      // Arrange
      const input: CreatePaymentInput = {
        amount: 50.00,
        currency: "USD",
      };

      // Act
      const result = await createPayment(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(await Payment.exists({ id: result.data.payment.id })).toBe(true);
      expect(result.data.payment.amount).toBe(50.00);
      expect(result.data.payment.status).toBe("pending");
      expect(result.data.charge_id).not.toBeNull();
    });

    it('creates payment with idempotency key', async () => {
      const input: CreatePaymentInput = {
        amount: 100.00,
        currency: "EUR",
        idempotency_key: "key-12345",
      };

      const result = await createPayment(input);

      expect(result.success).toBe(true);
      expect(result.data.payment.id).toBeDefined();
    });
  });

  describe('Error Cases', () => {

    it('returns INVALID_AMOUNT for zero amount', async () => {
      const input: CreatePaymentInput = {
        amount: 0,
        currency: "USD",
      };

      const result = await createPayment(input);

      expect(result.success).toBe(false);
      expect(result.error?.code ?? result.error).toBe('INVALID_AMOUNT');
    });

    it.skip('NEEDS_IMPL: handles duplicate idempotency key', async () => {
      // Implementation hint: Implement Payment.findByIdempotencyKey in your test runtime
      const firstInput: CreatePaymentInput = {
        amount: 50.00,
        currency: "USD",
        idempotency_key: "duplicate-key",
      };
      
      const firstResult = await createPayment(firstInput);
      expect(firstResult.success).toBe(true);

      const secondResult = await createPayment(firstInput);
      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.code ?? secondResult.error).toBe('DUPLICATE_IDEMPOTENCY_KEY');
    });
  });
});
```

**Key Features:**
- ✅ Integration test scaffolds with entity mocks
- ✅ Test context setup/teardown
- ✅ Error case testing
- ✅ Scaffolds for complex patterns (idempotency) marked with `it.skip`

---

## Example 3: Authentication Behavior (Domain-Specific)

This example shows domain-specific test generation for authentication.

### ISL Specification

```isl
domain Auth {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable]
    email: String [unique]
    password_hash: String [secret]
    failed_login_attempts: Int
  }
  
  behavior Login {
    description: "Authenticate user"
    
    input {
      email: String
      password: String [sensitive]
    }
    
    output {
      success: {
        access_token: String
        user_id: UUID
      }
      
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password incorrect"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Too many failed attempts"
          retriable: true
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length >= 8
    }
    
    postconditions {
      success implies {
        result.access_token != null
        result.access_token.length > 0
        User.lookup(input.email).failed_login_attempts == 0
      }
      
      INVALID_CREDENTIALS implies {
        User.exists(email: input.email) implies {
          User.lookup(input.email).failed_login_attempts == old(User.lookup(input.email).failed_login_attempts) + 1
        }
      }
    }
    
    invariants {
      input.password never_appears_in logs
    }
  }
}
```

### Generated Test (Vitest)

```typescript
// ============================================================================
// Generated Tests for Login
// Domain: Auth
// Seed: 11111
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { login } from '../src/Login';
import type { LoginInput, LoginResult } from '../src/types';

import { User } from './fixtures';

let testContext: {
  reset: () => void;
  captureState: () => Record<string, unknown>;
};

beforeEach(() => {
  testContext = {
    reset: () => {
      User.reset?.();
    },
    captureState: () => ({
      timestamp: Date.now(),
    }),
  };
  testContext.reset();
});

describe('Login', () => {

  describe('Valid Inputs', () => {

    it('successful login with valid credentials', async () => {
      // Arrange
      const input: LoginInput = {
        email: "user@example.com",
        password: "SecureP@ss1",
      };

      // Act
      const result = await login(input);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.access_token).not.toBeNull();
      expect(result.data.access_token.length).toBeGreaterThan(0);
      expect((await User.lookup({ email: input.email })).failed_login_attempts).toBe(0);
    });
  });

  describe('Invalid Inputs (Negative Tests)', () => {

    it('rejects empty email', async () => {
      const input: LoginInput = {
        email: "",
        password: "SecureP@ss1",
      };

      const result = await login(input);

      expect(result.success).toBe(false);
    });

    it('rejects short password', async () => {
      const input: LoginInput = {
        email: "user@example.com",
        password: "short",
      };

      const result = await login(input);

      expect(result.success).toBe(false);
    });

    it('returns INVALID_CREDENTIALS for wrong password', async () => {
      // Capture state before execution
      const __old__: Record<string, unknown> = {};
      __old__['User_lookup'] = await captureState('User.lookup');

      const input: LoginInput = {
        email: "user@example.com",
        password: "wrong-password",
      };

      const result = await login(input);

      expect(result.success).toBe(false);
      expect(result.error?.code ?? result.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns ACCOUNT_LOCKED after too many failures', async () => {
      const input: LoginInput = {
        email: "locked@example.com",
        password: "anypassword",
      };

      const result = await login(input);

      expect(result.success).toBe(false);
      expect(result.error?.code ?? result.error).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('Security Constraints', () => {

    it('password never appears in logs', async () => {
      // This is typically verified through code review or security testing
      const input: LoginInput = {
        email: "user@example.com",
        password: "SecureP@ss1",
      };

      const result = await login(input);
      expect(result).toBeDefined();
      // In a real test, you would verify logs don't contain the password
    });
  });
});

async function captureState(path: string): Promise<unknown> {
  // Implement state capture for old() expressions
  return undefined;
}
```

**Key Features:**
- ✅ Domain-specific assertions (token presence, failed attempts)
- ✅ Security constraint tests
- ✅ State capture for `old()` expressions
- ✅ Comprehensive error case coverage

---

## Running the Generated Tests

### With Vitest

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

### With Jest

```typescript
// Generate with Jest framework
const result = generate(domain, {
  framework: 'jest',
  outputDir: './tests',
});

// Run tests
npm test
```

## Deterministic Output

All generated tests use seeded random number generation for deterministic output. The same ISL specification will always produce the same test code, making it suitable for:

- ✅ Golden file testing
- ✅ Version control
- ✅ CI/CD pipelines
- ✅ Regression testing

## Next Steps

1. **Implement Scaffolds**: Complete `it.skip` tests marked with `NEEDS_IMPL`
2. **Add Custom Assertions**: Extend domain strategies for your specific patterns
3. **Integrate with CI**: Add generated tests to your test suite
4. **Golden Testing**: Use `@isl-lang/codegen-harness` to ensure test output stability
