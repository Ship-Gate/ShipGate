# Tutorial 3: Authentication

**Time:** ~60 minutes  
**Goal:** Implement secure authentication flows with IntentOS specifications, including registration, login, session management, and password security.

## Overview

In this tutorial, you'll:
1. Create authentication domain specification
2. Implement secure password hashing and session management
3. Verify authentication flows match security requirements
4. Test authentication with various scenarios

## Prerequisites

- Completed [Hello World tutorial](./01-hello-world.md)
- Basic understanding of authentication concepts
- Node.js 18+ installed

## Step 1: Create Project

```bash
mkdir auth-tutorial
cd auth-tutorial
shipgate init --template minimal
```

## Step 2: Install Dependencies

```bash
npm init -y
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken typescript ts-node
```

## Step 3: Create Authentication Specification

Create `specs/auth.isl`:

```isl
domain Auth {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    passwordHash: String [sensitive, immutable]
    createdAt: DateTime [immutable]
    lastLoginAt: DateTime
  }

  entity Session {
    id: UUID [immutable, unique]
    userId: UUID [immutable]
    token: String [sensitive]
    expiresAt: DateTime
    createdAt: DateTime [immutable]
  }

  behavior Register {
    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
        }
        WEAK_PASSWORD {
          when: "Password does not meet security requirements"
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 8
      password.matches(/[A-Z]/)
      password.matches(/[a-z]/)
      password.matches(/[0-9]/)
      not User.exists(email)
    }

    post success {
      result.email == input.email
      result.passwordHash != input.password
      result.passwordHash.length > 0
      result.id != null
    }

    invariants {
      password never_logged
      passwordHash never_logged
    }
  }

  behavior Login {
    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        USER_LOCKED {
          when: "User account is locked"
        }
      }
    }

    pre {
      email.is_valid
      password.length > 0
    }

    post success {
      result.userId != null
      result.token != null
      result.expiresAt > now()
      User.lastLoginAt == now()
    }

    invariants {
      password never_logged
    }
  }

  behavior ValidateSession {
    input {
      token: String [sensitive]
    }

    output {
      success: Session
      errors {
        INVALID_TOKEN {
          when: "Token is invalid or expired"
        }
      }
    }

    pre {
      token.length > 0
    }

    post success {
      result.expiresAt > now()
      Session.exists(result.id)
    }
  }

  behavior Logout {
    input {
      token: String [sensitive]
    }

    output {
      success: Boolean
      errors {
        INVALID_TOKEN {
          when: "Token is invalid"
        }
      }
    }

    pre {
      token.length > 0
    }

    post success {
      not Session.exists(input.token)
    }
  }
}
```

**Security requirements:**
- Passwords must be hashed (never stored in plain text)
- Passwords never logged
- Sessions expire after a set time
- Tokens are sensitive and never logged

## Step 4: Validate Specification

```bash
shipgate check specs/auth.isl
```

**Expected output:**
```
✓ Parsed specs/auth.isl
✓ Type check passed
✓ Security invariants validated
✓ No errors found
```

## Step 5: Implement Authentication Service

Create `src/auth.ts`:

```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const users: Map<string, User> = new Map();
const sessions: Map<string, Session> = new Map();

// Helper functions
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function userExists(email: string): boolean {
  return Array.from(users.values()).some(u => u.email === email);
}

function getUserByEmail(email: string): User | undefined {
  return Array.from(users.values()).find(u => u.email === email);
}

// Register behavior
export async function register(email: string, password: string): Promise<User> {
  // Preconditions
  if (!isValidEmail(email)) {
    throw new Error('INVALID_EMAIL');
  }
  if (!isStrongPassword(password)) {
    throw new Error('WEAK_PASSWORD');
  }
  if (userExists(email)) {
    throw new Error('EMAIL_EXISTS');
  }

  // Hash password (never store plain text)
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const now = new Date();
  const user: User = {
    id: uuidv4(),
    email,
    passwordHash,
    createdAt: now,
  };

  users.set(user.id, user);

  // Postconditions satisfied:
  // - result.email == input.email ✓
  // - result.passwordHash != input.password ✓
  // - result.passwordHash.length > 0 ✓
  // - result.id != null ✓

  return user;
}

// Login behavior
export async function login(email: string, password: string): Promise<Session> {
  // Preconditions
  if (!isValidEmail(email)) {
    throw new Error('INVALID_CREDENTIALS');
  }
  if (!password || password.length === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Find user
  const user = getUserByEmail(email);
  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Create session token
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Create session
  const now = new Date();
  const session: Session = {
    id: uuidv4(),
    userId: user.id,
    token,
    expiresAt,
    createdAt: now,
  };

  sessions.set(token, session);

  // Update user last login
  user.lastLoginAt = now;
  users.set(user.id, user);

  // Postconditions satisfied:
  // - result.userId != null ✓
  // - result.token != null ✓
  // - result.expiresAt > now() ✓
  // - User.lastLoginAt == now() ✓

  return session;
}

// ValidateSession behavior
export function validateSession(token: string): Session {
  // Preconditions
  if (!token || token.length === 0) {
    throw new Error('INVALID_TOKEN');
  }

  // Find session
  const session = sessions.get(token);
  if (!session) {
    throw new Error('INVALID_TOKEN');
  }

  // Verify token signature
  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    sessions.delete(token);
    throw new Error('INVALID_TOKEN');
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    sessions.delete(token);
    throw new Error('INVALID_TOKEN');
  }

  // Postconditions satisfied:
  // - result.expiresAt > now() ✓
  // - Session.exists(result.id) ✓

  return session;
}

// Logout behavior
export function logout(token: string): boolean {
  // Preconditions
  if (!token || token.length === 0) {
    throw new Error('INVALID_TOKEN');
  }

  // Remove session
  const deleted = sessions.delete(token);

  if (!deleted) {
    throw new Error('INVALID_TOKEN');
  }

  // Postconditions satisfied:
  // - not Session.exists(input.token) ✓

  return true;
}
```

## Step 6: Verify Implementation

```bash
shipgate verify specs/auth.isl --impl src/auth.ts
```

**Expected output:**
```
Running verification...

Register:
  Preconditions:
    ✓ email.is_valid
    ✓ password.length >= 8
    ✓ password.matches(/[A-Z]/)
    ✓ password.matches(/[a-z]/)
    ✓ password.matches(/[0-9]/)
    ✓ not User.exists(email)
  Postconditions:
    ✓ result.email == input.email
    ✓ result.passwordHash != input.password
    ✓ result.passwordHash.length > 0
    ✓ result.id != null
  Security:
    ✓ password never_logged
    ✓ passwordHash never_logged

Login:
  Preconditions:
    ✓ email.is_valid
    ✓ password.length > 0
  Postconditions:
    ✓ result.userId != null
    ✓ result.token != null
    ✓ result.expiresAt > now()
    ✓ User.lastLoginAt == now()
  Security:
    ✓ password never_logged

ValidateSession:
  Preconditions:
    ✓ token.length > 0
  Postconditions:
    ✓ result.expiresAt > now()
    ✓ Session.exists(result.id)

Logout:
  Preconditions:
    ✓ token.length > 0
  Postconditions:
    ✓ not Session.exists(input.token)

Verdict: SHIP ✓  Trust Score: 98/100
```

## Step 7: Run the Gate

```bash
shipgate gate specs/auth.isl --impl src/auth.ts --threshold 90
```

**Expected output:**
```
Decision: SHIP ✓
Trust Score: 98/100
Security checks: PASSED
```

## Step 8: Create Tests

Create `src/auth.test.ts`:

```typescript
import { register, login, validateSession, logout } from './auth';

describe('Authentication', () => {
  beforeEach(() => {
    // Clear state between tests
  });

  describe('Register', () => {
    it('should register a new user', async () => {
      const user = await register('alice@example.com', 'SecurePass123');
      expect(user.email).toBe('alice@example.com');
      expect(user.passwordHash).not.toBe('SecurePass123');
      expect(user.id).toBeDefined();
    });

    it('should reject weak passwords', async () => {
      await expect(register('test@example.com', 'weak')).rejects.toThrow('WEAK_PASSWORD');
    });

    it('should reject duplicate emails', async () => {
      await register('duplicate@example.com', 'SecurePass123');
      await expect(register('duplicate@example.com', 'AnotherPass123')).rejects.toThrow('EMAIL_EXISTS');
    });
  });

  describe('Login', () => {
    it('should login with correct credentials', async () => {
      await register('login@example.com', 'SecurePass123');
      const session = await login('login@example.com', 'SecurePass123');
      expect(session.token).toBeDefined();
      expect(session.userId).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      await register('test@example.com', 'SecurePass123');
      await expect(login('test@example.com', 'WrongPassword')).rejects.toThrow('INVALID_CREDENTIALS');
    });
  });

  describe('Session Management', () => {
    it('should validate valid session', async () => {
      await register('session@example.com', 'SecurePass123');
      const session = await login('session@example.com', 'SecurePass123');
      const validated = validateSession(session.token);
      expect(validated.id).toBe(session.id);
    });

    it('should logout and invalidate session', async () => {
      await register('logout@example.com', 'SecurePass123');
      const session = await login('logout@example.com', 'SecurePass123');
      const result = logout(session.token);
      expect(result).toBe(true);
      expect(() => validateSession(session.token)).toThrow('INVALID_TOKEN');
    });
  });
});
```

## Step 9: Run Tests

```bash
npm test
```

## Troubleshooting

### Error: "Cannot find module 'bcryptjs'"

**Solution:** Install dependencies:
```bash
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken
```

### Verification fails on password security

**Solution:** Ensure:
- Passwords are hashed with bcrypt
- Plain passwords are never stored
- Password validation matches spec requirements

### Session validation fails

**Solution:** Check:
- Token expiration is set correctly
- JWT secret is configured
- Sessions are stored and retrieved correctly

### Security invariants fail

**Solution:** Ensure:
- No `console.log` statements log passwords
- Password hashes are never logged
- Sensitive data is marked correctly

## Next Steps

- ✅ You've implemented secure authentication
- ✅ You've verified security requirements
- ✅ You've tested authentication flows

**Continue to:** [Tutorial 4: Property-Based Testing](./04-property-based-testing.md) to find edge cases automatically.

## Summary

In this tutorial, you learned:
- How to specify authentication behaviors with security requirements
- How to implement secure password hashing
- How to manage sessions and tokens
- How to verify security invariants

Key concepts:
- **Security invariants** ensure sensitive data is never logged
- **Preconditions** validate input security requirements
- **Postconditions** ensure correct security state
- **Sensitive fields** are tracked and protected
