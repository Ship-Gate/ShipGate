/**
 * Valid Authentication Implementation
 * 
 * This implementation satisfies the ISL postconditions:
 * - Session is created with user_id
 * - Session expires in the future
 * - Login count is incremented
 * - Rate limiting happens BEFORE body parsing
 * - Audit is recorded on all exit paths
 */

import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

// ============================================================================
// Types (would be generated from ISL)
// ============================================================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  login_count: number;
}

export interface Session {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: Date;
  expires_at: Date;
}

export interface AuthenticateInput {
  email: string;
  password: string;
}

export type AuthenticateResult =
  | { success: true; session: Session; user: User }
  | { success: false; error: 'INVALID_CREDENTIALS' | 'ACCOUNT_SUSPENDED' | 'RATE_LIMITED' };

// ============================================================================
// In-memory stores (for demo)
// ============================================================================

const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const rateLimitCounters = new Map<string, { count: number; resetAt: Date }>();

// Seed a test user
const testUserId = randomUUID();
users.set(testUserId, {
  id: testUserId,
  email: 'test@example.com',
  password_hash: bcrypt.hashSync('password123', 10),
  status: 'ACTIVE',
  login_count: 0,
});

// ============================================================================
// Audit Logger (satisfies @intent audit-required)
// ============================================================================

export interface AuditEntry {
  action: string;
  success: boolean;
  userId?: string;
  email?: string;
  timestamp: number;
  requestId: string;
  reason?: string;
}

const auditLog: AuditEntry[] = [];

function auditAttempt(entry: AuditEntry): void {
  auditLog.push(entry);
  // In production: send to audit service
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}

// ============================================================================
// Rate Limiter (satisfies @intent rate-limit-required)
// ============================================================================

function checkRateLimit(email: string): boolean {
  const key = email.toLowerCase();
  const now = new Date();
  const counter = rateLimitCounters.get(key);
  
  if (!counter || counter.resetAt < now) {
    rateLimitCounters.set(key, { count: 1, resetAt: new Date(now.getTime() + 60000) });
    return true; // Not rate limited
  }
  
  if (counter.count >= 5) {
    return false; // Rate limited
  }
  
  counter.count++;
  return true;
}

// ============================================================================
// Authenticate Implementation
// ============================================================================

export async function authenticate(
  input: AuthenticateInput,
  requestId: string = randomUUID()
): Promise<AuthenticateResult> {
  const { email, password } = input;
  
  // 1. Rate limit check BEFORE any processing (satisfies semantic rule)
  if (!checkRateLimit(email)) {
    auditAttempt({
      action: 'authenticate',
      success: false,
      email: '[REDACTED]', // @intent no-pii-logging
      timestamp: Date.now(),
      requestId,
      reason: 'rate_limited',
    });
    return { success: false, error: 'RATE_LIMITED' };
  }
  
  // 2. Find user by email
  const user = Array.from(users.values()).find(u => u.email === email);
  
  if (!user) {
    auditAttempt({
      action: 'authenticate',
      success: false,
      email: '[REDACTED]',
      timestamp: Date.now(),
      requestId,
      reason: 'user_not_found',
    });
    return { success: false, error: 'INVALID_CREDENTIALS' };
  }
  
  // 3. Check account status
  if (user.status === 'SUSPENDED') {
    auditAttempt({
      action: 'authenticate',
      success: false,
      userId: user.id,
      timestamp: Date.now(),
      requestId,
      reason: 'account_suspended',
    });
    return { success: false, error: 'ACCOUNT_SUSPENDED' };
  }
  
  // 4. Verify password
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  
  if (!passwordValid) {
    auditAttempt({
      action: 'authenticate',
      success: false,
      userId: user.id,
      timestamp: Date.now(),
      requestId,
      reason: 'invalid_password',
    });
    return { success: false, error: 'INVALID_CREDENTIALS' };
  }
  
  // 5. Create session - SATISFIES POSTCONDITION
  const sessionToken = randomUUID() + randomUUID(); // 72 chars
  const session: Session = {
    id: randomUUID(),
    user_id: user.id, // POSTCONDITION: result.session.user_id == result.user.id
    token_hash: bcrypt.hashSync(sessionToken, 10),
    created_at: new Date(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // POSTCONDITION: expires_at > now()
  };
  
  sessions.set(session.id, session);
  
  // 6. Increment login count - SATISFIES POSTCONDITION
  const oldLoginCount = user.login_count;
  user.login_count = oldLoginCount + 1; // POSTCONDITION: login_count > old(login_count)
  
  // 7. Audit success
  auditAttempt({
    action: 'authenticate',
    success: true,
    userId: user.id,
    timestamp: Date.now(),
    requestId,
  });
  
  return {
    success: true,
    session,
    user: { ...user }, // Return copy
  };
}

// ============================================================================
// GetUserProfile Implementation
// ============================================================================

export interface GetUserProfileInput {
  session_token: string;
}

export type GetUserProfileResult =
  | { success: true; user: User }
  | { success: false; error: 'INVALID_SESSION' };

export async function getUserProfile(
  input: GetUserProfileInput,
  requestId: string = randomUUID()
): Promise<GetUserProfileResult> {
  const { session_token } = input;
  
  // Find session by token
  const session = Array.from(sessions.values()).find(s => 
    bcrypt.compareSync(session_token, s.token_hash) && s.expires_at > new Date()
  );
  
  if (!session) {
    auditAttempt({
      action: 'get_user_profile',
      success: false,
      timestamp: Date.now(),
      requestId,
      reason: 'invalid_session',
    });
    return { success: false, error: 'INVALID_SESSION' };
  }
  
  const user = users.get(session.user_id);
  
  if (!user || user.status !== 'ACTIVE') {
    auditAttempt({
      action: 'get_user_profile',
      success: false,
      timestamp: Date.now(),
      requestId,
      reason: 'user_not_found_or_inactive',
    });
    return { success: false, error: 'INVALID_SESSION' };
  }
  
  auditAttempt({
    action: 'get_user_profile',
    success: true,
    userId: user.id,
    timestamp: Date.now(),
    requestId,
  });
  
  return {
    success: true,
    user: { ...user },
  };
}

// ============================================================================
// Helpers for testing
// ============================================================================

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function sessionExists(id: string): boolean {
  return sessions.has(id);
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function resetState(): void {
  sessions.clear();
  auditLog.length = 0;
  rateLimitCounters.clear();
  
  // Reset test user
  const user = users.get(testUserId);
  if (user) {
    user.login_count = 0;
    user.status = 'ACTIVE';
  }
}

export { testUserId };
