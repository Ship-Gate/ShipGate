# ISL Standard Library Integration Example

This example demonstrates how ISL standard library imports resolve and how implementations are verified against contracts.

## Overview

This example shows a complete integration of four stdlib modules:

- **stdlib-auth**: User authentication and session management
- **stdlib-rate-limit**: Request rate limiting and throttling
- **stdlib-payments**: Payment processing and subscriptions
- **stdlib-audit**: Audit logging and compliance

## Import Resolution

When you write ISL imports, they resolve as follows:

```isl
import { CreateSession } from "@isl/stdlib-auth/session"
```

### Resolution Steps

1. **Parse import path**: `@isl/stdlib-auth/session`
2. **Module prefix**: `@isl/stdlib-` indicates standard library
3. **Package name**: `auth` → `@isl-lang/stdlib-auth`
4. **Submodule**: `session` → `intents/behaviors/session.isl`
5. **Export resolution**: Find `CreateSession` behavior definition

### Path Mapping

| ISL Import | NPM Package | ISL File |
|------------|-------------|----------|
| `@isl/stdlib-auth/session` | `@isl-lang/stdlib-auth` | `intents/behaviors/session.isl` |
| `@isl/stdlib-rate-limit/check` | `@isl-lang/stdlib-rate-limit` | `intents/behaviors/check.isl` |
| `@isl/stdlib-payments/payments` | `@isl-lang/stdlib-payments` | `intents/behaviors/payments.isl` |
| `@isl/stdlib-audit/record` | `@isl-lang/stdlib-audit` | `intents/behaviors/record.isl` |

## Verification

### Running Verification

```bash
# Verify ISL specifications
isl check main.isl

# Verify TypeScript implementation against contracts
isl verify implementation.ts --contracts main.isl

# Generate verification report
isl verify implementation.ts --contracts main.isl --report report.html
```

### Verification Output

```
Verifying: SecureLogin
══════════════════════════════════════════════════════════════════

Contract: @isl/stdlib-auth/session::CreateSession
├─ Preconditions: ✓ 4/4 verified
│  ├─ user_id is valid UUID
│  ├─ ip_address is non-empty
│  ├─ duration >= 1 minute
│  └─ duration <= 30 days
├─ Postconditions: ✓ 6/6 verified
│  ├─ session.id is unique UUID
│  ├─ session.user_id == input.user_id
│  ├─ session.expires_at == now() + duration
│  ├─ token.length >= 64
│  ├─ token_hash uses secure algorithm
│  └─ session.revoked == false
├─ Invariants: ✓ 3/3 maintained
│  ├─ token cryptographically random
│  ├─ token_hash uses bcrypt or argon2
│  └─ token never stored in plaintext
└─ Temporal: ✓ 2/2 satisfied
   ├─ response within 200ms (p99)
   └─ session_created event within 5s

Contract: @isl/stdlib-rate-limit/check::CheckRateLimit
├─ Preconditions: ✓ 3/3 verified
├─ Postconditions: ✓ 5/5 verified
└─ Temporal: ✓ 2/2 satisfied

Contract: @isl/stdlib-audit/record::Record
├─ Preconditions: ✓ 2/2 verified
├─ Postconditions: ✓ 4/4 verified
└─ Invariants: ✓ 2/2 maintained

══════════════════════════════════════════════════════════════════
Trust Score: 96/100 ✓ VERIFIED
══════════════════════════════════════════════════════════════════
```

## File Structure

```
stdlib-integration/
├── main.isl              # ISL specification with stdlib imports
├── implementation.ts     # TypeScript implementation
├── README.md            # This file
└── package.json         # Dependencies
```

## Key Behaviors

### SecureLogin

Demonstrates integration of:
- Rate limiting (prevent brute-force)
- Authentication (validate credentials)
- Session management (create secure token)
- Audit logging (track security events)

```isl
behavior SecureLogin {
  flow {
    step rate_check: CheckLoginRateLimit(...)   # stdlib-rate-limit
    step auth: authenticate(...)                 # stdlib-auth
    step session: CreateSession(...)             # stdlib-auth
    AuditRecord(...)                            # stdlib-audit
  }
}
```

### ProcessSubscriptionPayment

Demonstrates integration of:
- Payment creation and processing
- Subscription management
- Audit trail for financial transactions

```isl
behavior ProcessSubscriptionPayment {
  flow {
    step payment: CreatePayment(...)            # stdlib-payments
    step processed: ProcessPaymentIntent(...)   # stdlib-payments
    step subscription: CreateSubscription(...)  # stdlib-payments
    AuditRecord(...)                           # stdlib-audit
  }
}
```

### RateLimitedAPICall

Demonstrates integration of:
- Tiered rate limiting (free/pro/enterprise)
- API usage tracking
- Access logging

```isl
behavior RateLimitedAPICall {
  flow {
    step rate_check: CheckAndIncrement(...)    # stdlib-rate-limit
    step response: process_api_call(...)
    AuditRecord(...)                          # stdlib-audit
  }
}
```

## Running the Example

```bash
# Install dependencies
pnpm install

# Check ISL specifications
isl check main.isl

# Generate TypeScript types
isl generate --target typescript --output ./generated

# Run verification
isl verify implementation.ts --contracts main.isl

# Run tests
pnpm test
```

## Contract Compliance

The implementation must satisfy all contracts from the imported stdlib modules:

| Module | Contract | Status |
|--------|----------|--------|
| stdlib-auth | CreateSession | ✓ Verified |
| stdlib-auth | ValidateSession | ✓ Verified |
| stdlib-auth | CheckLoginRateLimit | ✓ Verified |
| stdlib-rate-limit | CheckRateLimit | ✓ Verified |
| stdlib-rate-limit | CheckAndIncrement | ✓ Verified |
| stdlib-payments | CreatePayment | ✓ Verified |
| stdlib-payments | ProcessPaymentIntent | ✓ Verified |
| stdlib-payments | CreateSubscription | ✓ Verified |
| stdlib-audit | Record | ✓ Verified |

## TypeScript Types

The ISL compiler generates TypeScript types that match the contracts:

```typescript
// Generated from @isl/stdlib-auth/session.isl
interface CreateSessionInput {
  user_id: string;
  ip_address: string;
  user_agent?: string;
  duration?: number;
}

interface CreateSessionOutput {
  session: Session;
  token: string;
}

type CreateSessionError =
  | { code: 'USER_NOT_FOUND' }
  | { code: 'USER_SUSPENDED' }
  | { code: 'TOO_MANY_SESSIONS' };
```

## Next Steps

1. Explore individual module documentation in `packages/stdlib-*`
2. Run `isl verify` on your own implementations
3. Use the generated types for type-safe development
4. Add more behaviors that compose stdlib modules
