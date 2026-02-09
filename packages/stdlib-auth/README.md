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
import { Register, Login, Logout, RefreshToken } from "@intentos/stdlib-auth/behaviors"
import { CheckPermission, EvaluatePolicy } from "@intentos/stdlib-auth/behaviors/authorize"
```

### TypeScript Implementation

```typescript
import { AuthService, createInMemoryAuthService } from '@intentos/stdlib-auth';

// Create service instance with in-memory repositories (for testing)
const authService = createInMemoryAuthService({
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000 // 15 minutes
});

// Register a new user
const registerResult = await authService.register({
  email: 'user@example.com',
  password: 'SecurePass123',
  confirmPassword: 'SecurePass123',
  acceptTerms: true,
  ipAddress: '192.168.1.1'
});

// Login
const loginResult = await authService.login({
  email: 'user@example.com',
  password: 'SecurePass123',
  ipAddress: '192.168.1.1'
});

if (loginResult.success) {
  const { token, user, session } = loginResult.data;
  console.log('Logged in:', user.email);
  console.log('Session token:', token);
}

// Validate session
const validateResult = await authService.validateSession({
  sessionToken: token
});

// Logout
const logoutResult = await authService.logout({
  sessionId: session.id
});
```

### Fastify Adapter

```typescript
import Fastify from 'fastify';
import { createInMemoryAuthService } from '@intentos/stdlib-auth';
import { registerAuthPlugin } from '@intentos/stdlib-auth/adapters/fastify';

const fastify = Fastify({ logger: true });

const authService = createInMemoryAuthService();

// Register auth plugin
await fastify.register(registerAuthPlugin, {
  authService,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: '24h'
});

// Protected route
fastify.get('/api/protected', {
  preHandler: async (request, reply) => {
    return authenticate(request, reply, {
      authService,
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key'
    });
  }
}, async (request, reply) => {
  const authReq = request as any;
  return {
    message: 'This is protected',
    user: authReq.user
  };
});

await fastify.listen({ port: 3000 });
```

### Express Adapter

```typescript
import express from 'express';
import { createInMemoryAuthService } from '@intentos/stdlib-auth';
import { registerAuthRoutes, authenticate, requireRole } from '@intentos/stdlib-auth/adapters/express';

const app = express();
app.use(express.json());

const authService = createInMemoryAuthService();

const authOptions = {
  authService,
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: '24h'
};

// Register auth routes
registerAuthRoutes(app, authOptions);

// Protected route
app.get('/api/protected', authenticate(authOptions), (req, res) => {
  const authReq = req as any;
  res.json({
    message: 'This is protected',
    user: authReq.user
  });
});

// Admin-only route
app.get('/api/admin', 
  authenticate(authOptions),
  requireRole('admin')(authOptions),
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);

app.listen(3000);
```

### Example Apps

See complete working examples:
- **Fastify**: `examples/fastify-app/server.ts`
- **Express**: `examples/express-app/server.ts`

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
│   ├── domain.isl              # Full auth domain specification
│   ├── user.isl                # User entity definition
│   ├── session.isl             # Session entity definition
│   └── behaviors/
│       ├── register.isl        # User registration behavior
│       ├── login.isl           # User login behavior
│       ├── logout.isl          # Session logout behavior
│       ├── authenticate.isl    # Login/logout/refresh behaviors
│       ├── authorize.isl       # RBAC/ABAC authorization
│       └── password-reset.isl  # Password reset flow
├── implementations/
│   └── typescript/
│       ├── index.ts            # Main AuthService exports
│       ├── user.ts             # User entity implementation
│       ├── session.ts          # Session entity implementation
│       └── types.ts            # Type definitions
├── adapters/
│   ├── fastify/
│   │   └── index.ts            # Fastify middleware & routes
│   └── express/
│       └── index.ts            # Express middleware & routes
├── examples/
│   ├── fastify-app/
│   │   ├── server.ts           # Sample Fastify app
│   │   ├── auth.isl            # ISL spec for app
│   │   └── package.json
│   └── express-app/
│       ├── server.ts           # Sample Express app
│       └── package.json
├── tests/
│   ├── auth.test.ts            # Contract compliance tests
│   └── adapters.test.ts        # Adapter tests
├── package.json
└── README.md
```

## Verification

To verify that your implementation satisfies the ISL contracts:

```bash
# Verify ISL specs
isl check intents/**/*.isl

# Verify implementation against specs
isl verify intents/behaviors/login.isl --impl implementations/typescript/index.ts

# Run tests
pnpm test
```

## ISL Behaviors

### Authentication Behaviors

- **Login**: Authenticate user with email/password, create session
- **Logout**: Revoke session(s)
- **RefreshToken**: Exchange refresh token for new access token
- **ValidateSession**: Check if session is valid and return user

### Authorization Behaviors

- **CheckPermission**: RBAC permission check
- **EvaluatePolicy**: ABAC policy evaluation
- **CheckRole**: Role membership check
- **RequirePermission**: Guard middleware for permission checks

### Token Invariants

All tokens must satisfy:
- Never stored in plaintext (hashed)
- Expired tokens cannot be valid
- Revoked tokens cannot be valid
- Access tokens have shorter lifetime than refresh tokens

## License

MIT
