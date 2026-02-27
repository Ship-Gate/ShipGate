# @isl-lang/verifier-temporal

Temporal property verification for ISL specifications. Verifies temporal properties including:
- **Eventually**: Property must become true within a duration
- **Within**: Operation must complete within a deadline
- **Always**: Property must remain true throughout a duration
- **Never**: Property must never become true
- **Sequence Rules**: Event sequence constraints (before, cooldown, retry, time window)

## Features

### Basic Temporal Properties

- `eventually`: Property becomes true within duration
- `within`: Operation completes within deadline (with percentile support)
- `always`: Property remains true throughout duration
- `never`: Property never becomes true

### Sequence-Based Temporal Rules

- **Before**: Event A must happen before event B
- **Cooldown**: Event A cannot happen again within duration D
- **Retry**: If event A fails, it must retry within duration D
- **Time Window**: Event A must happen within time window [start, end]

## Usage

### Basic Temporal Verification

```typescript
import { verify } from '@isl-lang/verifier-temporal';
import { parseDomain } from '@isl-lang/parser';

const domain = parseDomain(islSpec);
const result = await verify('./src/implementation.ts', domain, 'BehaviorName');

console.log(result.verdict); // 'verified' | 'risky' | 'unsafe'
console.log(result.score); // 0-100
```

### Sequence-Based Verification

```typescript
import { verifySequenceRule, verifySequenceRules } from '@isl-lang/verifier-temporal';
import type { BeforeRule, CooldownRule } from '@isl-lang/verifier-temporal';

// Define rules
const rules = [
  {
    type: 'before' as const,
    id: 'auth-before-authz',
    description: 'Authenticate must happen before authorize',
    firstEvent: { kind: 'handler_call', handler: 'authenticate' },
    secondEvent: { kind: 'handler_call', handler: 'authorize' },
  },
  {
    type: 'cooldown' as const,
    id: 'api-cooldown',
    description: 'API requests must have 1s cooldown',
    event: { kind: 'handler_call', handler: 'api_request' },
    duration: { value: 1, unit: 's' },
  },
];

// Verify against traces
const traces = [trace1, trace2, trace3];
const results = verifySequenceRules(rules, traces);

for (const result of results) {
  if (!result.satisfied) {
    console.error(`Violation: ${result.explanation}`);
    console.error(`Expected: ${result.violation?.expected}`);
    console.error(`Actual: ${result.violation?.actual}`);
  }
}
```

### Claim Graph Integration

```typescript
import { sequenceResultsToClaims } from '@isl-lang/verifier-temporal';
import { ClaimGraphBuilder } from '@isl-lang/proof';

const results = verifySequenceRules(rules, traces);
const claims = sequenceResultsToClaims(results);

const builder = new ClaimGraphBuilder();
builder.addClaims(claims);
const graph = builder.build();
```

## Test Traces

The package includes sample test traces for common scenarios:

```typescript
import {
  createLoginTrace,
  createLoginTraceViolation,
  createRateLimitTrace,
  createRetryTrace,
  createTimeWindowTrace,
} from '@isl-lang/verifier-temporal';

// Use test traces for development and testing
const trace = createLoginTrace();
const result = verifySequenceRule(rule, trace);
```

## API Reference

### Sequence Rules

#### BeforeRule
```typescript
interface BeforeRule {
  type: 'before';
  id: string;
  description: string;
  firstEvent: EventMatcher;
  secondEvent: EventMatcher;
  allowSameTime?: boolean;
}
```

#### CooldownRule
```typescript
interface CooldownRule {
  type: 'cooldown';
  id: string;
  description: string;
  event: EventMatcher;
  duration: DurationLiteral;
  perCorrelationId?: boolean;
}
```

#### RetryRule
```typescript
interface RetryRule {
  type: 'retry';
  id: string;
  description: string;
  event: EventMatcher;
  retryWindow: DurationLiteral;
  maxRetries?: number;
}
```

#### TimeWindowRule
```typescript
interface TimeWindowRule {
  type: 'time_window';
  id: string;
  description: string;
  event: EventMatcher;
  windowStart: DurationLiteral | number;
  windowEnd: DurationLiteral | number;
  relativeToTraceStart?: boolean;
}
```

### Event Matcher

```typescript
interface EventMatcher {
  kind?: string;
  handler?: string | RegExp;
  predicate?: (event: TraceEvent) => boolean;
}
```

## Examples

### Example: Login Flow Verification

```typescript
const rule: BeforeRule = {
  type: 'before',
  id: 'login-sequence',
  description: 'Authenticate before authorize',
  firstEvent: { kind: 'handler_call', handler: 'authenticate' },
  secondEvent: { kind: 'handler_call', handler: 'authorize' },
};

const trace = createLoginTrace();
const result = verifySequenceRule(rule, trace);

if (!result.satisfied) {
  console.error(`Violation at t=${result.violation?.timestampMs}ms`);
}
```

### Example: Rate Limiting

```typescript
const rule: CooldownRule = {
  type: 'cooldown',
  id: 'api-rate-limit',
  description: 'API requests must have 1s cooldown',
  event: { kind: 'handler_call', handler: 'api_request' },
  duration: { value: 1, unit: 's' },
  perCorrelationId: true, // Check per user/session
};

const traces = [trace1, trace2];
const results = verifySequenceRules([rule], traces);
```

### Example: Retry Logic

```typescript
const rule: RetryRule = {
  type: 'retry',
  id: 'payment-retry',
  description: 'Payment must retry within 500ms after failure',
  event: { kind: 'handler_call', handler: 'process_payment' },
  retryWindow: { value: 500, unit: 'ms' },
  maxRetries: 3,
};

const result = verifySequenceRule(rule, paymentTrace);
```

## Integration with Proof Bundle

Temporal verification results can be integrated into proof bundles:

```typescript
import { sequenceResultsToClaims } from '@isl-lang/verifier-temporal';
import { buildUnifiedClaimGraph } from '@isl-lang/proof';

const results = verifySequenceRules(rules, traces);
const claims = sequenceResultsToClaims(results);

const graph = buildUnifiedClaimGraph({
  customClaims: claims,
});
```

## License

MIT
