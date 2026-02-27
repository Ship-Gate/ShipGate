# Hard Mode: Invariants + Temporal Constraints

Distributed reservation system exercising the most complex ISL features: capacity-aware scheduling, temporal deadlines, optimistic concurrency, state machine constraints, and conflict resolution.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (status, version, timestamps) |
| Invariants | ✅ (capacity, state machine, temporal ordering, conflict resolution) |
| Scenarios | ✅ (hold expiry, double booking, concurrency, late cancel) |
| Temporal | ✅ (hold deadline, periodic expiry job, p99 latencies) |

## Key invariants

- **Capacity at any point in time**: `count(HELD ∪ CONFIRMED overlapping t) ≤ resource.capacity` for all `t`.
- **State machine**: only valid transitions (PENDING→HELD→CONFIRMED/EXPIRED/CANCELLED). Terminal states are irreversible.
- **Temporal ordering**: `confirmed_at < starts_at` and `held_until < starts_at`.
- **Hold deadline**: 10-minute hold with zero grace period — confirmation after `held_until` is rejected.
- **Late cancel block**: cannot cancel within 1 hour of `starts_at`.
- **Conflict resolution**: detected capacity violations must result in at least one reservation moving to CONFLICT.

## Why "hard mode"?

This sample combines:
1. **Point-in-time capacity checks** (not just row-level uniqueness)
2. **Temporal deadlines** with automatic expiration
3. **Optimistic concurrency** via version fields
4. **State machine** with guarded transitions
5. **Conflict detection** as a separate audit/repair behavior

Any generator or verifier that handles this domain correctly handles real-world complexity.

## Usage

```ts
import { samples } from '@isl/samples';
const hard = samples['hard-mode'];
```
