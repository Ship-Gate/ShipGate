# Auth + Roles

Authentication domain with role-based access control, session management, and account lockout protection.

## Coverage

| Feature | Present |
|---------|---------|
| Preconditions | ✅ |
| Postconditions | ✅ (success + error paths) |
| Invariants | ✅ (lockout, escalation, secret handling) |
| Scenarios | ✅ (escalation prevention, lockout) |
| Temporal | ✅ (login p99, permission check p99) |
| Security | ✅ (rate limiting, bcrypt/argon2) |

## Key invariants

- **Lockout**: `failed_login_count > 5` implies `status == LOCKED`.
- **No privilege escalation**: actor cannot assign a role higher than their own.
- **SUPER_ADMIN omnipotence**: SUPER_ADMIN always passes permission checks.
- **Secrets**: password is never logged; hash uses bcrypt or argon2.

## Usage

```ts
import { samples } from '@isl/samples';
const auth = samples['auth-roles'];
```
