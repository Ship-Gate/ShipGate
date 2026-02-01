// ============================================================================
// Test Fixture: Implementation with @isl-bindings
// ============================================================================

/**
 * @isl-bindings
 * @spec auth/create-user.isl
 *
 * CreateUser.pre.emailValid -> guard:validateEmail [Email format validation]
 * CreateUser.pre.emailUnique -> guard:checkEmailUnique [Uniqueness check]
 * CreateUser.post.userCreated -> assert:L45-L48 [User creation assertion]
 * CreateUser.post.passwordHashed -> test:createUserTest [Password hash test]
 * CreateUser.inv.auditLog -> assert:logAuditEvent [Audit logging]
 */

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const users: Map<string, User> = new Map();

// Guard: Email format validation
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  return true;
}

// Guard: Email uniqueness check
function checkEmailUnique(email: string): boolean {
  for (const user of users.values()) {
    if (user.email === email) {
      throw new Error('Email already exists');
    }
  }
  return true;
}

// Assert: User creation
export async function createUser(email: string, password: string): Promise<User> {
  validateEmail(email);
  checkEmailUnique(email);

  const user: User = {
    id: crypto.randomUUID(),
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
  };

  // L45-L48: User creation assertion
  users.set(user.id, user);
  const createdUser = users.get(user.id);
  if (!createdUser) {
    throw new Error('Failed to create user');
  }

  logAuditEvent('user_created', { userId: user.id });

  return user;
}

// Password hashing
async function hashPassword(password: string): Promise<string> {
  // Simulated hash
  return `hashed_${password}_${Date.now()}`;
}

// Audit logging assertion
function logAuditEvent(event: string, data: Record<string, unknown>): void {
  // Assert: audit event logged
  if (!event || typeof event !== 'string') {
    throw new Error('Invalid audit event');
  }
  // In real implementation, this would log to audit system
}

// Test: Password hashing
export function createUserTest(): void {
  // Test that password is hashed
  const testEmail = 'test@example.com';
  const testPassword = 'password123';
  
  createUser(testEmail, testPassword).then(user => {
    if (!user.passwordHash.startsWith('hashed_')) {
      throw new Error('Password not properly hashed');
    }
  });
}
