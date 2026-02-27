# @isl-lang/test-runtime

Runtime utilities for generating and running executable tests with verification traces.

## Features

- **Login Test Harness**: Executable tests for login.isl covering SUCCESS, INVALID_CREDENTIALS, USER_LOCKED paths
- **Trace Emission**: Emits traces in isl-trace-format for verification
- **Fixture Store**: In-memory state for test adapters
- **ISL Verify Integration**: Formats output for `isl verify` command
- **PII Protection**: Automatically redacts sensitive data from traces

## Login Test Harness (Primary Feature)

### Quick Start

```bash
# Run all tests
pnpm test

# Run scenario tests individually
pnpm test:scenarios

# Export traces as JSON
pnpm test:export
```

### Usage

```typescript
import { 
  runLoginTests, 
  formatForISLVerify,
  createLoginTestHarness 
} from '@isl-lang/test-runtime';

// Run tests and get summary
const summary = await runLoginTests({ verbose: true });
console.log(`${summary.passed} passed, ${summary.failed} failed`);

// Format for isl verify command
const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);
console.log(`Verdict: ${verifyOutput.proofBundle.verdict}`);
```

### Test Output

```
========================================
  ISL Verify Output
========================================
  Spec:     login.isl
  Domain:   Auth v1.0.0
  Tests:    7 passed, 0 failed
  Verdict:  PROVEN
  Bundle:   000000003932219c
========================================
  ALL TESTS PASSED ✓
========================================
```

### Covered Scenarios

| Scenario | Test Count | Description |
|----------|------------|-------------|
| SUCCESS | 2 | Valid credentials → session created |
| INVALID_CREDENTIALS | 3 | Wrong password, user not found, inactive account |
| USER_LOCKED | 2 | Account locked, lockout after failures |

## Legacy Features

## Installation

```bash
pnpm add @isl-lang/test-runtime
```

## Usage

### Trace Emitter

```typescript
import { createTraceEmitter } from '@isl-lang/test-runtime';

const traceEmitter = createTraceEmitter({
  testName: 'login_success',
  domain: 'auth',
  behavior: 'login',
});

// Capture initial state
traceEmitter.captureInitialState({ users: 1 });

// Emit function call
traceEmitter.emitCall('POST', { email: 'user@example.com' });

// Emit return
traceEmitter.emitReturn('POST', { status: 200 }, 50);

// Emit checks
traceEmitter.emitCheck('response.status === 200', true, 'postcondition');

// Emit audit events
traceEmitter.emitAudit('LOGIN_SUCCESS', { user_id: 'user_123' });

// Emit rate limit checks
traceEmitter.emitRateLimitCheck('login:user@example.com', true, 10, 1);

// Finalize and get trace
const trace = traceEmitter.finalize(true);
```

### Test Generator

```typescript
import { generateLoginTests } from '@isl-lang/test-runtime';

const tests = generateLoginTests({
  routePath: './app/api/auth/login/route',
  outputDir: './tests/login',
  framework: 'vitest',
});

// Write generated tests to disk
for (const test of tests) {
  await fs.writeFile(test.path, test.content);
}
```

## Test Scenarios

The generator creates tests for:

| Status | Scenario | Description |
|--------|----------|-------------|
| 200 | Success | Valid credentials return session |
| 400 | Validation | Missing/invalid email or password |
| 401 | Invalid Credentials | Wrong password or user not found |
| 429 | Rate Limit | Too many requests per email/IP |

## CLI Integration

Run tests with trace collection:

```bash
isl test [pattern] --junit --json
```

Options:
- `--output <dir>`: Output directory for proof bundle (default: `.proof-bundle`)
- `--framework <framework>`: Test framework (`vitest` or `jest`)
- `--verbose`: Show detailed output
- `--junit`: Generate JUnit XML report
- `--json`: Generate JSON summary

## Proof Bundle Output

Test results are stored in the proof bundle:

```
.proof-bundle/
├── results/
│   ├── tests.json      # Test results summary
│   ├── junit.xml       # JUnit XML report
│   └── ...
├── traces/
│   ├── index.json      # Trace index
│   ├── trace_001.json  # Individual traces
│   └── ...
└── manifest.json       # Bundle manifest
```

## Security

All traces automatically redact PII:
- Emails: `j***@example.com`
- IPs: `192.168.xxx.xxx`
- Passwords: Never logged

Forbidden keys are completely removed:
- `password`, `password_hash`
- `secret`, `api_key`
- `access_token`, `refresh_token`
- `credit_card`, `ssn`

## License

MIT
