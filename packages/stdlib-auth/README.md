# @intentos/stdlib-auth

Authentication standard library for IntentOS. Provides complete behavioral contracts and reference implementations for user authentication.

## Overview

This package provides:

- **ISL Specifications**: Complete behavioral contracts for authentication
- **TypeScript Implementation**: Reference implementation satisfying all contracts
- **Test Suite**: Comprehensive tests validating contract compliance

## ISL Specifications

### Entities

- **User**: Core user entity with email, password hash, status lifecycle
- **Session**: Authentication session with expiration and revocation

### Behaviors

| Behavior | Description |
|----------|-------------|
| `Register` | Create user account, send verification email |
| `Login` | Validate credentials, create session |
| `Logout` | Revoke active session |
| `PasswordReset` | Request reset, update password with token |

## Installation

```bash
pnpm add @intentos/stdlib-auth
```

## Usage

### Import the ISL Domain

```isl
import { User, Session } from "@intentos/stdlib-auth"
import { Register, Login, Logout } from "@intentos/stdlib-auth/behaviors"
```

### TypeScript Implementation

```typescript
import { AuthService, User, Session } from '@intentos/stdlib-auth';

// Create service instance
const auth = new AuthService({
  hashRounds: 12,
  sessionDuration: '24h',
  maxFailedAttempts: 5
});

// Register a new user
const user = await auth.register({
  email: 'user@example.com',
  password: 'securePassword123',
  confirmPassword: 'securePassword123'
});

// Login
const session = await auth.login({
  email: 'user@example.com',
  password: 'securePassword123',
  ipAddress: '192.168.1.1'
});

// Validate session
const validatedUser = await auth.validateSession(session.id);

// Logout
await auth.logout(session.id);
```

## Security Features

- **Password Hashing**: bcrypt/argon2 with configurable rounds
- **Brute Force Protection**: Account lockout after failed attempts
- **Rate Limiting**: Per-IP and per-email limits
- **Secure Sessions**: Cryptographically secure session tokens
- **Timing Attack Resistance**: Constant-time password comparison

## Contract Guarantees

All implementations must satisfy:

### Preconditions
- Valid email format
- Password minimum length (8 chars)
- Session exists for logout/validation

### Postconditions
- User created with PENDING_VERIFICATION status on register
- Session created with valid expiration on login
- Session marked revoked on logout
- Password hash updated (not plaintext) on reset

### Invariants
- Passwords never stored in plaintext
- Passwords never appear in logs
- Session tokens cryptographically secure
- All auth events logged for audit

### Temporal Constraints
- Login: 500ms p50, 2s p99
- Verification email: within 5 minutes
- Session invalidation: immediate for new requests

## File Structure

```
packages/stdlib-auth/
├── intents/
│   ├── domain.isl        # Full auth domain specification
│   ├── user.isl          # User entity definition
│   ├── session.isl       # Session entity definition
│   └── behaviors/
│       ├── register.isl  # User registration behavior
│       ├── login.isl     # User login behavior
│       ├── logout.isl    # Session logout behavior
│       └── password-reset.isl  # Password reset flow
├── implementations/
│   └── typescript/
│       ├── index.ts      # Main exports
│       ├── user.ts       # User entity implementation
│       └── session.ts    # Session entity implementation
├── tests/
│   └── auth.test.ts      # Contract compliance tests
├── package.json
└── README.md
```

## License

MIT
