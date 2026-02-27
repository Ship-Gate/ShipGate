# @intentos/stdlib-workflow

Workflow Engine Standard Library for IntentOS - provides state machines, saga orchestration, and distributed transaction compensation.

## Features

- **Workflow Engine**: Execute multi-step workflows with automatic state management
- **Saga Pattern**: Orchestrate distributed transactions with compensation
- **Compensation**: Rollback completed steps when failures occur
- **Retry Strategies**: Configurable retry with exponential backoff, fixed delay, or linear backoff
- **Conditional Execution**: Skip steps based on runtime conditions
- **Event System**: Subscribe to workflow lifecycle events
- **TypeScript First**: Full type safety and IntelliSense support

## Installation

```bash
npm install @intentos/stdlib-workflow
```

## Quick Start

### Basic Workflow

```typescript
import { createWorkflowEngine, StepDefinition } from '@intentos/stdlib-workflow';

const engine = createWorkflowEngine();

// Register handlers
engine.registerHandler('validate_order', async (ctx) => {
  const { order_id } = ctx.context;
  return { success: true, output: { validated: true } };
});

engine.registerHandler('process_payment', async (ctx) => {
  return { success: true, output: { payment_id: 'pay_123' } };
});

engine.registerHandler('fulfill_order', async (ctx) => {
  return { success: true, output: { shipment_id: 'ship_456' } };
});

// Define workflow steps
const steps: StepDefinition[] = [
  { id: 'validate', name: 'Validate Order', handler: 'validate_order' },
  { id: 'payment', name: 'Process Payment', handler: 'process_payment' },
  { id: 'fulfill', name: 'Fulfill Order', handler: 'fulfill_order' },
];

// Start workflow
const result = await engine.start('order_processing', steps, {
  initialContext: { order_id: 'order_123' },
  correlationId: 'trace_abc',
});

if (result.success) {
  console.log('Workflow started:', result.data.id);
}
```

### Saga with Compensation

```typescript
import { createSagaOrchestrator } from '@intentos/stdlib-workflow';

const orchestrator = createSagaOrchestrator();

// Define saga with compensation handlers
const saga = orchestrator
  .define('order_fulfillment')
  .step(
    'reserve_inventory',
    'Reserve Inventory',
    async (ctx) => {
      // Reserve inventory
      return { success: true, output: { reservation_id: 'res_123' } };
    },
    async (ctx) => {
      // Compensation: Release reserved inventory
      console.log('Releasing inventory:', ctx.originalOutput?.reservation_id);
      return { success: true };
    }
  )
  .step(
    'charge_payment',
    'Charge Payment',
    async (ctx) => {
      // Charge customer
      return { success: true, output: { payment_id: 'pay_123' } };
    },
    async (ctx) => {
      // Compensation: Refund payment
      console.log('Refunding payment:', ctx.originalOutput?.payment_id);
      return { success: true };
    }
  )
  .step(
    'ship_order',
    'Ship Order',
    async (ctx) => {
      // Ship order
      return { success: true, output: { tracking: 'TRACK123' } };
    },
    async (ctx) => {
      // Compensation: Cancel shipment
      console.log('Canceling shipment');
      return { success: true };
    }
  )
  .build();

// Execute saga
const result = await orchestrator.execute(saga.id, {
  order_id: 'order_123',
  customer_id: 'cust_456',
  amount: 99.99,
});

if (result.success) {
  console.log('Order fulfilled:', result.result);
} else {
  console.log('Order failed, compensated:', result.compensated);
}
```

## API Reference

### WorkflowEngine

```typescript
const engine = createWorkflowEngine(config?: WorkflowEngineConfig);
```

#### Configuration

```typescript
interface WorkflowEngineConfig {
  maxConcurrentWorkflows?: number;  // Default: 100
  defaultStepTimeout?: number;       // Default: 30000ms
  defaultRetryConfig?: RetryConfig;
  onEvent?: (event: WorkflowEventType) => void;
  logger?: Logger;
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `registerHandler(name, handler)` | Register a step execution handler |
| `registerCompensationHandler(name, handler)` | Register a compensation handler |
| `start(name, steps, options)` | Create and start a workflow |
| `create(name, steps, options)` | Create a workflow without starting |
| `resume(workflowId, context?)` | Resume a paused/pending workflow |
| `pause(workflowId, reason?)` | Pause a running workflow |
| `cancel(workflowId, options?)` | Cancel a workflow |
| `compensate(workflowId, reason?)` | Trigger compensation |
| `get(workflowId)` | Get workflow by ID |
| `getStatus(workflowId)` | Get workflow status with progress |
| `list(query?)` | List workflows with filtering |

### SagaOrchestrator

```typescript
const orchestrator = createSagaOrchestrator(config?: WorkflowEngineConfig);
```

#### Methods

| Method | Description |
|--------|-------------|
| `define(name)` | Start building a saga definition |
| `register(saga)` | Register a saga definition |
| `execute(sagaId, context, options)` | Execute saga synchronously |
| `executeAsync(sagaId, context, options)` | Execute saga asynchronously |
| `getStatus(workflowId)` | Get saga execution status |
| `abort(workflowId, reason?)` | Abort a running saga |

### Step Definition

```typescript
interface StepDefinition {
  id: string;                    // Unique step ID
  name: string;                  // Human-readable name
  handler: string;               // Handler function name
  compensationHandler?: string;  // Compensation handler name
  timeout?: number;              // Step timeout in ms
  retry?: RetryConfig;           // Retry configuration
  condition?: string;            // Conditional execution expression
  onFailure?: FailureAction;     // What to do on failure
  input?: Record<string, unknown>;
}
```

### Retry Configuration

```typescript
interface RetryConfig {
  strategy: RetryStrategy;       // NONE, FIXED_DELAY, EXPONENTIAL, LINEAR
  maxRetries: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;           // For exponential backoff
}
```

### Failure Actions

```typescript
enum FailureAction {
  FAIL_WORKFLOW,    // Mark workflow as failed
  COMPENSATE,       // Trigger compensation (default)
  SKIP,             // Skip step and continue
  PAUSE,            // Pause for manual intervention
}
```

### Workflow Status

```typescript
enum WorkflowStatus {
  PENDING,       // Created but not started
  RUNNING,       // Currently executing
  PAUSED,        // Paused, awaiting resume
  COMPLETED,     // All steps completed
  FAILED,        // Step failed
  COMPENSATING,  // Running compensations
  COMPENSATED,   // Compensations complete
  CANCELLED,     // Workflow cancelled
}
```

## Compensation Strategies

### Sequential Compensation (Default)

Execute compensations in strict reverse order:

```typescript
const plan = createCompensationPlan(workflowId)
  .withStrategy(CompensationStrategy.SEQUENTIAL)
  .build();
```

### Parallel Compensation

Execute independent compensations simultaneously:

```typescript
const plan = createCompensationPlan(workflowId)
  .withStrategy(CompensationStrategy.PARALLEL)
  .build();
```

### Best Effort

Continue with remaining compensations even if some fail:

```typescript
const plan = createCompensationPlan(workflowId)
  .withStrategy(CompensationStrategy.BEST_EFFORT)
  .build();
```

## Compensation Helpers

### Idempotent Compensation

```typescript
import { idempotentCompensation } from '@intentos/stdlib-workflow';

const handler = idempotentCompensation(
  async (ctx) => {
    // Actual compensation logic
    return { success: true };
  },
  async (ctx) => {
    // Check if already compensated
    return await db.isCompensated(ctx.stepId);
  }
);
```

### Composed Compensation

```typescript
import { composeCompensations } from '@intentos/stdlib-workflow';

const handler = composeCompensations([
  async (ctx) => { /* step 1 */ return { success: true }; },
  async (ctx) => { /* step 2 */ return { success: true }; },
  async (ctx) => { /* step 3 */ return { success: true }; },
]);
```

### Retry Wrapper

```typescript
import { withRetry } from '@intentos/stdlib-workflow';

const handler = withRetry(
  async (ctx) => {
    // Compensation logic that might fail
    return { success: true };
  },
  3,      // Max retries
  1000    // Delay between retries (ms)
);
```

## Events

Subscribe to workflow lifecycle events:

```typescript
const engine = createWorkflowEngine({
  onEvent: (event) => {
    switch (event.type) {
      case 'WORKFLOW_STARTED':
        console.log('Started:', event.payload.name);
        break;
      case 'WORKFLOW_COMPLETED':
        console.log('Completed in:', event.payload.durationMs, 'ms');
        break;
      case 'WORKFLOW_FAILED':
        console.log('Failed at step:', event.payload.stepId);
        break;
      case 'STEP_TRANSITIONED':
        console.log('Transitioned:', event.payload.fromStep, '->', event.payload.toStep);
        break;
      case 'COMPENSATION_STARTED':
        console.log('Compensation started:', event.payload.reason);
        break;
      case 'COMPENSATION_COMPLETED':
        console.log('Compensated:', event.payload.stepsCompensated, 'steps');
        break;
    }
  },
});
```

## ISL Domain

The workflow domain is defined in ISL (Intent Specification Language):

```isl
domain Workflow {
  version: "1.0.0"
  
  entity Workflow {
    id: WorkflowId [immutable, unique]
    name: String
    status: WorkflowStatus
    steps: List<Step>
    compensation_stack: List<StepId>
    
    lifecycle {
      PENDING -> RUNNING -> COMPLETED
      RUNNING -> FAILED -> COMPENSATING -> COMPENSATED
    }
  }
  
  behavior StartWorkflow { ... }
  behavior Transition { ... }
  behavior Compensate { ... }
}
```

See the `intents/` directory for complete ISL specifications.

## Testing

```bash
npm test
```

## License

MIT
