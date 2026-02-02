# @isl-lang/runtime-verify

Runtime verification helpers for generated code to enforce preconditions, postconditions, and invariants.

## Installation

```bash
npm install @isl-lang/runtime-verify
# or
pnpm add @isl-lang/runtime-verify
```

## Features

- **Runtime Assertions**: `require()`, `ensure()`, `invariant()` functions for contract enforcement
- **Typed Errors**: Specific error classes for each violation type
- **Structured Event Hooks**: Observable events for logging, metrics, and debugging
- **Deterministic Snippet Generators**: Code generation helpers for codegen consumers

## Usage

### Runtime Assertions

```typescript
import { require, ensure, invariant } from '@isl-lang/runtime-verify';

function transfer(from: Account, to: Account, amount: number): void {
  // Preconditions
  require(amount > 0, 'Amount must be positive');
  require(from.balance >= amount, 'Insufficient balance');
  
  // Execute
  from.balance -= amount;
  to.balance += amount;
  
  // Postconditions
  ensure(to.balance > 0, 'Recipient balance must be positive');
  
  // Invariants
  invariant(from.balance >= 0, 'Balance must never be negative');
}
```

### Batch Assertions

```typescript
import { requireAll, ensureAll, invariantAll } from '@isl-lang/runtime-verify';

function createUser(input: UserInput): User {
  // Check all preconditions at once
  requireAll([
    [input.email != null, 'Email is required'],
    [input.email.includes('@'), 'Email must be valid'],
    [input.age >= 18, 'Must be 18 or older'],
  ]);
  
  const user = { ...input, id: generateId() };
  
  // Check all postconditions
  ensureAll([
    [user.id != null, 'User must have ID'],
    [user.email === input.email, 'Email must be preserved'],
  ]);
  
  return user;
}
```

### Error Handling

```typescript
import {
  PreconditionError,
  PostconditionError,
  InvariantError,
  isPreconditionError,
  formatVerifyError,
} from '@isl-lang/runtime-verify';

try {
  createUser({ email: null });
} catch (error) {
  if (isPreconditionError(error)) {
    console.log('Input validation failed:', formatVerifyError(error));
    // PreconditionError [PRECONDITION_FAILED]: Email is required
  }
}
```

### Event Hooks

```typescript
import {
  registerHook,
  createMetricsHook,
  createJsonHook,
} from '@isl-lang/runtime-verify';

// Console logging
registerHook('console', (event) => {
  console.log(`[${event.type}] ${event.label}: ${event.passed ? 'PASS' : 'FAIL'}`);
});

// JSON logging for structured logs
registerHook('json', createJsonHook((json) => {
  fs.appendFileSync('verification.jsonl', json + '\n');
}));

// Metrics collection
const { handler, getMetrics } = createMetricsHook();
registerHook('metrics', handler);

// Later...
const metrics = getMetrics();
console.log(`Pass rate: ${metrics.passed / metrics.total * 100}%`);
```

### Event Buffering

```typescript
import {
  enableBuffering,
  flushEvents,
  getBufferedEvents,
} from '@isl-lang/runtime-verify';

// Enable buffering for batch processing
enableBuffering();

// Run operations...
processMultipleItems(items);

// Get all events
const events = getBufferedEvents();
console.log(`Collected ${events.length} verification events`);

// Or flush to hooks
flushEvents();
```

### Snippet Generation (for Codegen)

```typescript
import {
  generateRequireSnippet,
  generateVerifiedFunctionWrapper,
  generateImportSnippet,
  verifySnippetDeterminism,
} from '@isl-lang/runtime-verify';

// Generate individual checks
const check = generateRequireSnippet('amount > 0', 'Amount must be positive');
console.log(check.code);
// require(amount > 0, "Amount must be positive");

// Generate complete function wrapper
const wrapper = generateVerifiedFunctionWrapper(
  'createUser',
  [['input.email', 'Email required']],
  [['result.id', 'Must have ID']],
  []
);

// Verify determinism
console.log(verifySnippetDeterminism(wrapper)); // true

// Generate imports
const imports = generateImportSnippet(wrapper.imports);
console.log(imports.code);
// import { ensure, require } from '@isl-lang/runtime-verify';
```

## API Reference

### Assertions

| Function | Description |
|----------|-------------|
| `require(condition, message, options?)` | Assert a precondition |
| `ensure(condition, message, options?)` | Assert a postcondition |
| `invariant(condition, message, options?)` | Assert an invariant |
| `requireAll(checks)` | Assert multiple preconditions |
| `ensureAll(checks)` | Assert multiple postconditions |
| `invariantAll(checks)` | Assert multiple invariants |

### Error Classes

| Class | Description |
|-------|-------------|
| `VerifyError` | Base class for all verification errors |
| `PreconditionError` | Thrown when a precondition fails |
| `PostconditionError` | Thrown when a postcondition fails |
| `InvariantError` | Thrown when an invariant fails |
| `HookError` | Thrown when a hook handler fails |
| `EvaluationError` | Thrown when expression evaluation fails |

### Hooks

| Function | Description |
|----------|-------------|
| `registerHook(name, handler, config?)` | Register an event hook |
| `unregisterHook(name)` | Remove a hook |
| `emitEvent(event)` | Emit a verification event |
| `enableBuffering(maxSize?)` | Enable event buffering |
| `disableBuffering()` | Disable buffering and flush |
| `flushEvents()` | Flush buffered events |
| `getBufferedEvents()` | Get buffered events |
| `clearHooks()` | Remove all hooks |

### Snippet Generators

| Function | Description |
|----------|-------------|
| `generateRequireSnippet(expr, msg)` | Generate require() code |
| `generateEnsureSnippet(expr, msg)` | Generate ensure() code |
| `generateInvariantSnippet(expr, msg)` | Generate invariant() code |
| `generateVerifiedFunctionWrapper(...)` | Generate complete wrapper |
| `generateImportSnippet(symbols)` | Generate import statement |
| `generateModuleHeader()` | Generate module header |
| `verifySnippetDeterminism(snippet)` | Verify hash matches code |
| `combineSnippets(snippets)` | Combine multiple snippets |

## License

MIT
