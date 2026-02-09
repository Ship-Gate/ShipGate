# Contract Testing Framework

Contract testing framework for ISL specifications that validates implementations match ISL behaviors using scenario-based tests.

## Features

- **Scenario-based testing**: Extract and run tests from ISL `scenarios` blocks
- **Contract test harness**: Bind behaviors to endpoint/functions and execute scenarios
- **Vitest integration**: Generate and run Vitest test files from ISL scenarios
- **Mock adapters**: Test without external services using in-memory adapters
- **Readable failures**: Clear error messages when tests fail

## Quick Start

### 1. Define Scenarios in ISL

```isl
domain UserAuthentication {
  behavior Login {
    input {
      email: String
      password: String
    }
    output {
      success: Session
      errors {
        INVALID_CREDENTIALS { when: "Email or password is incorrect" }
      }
    }
  }

  scenarios Login {
    scenario "successful login" {
      given {
        email = "alice@example.com"
        password = "password123"
      }
      when {
        result = Login(email: email, password: password)
      }
      then {
        result is success
        result.id != null
      }
    }

    scenario "invalid credentials" {
      given {
        email = "alice@example.com"
        password = "wrongpassword"
      }
      when {
        result = Login(email: email, password: password)
      }
      then {
        result is failure
        result.error == INVALID_CREDENTIALS
      }
    }
  }
}
```

### 2. Create Test File

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ContractTestHarness } from '@isl-lang/contract-testing';
import { ScenarioParser } from '@isl-lang/contract-testing';
import { readFileSync } from 'fs';

describe('Login Contract Tests', () => {
  let harness: ContractTestHarness;
  let parser: ScenarioParser;

  beforeEach(() => {
    harness = new ContractTestHarness();
    parser = new ScenarioParser();
    
    // Bind behavior to handler
    harness.bindBehavior('Login', async (input) => {
      // Your implementation
      return { success: true, id: 'session-123' };
    });
  });

  it('successful login', async () => {
    const islContent = readFileSync('auth.isl', 'utf-8');
    const parsed = parser.parseScenarios(islContent);
    const scenarios = parsed.find(p => p.behaviorName === 'Login');
    
    const scenario = scenarios?.scenarios.find(s => s.name === 'successful login');
    const testCase = harness.scenarioToTestCase(scenario!);
    const result = await harness.runTestCase(testCase);
    
    expect(result.passed).toBe(true);
  });
});
```

### 3. Run Tests

```bash
pnpm test:contracts
```

## API

### ContractTestHarness

Main harness for running contract tests.

```typescript
const harness = new ContractTestHarness({
  timeout: 5000,  // Test timeout in ms
  verbose: false   // Enable verbose output
});

// Bind behavior to handler
harness.bindBehavior('Login', async (input) => {
  // Implementation
});

// Convert scenario to test case
const testCase = harness.scenarioToTestCase(scenario);

// Run test case
const result = await harness.runTestCase(testCase);
```

### ScenarioParser

Parse ISL files and extract scenarios.

```typescript
const parser = new ScenarioParser();
const parsed = parser.parseScenarios(islContent);

// Returns array of ParsedScenarios
// Each contains behaviorName and scenarios array
```

### Mock Adapters

Use in-memory adapters for testing without external services.

```typescript
import { InMemoryAuthAdapter } from '@isl-lang/contract-testing';

const adapter = new InMemoryAuthAdapter();
const user = await adapter.createUser('test@example.com', 'hash_password');
```

Available adapters:
- `InMemoryAuthAdapter` - Authentication operations
- `InMemoryPaymentAdapter` - Payment operations
- `InMemoryUserAdapter` - User management operations

## Test Structure

Tests follow the ISL scenario structure:

- **given**: Setup test state and bind variables
- **when**: Invoke the behavior with input
- **then**: Assertions about the result

### Supported Assertions

- `result is success` - Behavior succeeded
- `result is failure` - Behavior failed
- `result.error == ERROR_NAME` - Specific error code
- `result.field == value` - Property comparison
- `Entity.field == value` - Entity property comparison

## Examples

See `tests/` directory for complete examples:
- `auth.contract.test.ts` - Authentication domain tests
- `payments.contract.test.ts` - Payments domain tests
- `users.contract.test.ts` - User management tests

## Running Tests

```bash
# Run all contract tests
pnpm test:contracts

# Run tests for specific package
pnpm --filter @isl-lang/contract-testing test
```

## Acceptance Criteria

✅ `pnpm test:contracts` runs and produces readable failures  
✅ Tests can run without needing external services (mocked adapters)  
✅ Scenarios are extracted from ISL files  
✅ Tests validate expected outputs and postconditions
