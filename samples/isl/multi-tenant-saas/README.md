# Multi-Tenant SaaS

Tenant provisioning with plan-based quotas, strict data isolation, and suspension controls.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (user counts, data scoping) |
| Invariants | ✅ (isolation, quota limits, upgrade safety) |
| Scenarios | ✅ (isolation enforcement, user limit) |
| Security | ✅ (DB-level tenant filter, access denied) |

## Key invariants

- **Tenant isolation**: queries NEVER return data from another tenant; filter applied at DB level.
- **User limit**: `TenantUser.count <= Tenant.max_users` enforced per plan tier.
- **Upgrade safety**: plan upgrade never reduces quotas; existing data preserved.
- **Suspension**: suspended tenants are read-only.

## Usage

```ts
import { samples } from '@isl/samples';
const mt = samples['multi-tenant-saas'];
```
