# Event Sourcing

Order lifecycle modelled as an append-only event stream with projections, replay, and optimistic concurrency.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (event appended, projection updated) |
| Invariants | ✅ (append-only, deterministic replay, cancel guard) |
| Scenarios | ✅ (full lifecycle + replay, version conflict) |

## Key invariants

- **Append-only**: events are never mutated or deleted.
- **Deterministic replay**: replaying the event stream always produces the identical projection.
- **Optimistic concurrency**: `expected_version` mismatch raises `VERSION_CONFLICT`.
- **Cancel guard**: shipped/delivered orders cannot be cancelled.

## Usage

```ts
import { samples } from '@isl/samples';
const es = samples['event-sourcing'];
```
