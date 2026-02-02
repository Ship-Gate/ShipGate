# @isl-lang/test-generator

Generate executable tests with domain-specific assertions from ISL specifications.

## Overview

The test generator analyzes ISL behavior specifications and produces comprehensive test suites with real, meaningful assertions. It uses domain-specific strategies to generate tests that go beyond basic boilerplate.

## Installation

```bash
pnpm add @isl-lang/test-generator
```

## Quick Start

```typescript
import { generate } from '@isl-lang/test-generator';
import { parse } from '@isl-lang/parser';

// Parse your ISL spec
const domain = parse(`
  domain Auth {
    version: "1.0.0"
    
    behavior Login {
      input {
        email: String
        password: String [sensitive]
      }
      
      preconditions {
        input.email.length > 0
        input.password.length >= 8
      }
      
      output {
        success: { access_token: String }
        errors {
          INVALID_CREDENTIALS { retriable: true }
        }
      }
    }
  }
`);

// Generate tests
const result = generate(domain, {
  framework: 'vitest',
  outputDir: './tests',
  emitMetadata: true,
});

// Write generated files
for (const file of result.files) {
  await writeFile(file.path, file.content);
}
```

## Supported Patterns

### Auth Domain

| Pattern | Description | Status |
|---------|-------------|--------|
| `auth.invalid_provider` | Invalid OAuth provider validation | ✅ Supported |
| `auth.invalid_email` | Email format/existence validation | ✅ Supported |
| `auth.invalid_password` | Password strength validation | ✅ Supported |
| `auth.token_present` | Access/refresh token in result | ✅ Supported |
| `auth.session_expiry` | Session creation and expiry | ✅ Supported |
| `auth.mfa_required` | MFA requirement detection | ✅ Supported |
| `auth.account_locked` | Lockout after failed attempts | ✅ Supported |

### Payments Domain

| Pattern | Description | Status |
|---------|-------------|--------|
| `payment.amount_positive` | Amount > 0 validation | ✅ Supported |
| `payment.status_succeeded` | Payment completion check | ✅ Supported |
| `payment.idempotency_key` | Idempotency behavior | 🔧 Scaffold |
| `payment.currency_valid` | Currency code validation | ✅ Supported |
| `payment.refund_valid` | Refund amount constraints | ✅ Supported |

### Uploads Domain

| Pattern | Description | Status |
|---------|-------------|--------|
| `upload.file_type` | MIME type validation | ✅ Supported |
| `upload.file_size` | Size limit validation | ✅ Supported |
| `upload.result_url` | URL present in result | ✅ Supported |
| `upload.content_type` | Content type preservation | ✅ Supported |

### Webhooks Domain

| Pattern | Description | Status |
|---------|-------------|--------|
| `webhook.signature_valid` | HMAC signature validation | ✅ Supported |
| `webhook.replay_protection` | Duplicate webhook detection | 🔧 Scaffold |
| `webhook.event_type` | Event type validation | ✅ Supported |
| `webhook.delivery_attempt` | Delivery tracking | 🔧 Scaffold |

**Legend:**
- ✅ Supported: Generates complete, runnable assertions
- 🔧 Scaffold: Generates `it.skip('NEEDS_IMPL: ...')` with implementation hints

## Configuration

```typescript
interface GenerateOptions {
  // Test framework: 'jest' | 'vitest'
  framework: TestFramework;
  
  // Output directory (default: '.')
  outputDir?: string;
  
  // Generate helper utilities (default: true)
  includeHelpers?: boolean;
  
  // Generate test-metadata.json (default: true)
  emitMetadata?: boolean;
  
  // Force a specific domain strategy
  forceDomain?: 'auth' | 'payments' | 'uploads' | 'webhooks' | 'generic';
}
```

## Output Structure

```
./tests/
├── Login.test.ts          # Generated behavior tests
├── Register.test.ts
├── helpers/
│   ├── test-utils.ts      # Input factories
│   └── fixtures.ts        # Entity fixtures
├── vitest.config.ts       # Framework config
└── test-metadata.json     # Verifier metadata
```

## Test Metadata

The generator produces metadata that can be consumed by the ISL verifier:

```json
{
  "domain": "auth",
  "behaviors": [
    {
      "name": "Login",
      "domain": "auth",
      "assertions": [
        {
          "description": "Email must be provided",
          "pattern": "auth.invalid_email",
          "status": "supported"
        },
        {
          "description": "Idempotency key handling",
          "pattern": "payment.idempotency_key",
          "status": "needs_impl",
          "implementationHint": "Implement Payment.findByIdempotencyKey"
        }
      ],
      "coverage": {
        "totalPreconditions": 2,
        "coveredPreconditions": 2,
        "totalPostconditions": 3,
        "coveredPostconditions": 3
      }
    }
  ],
  "openQuestions": [],
  "stats": {
    "totalBehaviors": 1,
    "totalAssertions": 10,
    "supportedAssertions": 8,
    "needsImplAssertions": 2,
    "unsupportedAssertions": 0
  }
}
```

## Extending with Custom Strategies

```typescript
import { registerStrategy, BaseDomainStrategy } from '@isl-lang/test-generator';

class MyCustomStrategy extends BaseDomainStrategy {
  domain = 'custom' as const;
  
  matches(behavior, domain) {
    return domain.name.name === 'MyCustomDomain';
  }
  
  generatePreconditionAssertions(precondition, behavior, context) {
    // Return GeneratedAssertion[]
    return [
      this.supported(
        'expect(input.customField).toBeDefined();',
        'Custom field must be present',
        'generic.precondition'
      )
    ];
  }
  
  // ... implement other methods
}

registerStrategy(new MyCustomStrategy());
```

## Verifier Integration

The test generator produces metadata that integrates with `@isl-lang/isl-verify`:

```typescript
import { verify } from '@isl-lang/isl-verify';

// Run generated tests and collect results
const testResults = await runTests('./tests');

// Feed results to verifier
const verification = await verify({
  spec: './auth.isl',
  testMetadata: './tests/test-metadata.json',
  testResults,
});

console.log(verification.trustScore); // 0.0 - 1.0
```

## Handling NEEDS_IMPL Assertions

When the generator encounters patterns it can scaffold but not fully implement:

1. It generates `it.skip('NEEDS_IMPL: ...')` test cases
2. Includes an implementation hint in comments
3. Tracks in metadata as `status: 'needs_impl'`

To complete these scaffolds:

```typescript
// Generated scaffold
it.skip('NEEDS_IMPL: Idempotency key handling', async () => {
  // Implementation hint: Implement Payment.findByIdempotencyKey in your test runtime
  const existingPayment = await Payment.findByIdempotencyKey(input.idempotency_key);
  expect(existingPayment).toBeNull();
});

// Your implementation
it('Idempotency key handling', async () => {
  // First payment
  const first = await createPayment({ idempotency_key: 'key-1' });
  
  // Retry with same key
  const retry = await createPayment({ idempotency_key: 'key-1' });
  
  // Should return same result
  expect(retry.id).toEqual(first.id);
});
```

## API Reference

### `generate(domain, options)`

Generate test files from an ISL domain.

**Parameters:**
- `domain: AST.Domain` - Parsed ISL domain
- `options: GenerateOptions` - Generation options

**Returns:** `GenerateResult`

### `getStrategy(behavior, domain, forceDomain?)`

Get the appropriate strategy for a behavior.

### `detectDomain(behavior, domain)`

Detect which domain strategy matches a behavior.

### `registerStrategy(strategy)`

Register a custom domain strategy.

## License

MIT
