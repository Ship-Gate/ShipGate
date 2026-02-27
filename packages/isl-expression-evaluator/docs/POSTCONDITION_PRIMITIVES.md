# Supported Postcondition Primitives v1

This document describes the postcondition primitives supported by the ISL Expression Evaluator v1.

## Overview

Postcondition primitives are specialized constructs for verifying state changes after behavior execution. They require before/after state comparison and are commonly used in error outcome validation.

## Primitives

### `increased_by(field, delta)`

Verifies that a numeric field value increased by a specific delta.

**ISL Syntax:**
```isl
User.failed_attempts increased by 1
Payment.refunded_amount increased by refund_amount
User.lookup_by_email(input.email).failed_attempts increased by 1
```

**Evaluation Semantics:**
- `after(field) - before(field) == delta`

**Direction Variants:**
- `increased by`: Checks positive delta
- `decreased by`: Checks negative delta (computed as `before - after`)

**API Usage:**
```typescript
import {
  increasedBy,
  simplePath,
  literalDelta,
  variableDelta,
  evaluatePostcondition,
  createPostconditionContext,
} from '@isl-lang/expression-evaluator';
import { createFromFieldStates } from '@isl-lang/expression-evaluator/adapters';

// Create adapter with before/after state
const adapter = createFromFieldStates({
  'User.failed_attempts': { before: 0, after: 1 },
});

// Create evaluation context
const ctx = createPostconditionContext({ adapter });

// Create predicate
const predicate = increasedBy(
  simplePath('User', 'failed_attempts'),
  literalDelta(1)
);

// Evaluate
const result = evaluatePostcondition(predicate, ctx);
// result.kind === 'true' | 'false' | 'unknown'
```

**Tri-State Behavior:**
- `true`: Field value increased by exact delta
- `false`: Field value did not increase, or increased by wrong amount
- `unknown`: Cannot determine before or after value

---

### `none_created(entityType)`

Verifies that no entities of the given type were created during behavior execution.

**ISL Syntax:**
```isl
no Session created
no token generated
Session.created == false
```

**Evaluation Semantics:**
- Check trace events for entity creation events
- Compare before/after state for new entity instances
- `count(created_entities_of_type) == 0`

**API Usage:**
```typescript
import {
  noneCreated,
  evaluatePostcondition,
  createPostconditionContext,
} from '@isl-lang/expression-evaluator';
import { createFromStateSnapshots } from '@isl-lang/expression-evaluator/adapters';

// Create adapter with before/after state
const adapter = createFromStateSnapshots(
  { Session: {} },
  { Session: {} }  // No sessions created
);

const ctx = createPostconditionContext({ adapter });
const predicate = noneCreated('Session');

const result = evaluatePostcondition(predicate, ctx);
// result.kind === 'true' (no Session was created)
```

**Tri-State Behavior:**
- `true`: No entities of the type were created
- `false`: One or more entities were created
- `unknown`: Cannot determine entity creation status

---

### `incremented(field)`

Verifies that a numeric field was incremented by any positive amount.

**ISL Syntax:**
```isl
actor.user.failed_attempts incremented
```

**Evaluation Semantics:**
- `after(field) > before(field)`

**API Usage:**
```typescript
import {
  incremented,
  simplePath,
  evaluatePostcondition,
  createPostconditionContext,
} from '@isl-lang/expression-evaluator';

const predicate = incremented(simplePath('User', 'failed_attempts'));
const result = evaluatePostcondition(predicate, ctx);
```

---

### `entity_created(entityType, count?)`

Verifies that an entity was created (positive counterpart to `none_created`).

**API Usage:**
```typescript
import { entityCreated } from '@isl-lang/expression-evaluator';

// At least one Session was created
const predicate1 = entityCreated('Session');

// Exactly 2 Sessions were created
const predicate2 = entityCreated('Session', 2);
```

---

## Field References

Postcondition primitives support multiple field reference formats:

### Simple Path
Direct property access:
```typescript
simplePath('User', 'failed_attempts')
// Evaluates: User.failed_attempts
```

### Method Call Field
Property access via method call:
```typescript
methodCallField('User', 'lookup_by_email', [inputEmail], 'failed_attempts')
// Evaluates: User.lookup_by_email(input.email).failed_attempts
```

---

## Delta Values

For `increased_by` predicates, delta can be:

### Literal Delta
A constant numeric value:
```typescript
literalDelta(1)
```

### Variable Delta
A reference to a context variable:
```typescript
variableDelta('refund_amount')     // From context variables
variableDelta('input.amount')      // From input
```

---

## Lowering from ISL Strings

The lowering pass converts ISL postcondition syntax to evaluable predicates:

```typescript
import { lowerFromString, evaluatePostcondition } from '@isl-lang/expression-evaluator';

// Lower from ISL syntax
const result = lowerFromString('User.failed_attempts increased by 1');

if (result.success) {
  const evalResult = evaluatePostcondition(result.predicate, ctx);
}
```

**Supported Patterns:**
| Pattern | Predicate |
|---------|-----------|
| `X increased by Y` | `IncreasedByPredicate` |
| `X decreased by Y` | `IncreasedByPredicate` (direction: 'decreased') |
| `no X created` | `NoneCreatedPredicate` |
| `no X generated` | `NoneCreatedPredicate` |
| `X.created == false` | `NoneCreatedPredicate` |
| `X incremented` | `IncrementedPredicate` |

---

## Postcondition Adapter

The `PostconditionAdapter` interface provides before/after state access:

```typescript
interface PostconditionAdapter {
  // Get field value before behavior execution
  getBeforeValue(field: FieldReference): unknown | 'unknown';
  
  // Get field value after behavior execution
  getAfterValue(field: FieldReference): unknown | 'unknown';
  
  // Check if entity was created during execution
  wasEntityCreated(entityType: string): boolean | 'unknown';
  
  // Get count of created entities
  getCreatedEntityCount(entityType: string): number | 'unknown';
  
  // Get all creation events
  getCreationEvents(entityType: string): TraceEventData[];
}
```

### Creating Adapters

**From Field States (Testing):**
```typescript
import { createFromFieldStates } from '@isl-lang/expression-evaluator/adapters';

const adapter = createFromFieldStates({
  'User.failed_attempts': { before: 0, after: 1 },
  'User.balance': { before: 100, after: 50 },
});
```

**From State Snapshots:**
```typescript
import { createFromStateSnapshots } from '@isl-lang/expression-evaluator/adapters';

const beforeState = {
  User: { 'user-123': { failed_attempts: 0 } },
  Session: {},
};

const afterState = {
  User: { 'user-123': { failed_attempts: 1 } },
  Session: {},  // No session created
};

const adapter = createFromStateSnapshots(beforeState, afterState);
```

**From Traces:**
```typescript
import { createPostconditionTraceAdapter } from '@isl-lang/expression-evaluator/adapters';

const adapter = createPostconditionTraceAdapter({
  traces: [proofBundleTrace],
  beforeState: initialState,
  afterState: finalState,
});
```

---

## Batch Evaluation

Evaluate multiple postconditions at once:

```typescript
import { evaluatePostconditions } from '@isl-lang/expression-evaluator';

const predicates = [
  increasedBy(simplePath('User', 'failed_attempts'), literalDelta(1)),
  noneCreated('Session'),
];

const { overall, results } = evaluatePostconditions(predicates, ctx);
// overall: 'true' | 'false' | 'unknown'
// results: PostconditionResult[]
```

**Combined Result Logic:**
- Any `false` → overall `false`
- Any `unknown` (no `false`) → overall `unknown`
- All `true` → overall `true`

---

## Result Details

`PostconditionResult` includes detailed comparison information:

```typescript
interface PostconditionResult {
  kind: 'true' | 'false' | 'unknown';
  reason?: string;
  evidence?: unknown;
  postconditionDetails?: {
    predicateKind: string;
    beforeValue?: unknown;
    afterValue?: unknown;
    computedDelta?: number;
    expectedDelta?: number;
    createdEntities?: string[];
  };
}
```

**Generate Human-Readable Summary:**
```typescript
import { summarizePostconditionResults } from '@isl-lang/expression-evaluator';

const { results } = evaluatePostconditions(predicates, ctx);
const summary = summarizePostconditionResults(results);
console.log(summary);
// Postcondition Evaluation: 2 passed, 0 failed, 0 unknown
//
//   ✓ increased_by: OK
//   ✓ none_created: OK
```

---

## Use Case: INVALID_CREDENTIALS Path

Common postcondition for login with invalid credentials:

```isl
post INVALID_CREDENTIALS {
  - User.failed_attempts == old(User.failed_attempts) + 1
  - no Session created
}
```

**Evaluation Code:**
```typescript
import {
  increasedBy,
  noneCreated,
  simplePath,
  literalDelta,
  evaluatePostconditions,
  createPostconditionContext,
} from '@isl-lang/expression-evaluator';
import { createFromStateSnapshots } from '@isl-lang/expression-evaluator/adapters';

// State before login attempt
const beforeState = {
  User: { 'user-123': { email: 'test@example.com', failed_attempts: 0 } },
  Session: {},
};

// State after failed login attempt
const afterState = {
  User: { 'user-123': { email: 'test@example.com', failed_attempts: 1 } },
  Session: {},  // No session created
};

const adapter = createFromStateSnapshots(beforeState, afterState);
const ctx = createPostconditionContext({ adapter });

const postconditions = [
  increasedBy(simplePath('User', 'user-123', 'failed_attempts'), literalDelta(1)),
  noneCreated('Session'),
];

const { overall, results } = evaluatePostconditions(postconditions, ctx);
console.log(`INVALID_CREDENTIALS postcondition: ${overall}`);
// INVALID_CREDENTIALS postcondition: true
```

---

## Future Primitives (Planned)

- `changed(field)`: Verify any change occurred
- `unchanged(field)`: Verify no change occurred
- `set_to(field, value)`: Verify field set to specific value
- `contains(collection, item)`: Verify collection membership
- `one_of(field, values)`: Verify field is one of allowed values
