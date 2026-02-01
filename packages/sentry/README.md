# @intentos/sentry

Sentry integration for ISL (Intent Specification Language) error tracking and performance monitoring.

## Installation

```bash
npm install @intentos/sentry @sentry/node @sentry/profiling-node
```

## Quick Start

```typescript
import { initSentry, ISLSentry } from '@intentos/sentry';

// Initialize Sentry with ISL options
initSentry({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: '1.0.0',
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});

// Track behavior execution
const result = await ISLSentry.trackBehavior(
  'UserDomain',
  'createUser',
  async () => {
    return await createUser({ email: 'user@example.com' });
  }
);
```

## Features

### Behavior Tracking

Track ISL behavior execution with automatic error capture and performance spans:

```typescript
import { ISLSentry, trackBehavior } from '@intentos/sentry';

// Using the ISLSentry class
await ISLSentry.trackBehavior('UserDomain', 'createUser', async () => {
  return await userService.create(input);
});

// Using the standalone function
await trackBehavior('PaymentDomain', 'processPayment', async () => {
  return await paymentService.process(payment);
});
```

### Verification Tracking

Track verification results from the ISL verifier:

```typescript
import { ISLSentry, type VerifyResult } from '@intentos/sentry';

const result: VerifyResult = await verifier.verify(domain, behavior);
ISLSentry.trackVerification(result);
```

### Precondition Failures

Track precondition failures:

```typescript
import {
  trackPreconditionFailure,
  createPreconditionChecker,
  assertPrecondition,
} from '@intentos/sentry';

// Direct tracking
trackPreconditionFailure(
  'UserDomain',
  'createUser',
  'email.includes("@")',
  { email: 'invalid' }
);

// Create a reusable checker
const checkValidEmail = createPreconditionChecker(
  'UserDomain',
  'createUser',
  'validEmail',
  (input: { email: string }) => input.email.includes('@')
);

checkValidEmail({ email: 'test@example.com' }); // true, no tracking
checkValidEmail({ email: 'invalid' }); // false, tracks failure

// Assert (throws on failure)
assertPrecondition(
  'UserDomain',
  'createUser',
  'validEmail',
  input,
  (i) => i.email.includes('@')
);
```

### Postcondition Failures

Track postcondition failures:

```typescript
import {
  trackPostconditionFailure,
  createPostconditionChecker,
  withPostconditionTracking,
} from '@intentos/sentry';

// Direct tracking
trackPostconditionFailure(
  'UserDomain',
  'createUser',
  'result.id != null',
  { email: 'test@example.com' },
  { id: null }
);

// Wrap a function with postcondition tracking
const createUser = withPostconditionTracking(
  'UserDomain',
  'createUser',
  baseCreateUser,
  [
    { name: 'hasId', check: (_, output) => output.id != null },
    { name: 'hasTimestamp', check: (_, output) => output.createdAt != null },
  ]
);
```

### Invariant Violations

Track invariant violations:

```typescript
import {
  trackInvariantViolation,
  createInvariantChecker,
  createStateMonitor,
} from '@intentos/sentry';

// Direct tracking (captured as 'fatal' level)
trackInvariantViolation(
  'AccountDomain',
  'balance >= 0',
  { balance: -100 }
);

// Create a state monitor
const monitor = createStateMonitor('AccountDomain', [
  { name: 'balanceNonNegative', check: (s) => s.balance >= 0 },
  { name: 'activeOrClosed', check: (s) => s.status === 'active' || s.status === 'closed' },
]);

monitor.checkState(accountState);
```

### Express Middleware

Integrate with Express:

```typescript
import express from 'express';
import {
  sentryISLMiddleware,
  sentryISLErrorHandler,
  createISLMiddleware,
} from '@intentos/sentry';

const app = express();

// Basic middleware
app.use(sentryISLMiddleware());

// Custom middleware with options
app.use(createISLMiddleware({
  trackAllRequests: false,
  ignoreRoutes: ['/health', '/metrics'],
}));

// Error handler (after all routes)
app.use(sentryISLErrorHandler());
```

### Context and Breadcrumbs

Manage ISL context and breadcrumbs:

```typescript
import {
  setISLContext,
  setISLDomain,
  setISLBehavior,
  addBehaviorBreadcrumb,
  addVerificationBreadcrumb,
} from '@intentos/sentry';

// Set context
setISLBehavior('UserDomain', 'createUser');

// Add breadcrumbs
addBehaviorBreadcrumb('UserDomain', 'createUser', 'Processing user creation');
```

### Data Sanitization

Automatic sanitization of sensitive data:

```typescript
import { sanitizeInput, sanitizeOutput, sanitizeState } from '@intentos/sentry';

// Automatically redacts: password, token, apiKey, etc.
const sanitized = sanitizeInput({
  email: 'user@example.com',
  password: 'secret123', // -> '[REDACTED]'
});

// Custom options
const sanitized = sanitizeInput(data, {
  maxDepth: 5,
  maxStringLength: 500,
  redactFields: ['customSecret', 'internalId'],
});
```

### Performance Spans

Create custom performance spans:

```typescript
import {
  trackBehavior,
  trackPreconditionSpan,
  trackPostconditionSpan,
  createSpanBuilder,
} from '@intentos/sentry';

// Use span builder
const spans = createSpanBuilder('UserDomain', 'createUser');

await spans.behavior('validateInput', async () => {
  // validation logic
});

spans.precondition('validEmail', () => {
  return email.includes('@');
});
```

## API Reference

### Initialization

- `initSentry(options: ISLSentryOptions)` - Initialize Sentry with ISL options
- `closeSentry(timeout?: number)` - Close Sentry and flush events
- `flushSentry(timeout?: number)` - Flush pending events

### ISLSentry Class

- `ISLSentry.trackBehavior(domain, behavior, fn)` - Track behavior execution
- `ISLSentry.trackVerification(result)` - Track verification result
- `ISLSentry.trackPreconditionFailure(...)` - Track precondition failure
- `ISLSentry.trackPostconditionFailure(...)` - Track postcondition failure
- `ISLSentry.trackInvariantViolation(...)` - Track invariant violation

### Error Classes

- `PreconditionError` - Error for precondition failures
- `PostconditionError` - Error for postcondition failures
- `InvariantError` - Error for invariant violations

### Middleware

- `sentryISLMiddleware()` - Express middleware for ISL tracking
- `sentryISLErrorHandler()` - Express error handler
- `createISLMiddleware(options)` - Create customized middleware

## License

MIT
