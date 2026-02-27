# Audit / Compliance

Immutable audit trail with SHA-256 checksum chaining, tamper detection, retention policies, and compliance exports.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (checksum chain, query filters, integrity result) |
| Invariants | ✅ (append-only, checksum chain, retention, self-logging) |
| Scenarios | ✅ (tamper detection, retention enforcement) |
| Temporal | ✅ (persistence p99, indexing deadline) |

## Key invariants

- **Append-only**: audit entries are never updated or deleted.
- **Checksum chain**: each entry's checksum includes its predecessor's checksum (blockchain-like).
- **Critical retention**: CRITICAL-severity entries use `REGULATORY_7Y` or `PERMANENT` retention.
- **Self-logging**: compliance exports are themselves audit-logged.

## Usage

```ts
import { samples } from '@isl/samples';
const audit = samples['audit-compliance'];
```
