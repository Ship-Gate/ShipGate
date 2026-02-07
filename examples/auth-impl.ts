/**
 * Reference Implementation: UserAuthentication Domain
 *
 * Satisfies examples/auth.isl behavioral contracts.
 * Used by `isl verify examples/auth.isl --impl examples/auth-impl.ts`
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Types (derived from ISL spec)
// ============================================================================

export type Email = string;
export type Password = string;
export type UserId = string;
export type SessionId = string;

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING_VERIFICATION';

export interface User {
  id: UserId;
  email: Email;
  password_hash: string;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
  failed_attempts: number;
  locked_until: Date | null;
}

export interface Session {
  id: SessionId;
  user_id: UserId;
  created_at: Date;
  expires_at: Date;
  revoked: boolean;
  ip_address: string;
  user_agent: string | null;
}

// ============================================================================
// In-memory stores
// ============================================================================

const users = new Map<UserId, User>();
const usersByEmail = new Map<string, UserId>();
const sessions = new Map<SessionId, Session>();
const auditLog: Array<{ action: string; timestamp: number; userId?: string }> = [];

// ============================================================================
// Password hashing (constant-time compare for timing attack resistance)
// ============================================================================

function hashPassword(password: string): string {
  // Simplified bcrypt-like hash for demo; real impl uses bcrypt/argon2
  const { createHash, timingSafeEqual } = require('crypto');
  const salt = randomUUID().replace(/-/g, '');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `$hash$${salt}$${hash}`;
}

function verifyPassword(password: string, hash: string): boolean {
  const { createHash, timingSafeEqual } = require('crypto');
  const parts = hash.split('$');
  if (parts.length < 4) return false;
  const salt = parts[2];
  const stored = parts[3];
  const computed = createHash('sha256').update(salt + password).digest('hex');
  // Timing-safe comparison
  try {
    return timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

// ============================================================================
// Behavior: Login
// ============================================================================

export interface LoginInput {
  email: Email;
  password: Password;
  ip_address: string;
  user_agent?: string;
}

export type LoginResult =
  | { success: true; session: Session }
  | { success: false; error: 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'USER_LOCKED' | 'USER_INACTIVE' };

export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, password, ip_address, user_agent } = input;

  // Precondition: validate email format
  if (!email || !email.includes('@')) {
    return { success: false, error: 'INVALID_CREDENTIALS' };
  }

  // Precondition: password length >= 8
  if (!password || password.length < 8) {
    return { success: false, error: 'INVALID_CREDENTIALS' };
  }

  // Lookup user
  const userId = usersByEmail.get(email.toLowerCase());
  if (!userId) {
    return { success: false, error: 'USER_NOT_FOUND' };
  }

  const user = users.get(userId);
  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND' };
  }

  // Check status
  if (user.status === 'LOCKED') {
    return { success: false, error: 'USER_LOCKED' };
  }
  if (user.status === 'INACTIVE') {
    return { success: false, error: 'USER_INACTIVE' };
  }

  // Verify password (timing-safe)
  if (!verifyPassword(password, user.password_hash)) {
    // Postcondition: increment failed_attempts, may lock
    user.failed_attempts += 1;
    if (user.failed_attempts >= 10) {
      user.status = 'LOCKED';
      user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
    }
    user.updated_at = new Date();

    auditLog.push({ action: 'login_failed', timestamp: Date.now(), userId: user.id });
    return { success: false, error: 'INVALID_CREDENTIALS' };
  }

  // Postcondition: create session
  const session: Session = {
    id: randomUUID(),
    user_id: user.id,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    revoked: false,
    ip_address,
    user_agent: user_agent ?? null,
  };
  sessions.set(session.id, session);

  // Postcondition: reset failed_attempts, update last_login
  user.failed_attempts = 0;
  user.last_login = new Date();
  user.updated_at = new Date();

  auditLog.push({ action: 'login_success', timestamp: Date.now(), userId: user.id });

  return { success: true, session };
}

// ============================================================================
// Behavior: Logout
// ============================================================================

export interface LogoutInput {
  session_id: SessionId;
}

export type LogoutResult =
  | { success: true; value: boolean }
  | { success: false; error: 'SESSION_NOT_FOUND' | 'SESSION_ALREADY_REVOKED' };

export async function logout(input: LogoutInput): Promise<LogoutResult> {
  const session = sessions.get(input.session_id);

  if (!session) {
    return { success: false, error: 'SESSION_NOT_FOUND' };
  }

  if (session.revoked) {
    return { success: false, error: 'SESSION_ALREADY_REVOKED' };
  }

  // Postcondition: session.revoked == true
  session.revoked = true;

  auditLog.push({ action: 'logout', timestamp: Date.now(), userId: session.user_id });

  return { success: true, value: true };
}

// ============================================================================
// Behavior: Register
// ============================================================================

export interface RegisterInput {
  email: Email;
  password: Password;
  confirm_password: Password;
}

export type RegisterResult =
  | { success: true; user: User }
  | { success: false; error: 'EMAIL_ALREADY_EXISTS' | 'PASSWORDS_DO_NOT_MATCH' | 'PASSWORD_TOO_WEAK' };

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const { email, password, confirm_password } = input;

  // Precondition checks
  if (!email || !email.includes('@')) {
    return { success: false, error: 'PASSWORD_TOO_WEAK' };
  }
  if (password.length < 8) {
    return { success: false, error: 'PASSWORD_TOO_WEAK' };
  }
  if (password !== confirm_password) {
    return { success: false, error: 'PASSWORDS_DO_NOT_MATCH' };
  }
  if (usersByEmail.has(email.toLowerCase())) {
    return { success: false, error: 'EMAIL_ALREADY_EXISTS' };
  }

  // Postcondition: create user with PENDING_VERIFICATION status
  const user: User = {
    id: randomUUID(),
    email,
    password_hash: hashPassword(password),
    status: 'PENDING_VERIFICATION',
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null,
    failed_attempts: 0,
    locked_until: null,
  };

  users.set(user.id, user);
  usersByEmail.set(email.toLowerCase(), user.id);

  // Postcondition: password_hash != input.password
  // (guaranteed by hashPassword)

  auditLog.push({ action: 'register', timestamp: Date.now(), userId: user.id });

  return { success: true, user };
}

// ============================================================================
// Behavior: ResetPassword
// ============================================================================

const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

export interface ResetPasswordInput {
  token: string;
  new_password: Password;
  confirm_password: Password;
}

export type ResetPasswordResult =
  | { success: true; value: boolean }
  | { success: false; error: 'INVALID_TOKEN' | 'PASSWORDS_DO_NOT_MATCH' | 'PASSWORD_TOO_WEAK' };

export async function resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
  const { token, new_password, confirm_password } = input;

  if (new_password.length < 8) {
    return { success: false, error: 'PASSWORD_TOO_WEAK' };
  }
  if (new_password !== confirm_password) {
    return { success: false, error: 'PASSWORDS_DO_NOT_MATCH' };
  }

  const tokenData = resetTokens.get(token);
  if (!tokenData || tokenData.expiresAt < new Date()) {
    return { success: false, error: 'INVALID_TOKEN' };
  }

  const user = users.get(tokenData.userId);
  if (!user) {
    return { success: false, error: 'INVALID_TOKEN' };
  }

  // Postcondition: password hash changes, token invalidated, sessions revoked
  user.password_hash = hashPassword(new_password);
  user.updated_at = new Date();
  resetTokens.delete(token);

  // Revoke all sessions for this user
  for (const [id, session] of sessions) {
    if (session.user_id === user.id) {
      session.revoked = true;
    }
  }

  auditLog.push({ action: 'reset_password', timestamp: Date.now(), userId: user.id });

  return { success: true, value: true };
}

// ============================================================================
// Behavior: ValidateSession
// ============================================================================

export interface ValidateSessionInput {
  session_id: SessionId;
}

export type ValidateSessionResult =
  | { success: true; user: User }
  | { success: false; error: 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'SESSION_REVOKED' | 'USER_INACTIVE' };

export async function validateSession(input: ValidateSessionInput): Promise<ValidateSessionResult> {
  const session = sessions.get(input.session_id);

  if (!session) {
    return { success: false, error: 'SESSION_NOT_FOUND' };
  }
  if (session.revoked) {
    return { success: false, error: 'SESSION_REVOKED' };
  }
  if (session.expires_at <= new Date()) {
    return { success: false, error: 'SESSION_EXPIRED' };
  }

  const user = users.get(session.user_id);
  if (!user || user.status !== 'ACTIVE') {
    return { success: false, error: 'USER_INACTIVE' };
  }

  return { success: true, user: { ...user } };
}

// ============================================================================
// Test helpers
// ============================================================================

export function seedTestUser(email: string, password: string): User {
  const user: User = {
    id: randomUUID(),
    email,
    password_hash: hashPassword(password),
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date(),
    last_login: null,
    failed_attempts: 0,
    locked_until: null,
  };
  users.set(user.id, user);
  usersByEmail.set(email.toLowerCase(), user.id);
  return user;
}

export function createResetToken(userId: string): string {
  const token = randomUUID();
  resetTokens.set(token, { userId, expiresAt: new Date(Date.now() + 3600000) });
  return token;
}

export function getAuditLog() { return [...auditLog]; }
export function getSessionById(id: string) { return sessions.get(id); }

export function resetState(): void {
  users.clear();
  usersByEmail.clear();
  sessions.clear();
  resetTokens.clear();
  auditLog.length = 0;
}
