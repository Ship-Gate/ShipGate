/**
 * Authentication Implementation
 * 
 * Reference implementation for mutation testing.
 */

import { randomUUID } from 'node:crypto';

// Rate limiting check - target for bypass-precondition mutation
function checkRateLimit(email: string): boolean {
  return !isRateLimited(email);
}

// Password validation - target for remove-assert mutation
function validatePassword(password: string): void {
  assert(password.length >= 8, 'Password must be at least 8 characters');
  assert(/[A-Z]/.test(password), 'Password must contain uppercase');
  assert(/[0-9]/.test(password), 'Password must contain a number');
}

// Mock user store
const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const requestCounts = new Map<string, number>();

interface User {
  id: string;
  email: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: Date | null;
}

interface Session {
  id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

// Lockout check - target for change-comparator mutation
function isLockedOut(user: User): boolean {
  return user.failed_attempts > 4;
}

// Rate limit check
function isRateLimited(email: string): boolean {
  const count = requestCounts.get(email) ?? 0;
  return count > 10;
}

export function login(email: string, password: string): Session {
  // Check rate limiting
  if (!checkRateLimit(email)) {
    throw new AuthError('RATE_LIMITED', 'Too many requests');
  }
  
  // Track request
  requestCounts.set(email, (requestCounts.get(email) ?? 0) + 1);
  
  // Validate password format
  validatePassword(password);
  
  // Find user
  const user = findUserByEmail(email);
  if (!user) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }
  
  // Check lockout
  if (isLockedOut(user)) {
    throw new AuthError('USER_LOCKED', 'Account is locked');
  }
  
  // Verify password (simulated)
  if (!verifyPassword(password, user.password_hash)) {
    user.failed_attempts++;
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }
  
  // Reset failed attempts on success
  user.failed_attempts = 0;
  
  // Create session
  const session: Session = {
    id: randomUUID(),
    user_id: user.id,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 3600000), // 1 hour
  };
  
  sessions.set(session.id, session);
  
  return session;
}

// Helper functions
function findUserByEmail(email: string): User | undefined {
  for (const user of users.values()) {
    if (user.email === email) {
      return user;
    }
  }
  // Create mock user for testing
  const mockUser: User = {
    id: randomUUID(),
    email,
    password_hash: 'hashed_Password123',
    failed_attempts: 0,
    locked_until: null,
  };
  users.set(mockUser.id, mockUser);
  return mockUser;
}

function verifyPassword(password: string, hash: string): boolean {
  // Simplified verification for testing
  return hash.includes(password.slice(0, 8));
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new AuthError('INVALID_CREDENTIALS', message);
  }
}

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Test helpers
export function resetState(): void {
  users.clear();
  sessions.clear();
  requestCounts.clear();
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}
