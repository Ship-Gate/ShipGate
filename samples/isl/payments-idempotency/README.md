# Payments + Idempotency

Fund transfer domain with idempotency keys, refunds, and strict balance conservation.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (balance math, status transitions) |
| Invariants | ✅ (conservation, non-negative balance, single refund) |
| Scenarios | ✅ (idempotent replay, transfer+refund) |
| Temporal | ✅ (p99 latency, finalization deadline) |

## Key invariants

- **Money conservation**: sum of all account balances is constant across any transfer or refund.
- **Idempotency**: replaying the same `idempotency_key` returns the original `Transaction` without re-executing.
- **Non-negative balance**: `Account.balance >= 0` at all times.
- **Single refund**: a completed transaction may be refunded at most once.

## Usage

```ts
import { samples } from '@isl/samples';
const payments = samples['payments-idempotency'];
```
