# @isl-lang/trace-format

Stable trace event schema used by:
- Generated tests
- Healer iterations
- Verification engine
- Proof bundles

## Features

- **Stable JSON Schema**: Well-defined trace event structure
- **Automatic PII Redaction**: No email, password, token, or raw headers in traces
- **TypeScript Helper Library**: Easy-to-use emitter API
- **Schema Validation**: Runtime validation against JSON schema
- **Fixtures & Tests**: Ensures schema stability

## Installation

```bash
pnpm add @isl-lang/trace-format
```

## Usage

### Basic Trace Emission

```typescript
import { createTraceEmitter } from '@isl-lang/trace-format';

const emitter = createTraceEmitter({ domain: 'auth' });

// Emit handler call
emitter.emitHandlerCall('createUser', {
  email: 'user@example.com', // Will be redacted
  name: 'John Doe',
});

// Emit precondition check
emitter.emitCheck(
  'createUser',
  'email is valid',
  true,
  'precondition'
);

// Emit handler return
emitter.emitHandlerReturn(
  'createUser',
  {},
  { id: '123', email: '[REDACTED]' },
  1000 // duration in ms
);

// Build complete trace
const trace = emitter.buildTrace('User Creation Test', {
  testName: 'test_create_user',
  passed: true,
});

// Export as JSON
const json = emitter.exportTrace('User Creation Test');
```

### Custom Correlation ID

```typescript
import { createTraceEmitterWithCorrelation } from '@isl-lang/trace-format';

const emitter = createTraceEmitterWithCorrelation('request-123', {
  domain: 'payments',
});
```

### Error Handling

```typescript
try {
  await createUser(data);
} catch (error) {
  emitter.emitHandlerError('createUser', data, error);
}
```

### State Changes

```typescript
emitter.emitStateChange(
  'updateBalance',
  ['account', 'balance'],
  1000, // old value
  2000, // new value
  'processPayment' // source
);
```

### Nested Events

```typescript
const nestedEvents = [
  emitter.emitCheck('validate', 'x > 0', true, 'precondition'),
  emitter.emitStateChange('update', ['x'], 0, 1, 'validate'),
];

emitter.emitNested('process', nestedEvents);
```

## Schema

### TraceEvent

```typescript
interface TraceEvent {
  time: string;              // ISO 8601 timestamp
  kind: TraceEventKind;      // Event type
  correlationId: string;     // Correlation ID for tracing
  handler: string;           // Handler/function name
  inputs: Record<string, unknown>;  // Sanitized inputs (PII redacted)
  outputs: Record<string, unknown>; // Sanitized outputs (PII redacted)
  events: TraceEvent[];       // Nested events
  metadata?: Record<string, unknown>;
}
```

### Trace

```typescript
interface Trace {
  id: string;
  name: string;
  domain: string;
  startTime: string;
  endTime?: string;
  correlationId: string;
  events: TraceEvent[];
  initialState?: Record<string, unknown>;
  metadata?: TraceMetadata;
}
```

## Redaction Rules

The following fields are automatically redacted:

- **Authentication**: `password`, `token`, `accessToken`, `refreshToken`, `apiKey`, `secret`
- **Personal**: `email`, `ssn`, `phone`, `dateOfBirth`, `passport`
- **Financial**: `creditCard`, `cardNumber`, `cvv`, `bankAccount`
- **Network**: `ipAddress`, `authorization` header, `cookie` header

Headers are automatically sanitized:
- `authorization` → `[REDACTED]`
- `cookie` → `[REDACTED]`
- `x-api-key` → `[REDACTED]`
- Other headers with PII patterns are redacted

## Validation

```typescript
import { validateTrace, validateTraceEvent } from '@isl-lang/trace-format';

const result = validateTrace(trace);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Fixtures

```typescript
import { fixtures } from '@isl-lang/trace-format/fixtures';

const sampleTrace = fixtures.sampleTrace;
const failingTrace = fixtures.sampleFailingTrace;
const healerTrace = fixtures.sampleHealerIterationTrace;
```

## JSON Schema

The package includes a JSON schema file at `schema.json` that can be used for validation in other languages or tools.

## License

MIT
