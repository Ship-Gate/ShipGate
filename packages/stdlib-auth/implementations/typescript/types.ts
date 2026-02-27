// ============================================================================
// Authentication Types
// Generated from ISL specifications
// ============================================================================

// ============================================================================
// Enums
// ============================================================================

export enum UserStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  LOCKED = 'LOCKED',
  SUSPENDED = 'SUSPENDED',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  SUPERSEDED = 'SUPERSEDED',
}

export enum RevocationReason {
  USER_LOGOUT = 'USER_LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  SECURITY_CONCERN = 'SECURITY_CONCERN',
  ADMIN_ACTION = 'ADMIN_ACTION',
  SESSION_LIMIT = 'SESSION_LIMIT',
  EXPIRED = 'EXPIRED',
}

// ============================================================================
// Core Types
// ============================================================================

export type UserId = string;
export type SessionId = string;
export type Email = string;
export type IpAddress = string;

// ============================================================================
// Entity Interfaces
// ============================================================================

export interface User {
  id: UserId;
  email: Email;
  passwordHash: string;
  status: UserStatus;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
  emailVerifiedAt: Date | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Session {
  id: SessionId;
  token: string;
  tokenHash: string;
  userId: UserId;
  status: SessionStatus;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  revokedAt: Date | null;
  revocationReason: RevocationReason | null;
  ipAddress: IpAddress;
  userAgent: string | null;
  deviceFingerprint: string | null;
  countryCode: string | null;
  city: string | null;
}

export interface PasswordResetToken {
  id: string;
  userId: UserId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  ipAddress: IpAddress;
}

// ============================================================================
// Input Types
// ============================================================================

export interface RegisterInput {
  email: Email;
  password: string;
  confirmPassword: string;
  displayName?: string;
  acceptTerms: boolean;
  ipAddress: IpAddress;
  userAgent?: string;
}

export interface LoginInput {
  email: Email;
  password: string;
  ipAddress: IpAddress;
  userAgent?: string;
  rememberMe?: boolean;
  deviceFingerprint?: string;
}

export interface LogoutInput {
  sessionId: SessionId;
  revokeAll?: boolean;
  reason?: RevocationReason;
}

export interface RequestPasswordResetInput {
  email: Email;
  ipAddress: IpAddress;
  userAgent?: string;
}

export interface PasswordResetInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
  ipAddress: IpAddress;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  revokeOtherSessions?: boolean;
}

export interface ValidateSessionInput {
  sessionToken: string;
}

// ============================================================================
// Output Types
// ============================================================================

export interface RegisterOutput {
  user: Pick<User, 'id' | 'email' | 'status' | 'createdAt'>;
}

export interface LoginOutput {
  session: Session;
  user: Pick<User, 'id' | 'email' | 'displayName' | 'roles'>;
  token: string;
  expiresAt: Date;
}

export interface LogoutOutput {
  revokedCount: number;
  message: string;
}

export interface RequestPasswordResetOutput {
  message: string;
}

export interface PasswordResetOutput {
  message: string;
  sessionsRevoked: number;
}

export interface ChangePasswordOutput {
  message: string;
  sessionsRevoked: number;
}

export interface ValidateSessionOutput {
  user: Pick<User, 'id' | 'email' | 'displayName' | 'roles' | 'status'>;
  session: Pick<Session, 'id' | 'expiresAt' | 'lastActivityAt'>;
}

// ============================================================================
// Error Types
// ============================================================================

export enum AuthErrorCode {
  // Register errors
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  PASSWORDS_DO_NOT_MATCH = 'PASSWORDS_DO_NOT_MATCH',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  INVALID_EMAIL = 'INVALID_EMAIL',
  TERMS_NOT_ACCEPTED = 'TERMS_NOT_ACCEPTED',
  REGISTRATION_DISABLED = 'REGISTRATION_DISABLED',

  // Login errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_LOCKED = 'USER_LOCKED',
  USER_INACTIVE = 'USER_INACTIVE',
  USER_SUSPENDED = 'USER_SUSPENDED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  SESSION_LIMIT_EXCEEDED = 'SESSION_LIMIT_EXCEEDED',

  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_ALREADY_REVOKED = 'SESSION_ALREADY_REVOKED',

  // Password reset errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  PASSWORD_SAME_AS_OLD = 'PASSWORD_SAME_AS_OLD',
  INVALID_CURRENT_PASSWORD = 'INVALID_CURRENT_PASSWORD',

  // General errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  retriable: boolean;
  retryAfter?: number; // seconds
  httpStatus: number;
  details?: Record<string, unknown>;
}

export class AuthException extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly retriable: boolean = false,
    public readonly httpStatus: number = 400,
    public readonly retryAfter?: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthException';
  }

  toError(): AuthError {
    return {
      code: this.code,
      message: this.message,
      retriable: this.retriable,
      retryAfter: this.retryAfter,
      httpStatus: this.httpStatus,
      details: this.details,
    };
  }
}

// ============================================================================
// Result Type
// ============================================================================

export type Result<T, E = AuthError> =
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<E = AuthError>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================================================
// Configuration
// ============================================================================

export interface AuthConfig {
  // Password hashing
  hashRounds: number;
  hashAlgorithm: 'bcrypt' | 'argon2';

  // Session settings
  sessionDuration: number; // milliseconds
  extendedSessionDuration: number; // for remember_me
  maxConcurrentSessions: number;

  // Security settings
  maxFailedAttempts: number;
  lockoutDuration: number; // milliseconds
  progressiveLockout: boolean;

  // Token settings
  resetTokenExpiry: number; // milliseconds
  tokenLength: number;

  // Rate limiting
  loginRateLimit: { count: number; windowMs: number };
  registerRateLimit: { count: number; windowMs: number };
  resetRateLimit: { count: number; windowMs: number };
}

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  hashRounds: 12,
  hashAlgorithm: 'bcrypt',
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  extendedSessionDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxConcurrentSessions: 10,
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  progressiveLockout: true,
  resetTokenExpiry: 60 * 60 * 1000, // 1 hour
  tokenLength: 64,
  loginRateLimit: { count: 100, windowMs: 60 * 60 * 1000 },
  registerRateLimit: { count: 3, windowMs: 60 * 60 * 1000 },
  resetRateLimit: { count: 5, windowMs: 60 * 60 * 1000 },
};

// ============================================================================
// Repository Interfaces
// ============================================================================

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  create(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: UserId, data: Partial<User>): Promise<User>;
  delete(id: UserId): Promise<void>;
  existsByEmail(email: Email): Promise<boolean>;
}

export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  findActiveByUserId(userId: UserId): Promise<Session[]>;
  create(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session>;
  update(id: SessionId, data: Partial<Session>): Promise<Session>;
  revokeAllForUser(
    userId: UserId,
    reason: RevocationReason,
    exceptSessionId?: SessionId
  ): Promise<number>;
  countActiveForUser(userId: UserId): Promise<number>;
  deleteExpired(): Promise<number>;
}

export interface PasswordResetTokenRepository {
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  create(token: Omit<PasswordResetToken, 'id' | 'createdAt'>): Promise<PasswordResetToken>;
  markUsed(id: string): Promise<void>;
  invalidateForUser(userId: UserId): Promise<void>;
  deleteExpired(): Promise<number>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface AuthEvent {
  type: string;
  timestamp: Date;
  userId?: UserId;
  sessionId?: SessionId;
  ipAddress?: IpAddress;
  metadata?: Record<string, unknown>;
}

export interface UserRegisteredEvent extends AuthEvent {
  type: 'UserRegistered';
  userId: UserId;
  email: Email;
}

export interface UserLoggedInEvent extends AuthEvent {
  type: 'UserLoggedIn';
  userId: UserId;
  sessionId: SessionId;
}

export interface UserLoggedOutEvent extends AuthEvent {
  type: 'UserLoggedOut';
  userId: UserId;
  sessionId: SessionId;
  reason: RevocationReason;
}

export interface PasswordResetRequestedEvent extends AuthEvent {
  type: 'PasswordResetRequested';
  userId: UserId;
}

export interface PasswordResetCompletedEvent extends AuthEvent {
  type: 'PasswordResetCompleted';
  userId: UserId;
  sessionsRevoked: number;
}

export interface PasswordChangedEvent extends AuthEvent {
  type: 'PasswordChanged';
  userId: UserId;
  sessionsRevoked: number;
}

export interface AccountLockedEvent extends AuthEvent {
  type: 'AccountLocked';
  userId: UserId;
  failedAttempts: number;
  lockedUntil: Date | null;
}

export interface InvalidLoginAttemptEvent extends AuthEvent {
  type: 'InvalidLoginAttempt';
  email: Email;
  reason: 'INVALID_CREDENTIALS' | 'USER_LOCKED' | 'USER_INACTIVE';
}

export type AuthEventTypes =
  | UserRegisteredEvent
  | UserLoggedInEvent
  | UserLoggedOutEvent
  | PasswordResetRequestedEvent
  | PasswordResetCompletedEvent
  | PasswordChangedEvent
  | AccountLockedEvent
  | InvalidLoginAttemptEvent;

export interface EventEmitter {
  emit(event: AuthEventTypes): Promise<void>;
}
