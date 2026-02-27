# @isl/samples — Canonical Sample Library

**10 domain samples** used by every generator, verifier, and test harness in the IntentOS ecosystem. Stop inventing examples — import these instead.

## Domains

| # | Domain | Key Features |
|---|--------|-------------|
| 1 | **tiny-crud** | Minimal CRUD with status transitions and lifecycle scenario |
| 2 | **auth-roles** | RBAC, lockout, privilege escalation prevention, rate limiting |
| 3 | **payments-idempotency** | Idempotency keys, balance conservation, refunds |
| 4 | **async-jobs** | Priority queues, retry with exponential backoff, dead-letter |
| 5 | **event-sourcing** | Append-only events, projections, deterministic replay, optimistic concurrency |
| 6 | **multi-tenant-saas** | Tenant isolation, plan quotas, suspension controls |
| 7 | **realtime-websocket** | Message ordering, presence, heartbeat timeout |
| 8 | **file-storage** | Upload pipeline, virus scanning, checksum integrity, quotas |
| 9 | **audit-compliance** | Checksum-chained audit log, tamper detection, retention policies |
| 10 | **hard-mode** | Capacity scheduling, temporal deadlines, state machines, conflict resolution |

## Every sample includes

- `domain.isl` — full ISL spec with **pre/post/invariants/scenarios**
- `expected/claims.json` — expected verification claims
- `expected/verdicts.json` — expected ship/no-ship verdict
- `README.md` — domain overview and key invariants

## Usage

```ts
import { samples, getSample, getAllSamples, DOMAIN_NAMES } from '@isl/samples';

// Get a single sample
const crud = getSample('tiny-crud');
console.log(crud.isl);           // raw ISL source
console.log(crud.expected);      // { claims, verdicts }

// Iterate all samples in tests
for (const sample of getAllSamples()) {
  test(`${sample.name} parses`, () => {
    const ast = parse(sample.isl);
    expect(ast.errors).toHaveLength(0);
  });
}

// Direct access via record
const hard = samples['hard-mode'];
```

## Coverage Matrix

| Feature | tiny-crud | auth-roles | payments | async-jobs | event-sourcing | multi-tenant | websocket | file-storage | audit | hard-mode |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Preconditions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Postconditions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invariants | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scenarios | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Temporal | — | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ |
| Security | — | ✅ | — | — | — | ✅ | ✅ | — | — | — |
