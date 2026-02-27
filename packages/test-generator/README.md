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
import { generateTests, writeFiles } from '@isl-lang/test-generator';
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
const result = generateTests(domain, {
  framework: 'vitest',
  outputDir: './tests',
  emitMetadata: true,
  includeSnapshots: true, // Generate snapshot tests for structured outputs
});

// Write files with automatic formatting
writeFiles(result.files, {
  outputDir: './tests',
  format: true, // Format with prettier/biome
  sortFiles: true, // Deterministic file ordering
});
```

## How Binding Works

The test generator binds ISL behaviors to test cases through several mechanisms:

1. **Precondition Binding**: Each precondition expression is analyzed and converted to input validation tests
2. **Postcondition Binding**: Postcondition predicates are compiled to assertion statements
3. **Scenario Binding**: ISL scenario blocks (given/when/then) are converted to concrete test cases
4. **Error Binding**: Error specifications generate negative test cases
5. **Property-Based Binding**: Hooks into `@isl-lang/isl-pbt` for property-based test generation

The generator uses domain-specific strategies to understand context and generate meaningful assertions beyond simple equality checks.

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
  
  // Generate snapshot tests for structured outputs (default: true)
  includeSnapshots?: boolean;
  
  // Include property-based test stubs (default: true)
  includePropertyTests?: boolean;
  
  // Generate test-metadata.json (default: true)
  emitMetadata?: boolean;
  
  // Force a specific domain strategy
  forceDomain?: 'auth' | 'payments' | 'uploads' | 'webhooks' | 'generic';
}
```

## Features

### Scenario Tests

The generator automatically converts ISL scenario blocks into test cases:

```isl
scenarios CreateUser {
  scenario "successful user creation" {
    given {
      email = "alice@example.com"
    }
    when {
      result = CreateUser(email: email)
    }
    then {
      result is success
      result.id != null
    }
  }
}
```

Generates:
```typescript
describe('Scenarios', () => {
  it('successful user creation', async () => {
    // Given: Setup test state
    const email = "alice@example.com";
    
    // When: Execute behavior
    const result = await CreateUser(email);
    
    // Then: Verify outcomes
    expect(result.success).toBe(true);
    expect(result.id).not.toBeNull();
  });
});
```

### Property-Based Test Stubs

When `@isl-lang/isl-pbt` is available, the generator creates property-based test hooks:

```typescript
describe('Property-Based Tests', () => {
  it('should satisfy all preconditions and postconditions', async () => {
    const { runPBT } = await import('@isl-lang/isl-pbt');
    const report = await runPBT(domain, 'Login', implementation, {
      numTests: 100,
      seed: 12345,
    });
    expect(report.success).toBe(true);
  });
});
```

### Snapshot Tests

For structured outputs, snapshot tests are automatically generated:

```typescript
describe('Login - Snapshot Tests', () => {
  it('should match snapshot for structured output', async () => {
    const result = await Login(input);
    expect(result).toMatchSnapshot();
  });
});
```

### Deterministic Output

The generator ensures deterministic output:
- Behaviors are sorted alphabetically
- Files are written in stable order
- Code is formatted consistently (prettier/biome)

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

## Golden Testing Integration

The test generator integrates with `@isl-lang/codegen-harness` for deterministic golden file testing:

```typescript
import { vitestGenerator, jestGenerator } from '@isl-lang/test-generator';

// Use in codegen-harness
import { ALL_GENERATORS } from '@isl-lang/codegen-harness';

// Add test generators
const generators = [
  ...ALL_GENERATORS,
  vitestGenerator,
  jestGenerator,
];
```

### Deterministic Output

All generated tests use seeded random number generation, ensuring:
- ✅ Same ISL spec → same test code
- ✅ Suitable for version control
- ✅ CI/CD regression testing
- ✅ Golden file comparison

The generator removes timestamps and uses stable formatting for deterministic output.

## Pure Behaviors vs API Behaviors

The generator automatically detects behavior types:

### Pure Behaviors (Unit Tests)
Behaviors without side effects generate unit tests:
- No entity lookups or mutations
- Simple input/output transformations
- Fast, isolated tests
- Example: `CalculateTotal`, `ValidateEmail`

### API Behaviors (Integration Scaffolds)
Behaviors with side effects generate integration test scaffolds:
- Entity lookups/mutations
- External service calls
- Database operations
- Example: `CreatePayment`, `Login`, `UploadFile`

The generator creates appropriate test structures for each type automatically.

## Examples

See [EXAMPLES.md](./EXAMPLES.md) for three comprehensive examples:
1. Pure Function Behavior (Unit Tests)
2. API Behavior (Integration Scaffolds)
3. Authentication Behavior (Domain-Specific)

## License

MIT
