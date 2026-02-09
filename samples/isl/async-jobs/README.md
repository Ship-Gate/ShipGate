# Async Jobs / Queue

Background job processing with priority queues, retry with exponential backoff, dead-letter handling, and concurrency control.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (status transitions, attempt tracking) |
| Invariants | ✅ (concurrency, priority ordering, dead-letter) |
| Scenarios | ✅ (retry→dead-letter, priority ordering) |
| Temporal | ✅ (exponential backoff) |

## Key invariants

- **Concurrency cap**: running jobs per queue ≤ `Queue.concurrency`.
- **Priority ordering**: CRITICAL > HIGH > NORMAL > LOW.
- **Dead-letter**: jobs exceeding `max_retries` move to `DEAD_LETTER` and are never auto-retried.
- **Exponential backoff**: retry delay = `2^attempt` seconds.

## Usage

```ts
import { samples } from '@isl/samples';
const jobs = samples['async-jobs'];
```
