# @intentos/stdlib-scheduling

ISL Standard Library for Job Scheduling - cron jobs, delayed execution, and multi-step workflows.

## Features

- **Delayed Jobs** - Schedule jobs to run after a specified delay
- **Cron Jobs** - Schedule recurring jobs using cron expressions
- **One-time Jobs** - Schedule jobs to run at a specific time
- **Job Deduplication** - Prevent duplicate jobs with unique keys
- **Retry with Backoff** - Automatic retry with exponential backoff
- **Workflows** - Multi-step job execution with dependencies
- **Priority Queue** - Execute higher priority jobs first

## Installation

```bash
npm install @intentos/stdlib-scheduling
# or
pnpm add @intentos/stdlib-scheduling
```

## Quick Start

### Basic Job Scheduling

```typescript
import { Scheduler, createScheduler } from '@intentos/stdlib-scheduling';

// Create scheduler
const scheduler = createScheduler({
  concurrency: 10,
  onEvent: (event) => console.log(event),
});

// Register handlers
scheduler.registerHandler('email.send', async (payload) => {
  await sendEmail(payload.to, payload.subject, payload.body);
  return { sent: true };
});

// Schedule a delayed job
const result = await scheduler.scheduleJob({
  name: 'welcome-email',
  handler: 'email.send',
  payload: {
    to: 'user@example.com',
    subject: 'Welcome!',
    body: 'Thanks for signing up.',
  },
  delay: 60000, // 1 minute
});

// Schedule a cron job
await scheduler.scheduleJob({
  name: 'daily-report',
  handler: 'reports.generate',
  cron: '0 9 * * *', // Every day at 9 AM
  timezone: 'America/New_York',
});

// Start the scheduler
scheduler.start();
```

### Workflow Execution

```typescript
import { WorkflowEngine } from '@intentos/stdlib-scheduling';

const handlers = new Map([
  ['orders.validate', async (payload) => { /* ... */ }],
  ['payments.charge', async (payload) => { /* ... */ }],
  ['inventory.reserve', async (payload) => { /* ... */ }],
  ['notifications.send', async (payload) => { /* ... */ }],
]);

const engine = new WorkflowEngine({ handlers });

// Run a workflow
const result = await engine.runWorkflow({
  name: 'order-processing',
  steps: [
    { name: 'validate', handler: 'orders.validate' },
    { name: 'charge', handler: 'payments.charge', dependsOn: ['validate'] },
    { name: 'reserve', handler: 'inventory.reserve', dependsOn: ['validate'] },
    { 
      name: 'notify', 
      handler: 'notifications.send', 
      dependsOn: ['charge', 'reserve'] 
    },
  ],
  initialContext: { orderId: 'order-123' },
  maxParallelism: 2,
});
```

## API Reference

### Scheduler

#### `scheduleJob(input)`

Schedule a new job for execution.

```typescript
const result = await scheduler.scheduleJob({
  name: 'my-job',
  handler: 'my.handler',
  payload: { data: 'value' },
  
  // One of these is required:
  delay: 60000,              // Delay in ms
  runAt: new Date('...'),    // Specific time
  cron: '0 9 * * *',         // Cron expression
  
  // Optional:
  timezone: 'UTC',
  priority: 50,              // 0-100, higher = sooner
  maxAttempts: 3,
  retryDelay: 1000,
  uniqueKey: 'dedup-key',    // For deduplication
  tags: ['important'],
  metadata: { custom: 'data' },
});
```

#### `cancelJob(input)`

Cancel a scheduled or pending job.

```typescript
await scheduler.cancelJob({
  jobId: 'job-123',
  reason: 'No longer needed',
});
```

#### `retryJob(input)`

Retry a failed job.

```typescript
await scheduler.retryJob({
  jobId: 'job-123',
  delay: 5000,              // Optional custom delay
  resetAttempts: false,     // Reset attempt counter
});
```

#### `listJobs(filters?)`

List jobs with optional filters.

```typescript
const jobs = scheduler.listJobs({
  status: 'SCHEDULED',
  handler: 'email.send',
  tags: ['important'],
  limit: 10,
  offset: 0,
});
```

### WorkflowEngine

#### `runWorkflow(input)`

Start a new workflow.

```typescript
const result = await engine.runWorkflow({
  name: 'my-workflow',
  steps: [
    { 
      name: 'step-1', 
      handler: 'handler.name',
      input: { data: 'value' },
      dependsOn: [],
      condition: 'context.someValue === true',
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      },
      timeout: 30000,
    },
  ],
  initialContext: {},
  continueOnFailure: false,
  maxParallelism: 1,
});
```

#### `pauseWorkflow(workflowId)`

Pause a running workflow.

#### `resumeWorkflow(workflowId)`

Resume a paused workflow.

#### `cancelWorkflow(workflowId)`

Cancel a workflow.

## ISL Intent Files

The ISL specifications are available in the `intents/` directory:

- `domain.isl` - Domain types and invariants
- `job.isl` - Job entity definition
- `schedule.isl` - Schedule entity definition
- `workflow.isl` - Workflow entity definition
- `behaviors/schedule-job.isl` - ScheduleJob behavior
- `behaviors/cancel-job.isl` - CancelJob behavior
- `behaviors/run-workflow.isl` - RunWorkflow behavior
- `behaviors/retry.isl` - RetryJob behavior

## Job Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Created but not yet scheduled |
| `SCHEDULED` | Scheduled for future execution |
| `RUNNING` | Currently executing |
| `COMPLETED` | Successfully completed |
| `FAILED` | Execution failed |
| `CANCELLED` | Cancelled by user |
| `RETRYING` | Scheduled for retry |

## Workflow Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Created but not started |
| `RUNNING` | Currently executing steps |
| `PAUSED` | Paused by user |
| `COMPLETED` | All steps completed |
| `FAILED` | One or more steps failed |
| `CANCELLED` | Cancelled by user |

## Events

The scheduler emits events for monitoring:

```typescript
const scheduler = createScheduler({
  onEvent: (event) => {
    switch (event.type) {
      case 'job.scheduled':
        console.log('Job scheduled:', event.job.id);
        break;
      case 'job.started':
        console.log('Job started:', event.job.id);
        break;
      case 'job.completed':
        console.log('Job completed:', event.job.id, event.result);
        break;
      case 'job.failed':
        console.log('Job failed:', event.job.id, event.error);
        break;
    }
  },
});
```

## License

MIT
