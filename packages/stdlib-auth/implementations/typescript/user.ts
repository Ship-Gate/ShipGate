// ============================================================================
// User Entity Implementation
// Satisfies: intents/user.isl
// ============================================================================

import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  UserId,
  Email,
  UserStatus,
  UserRole,
  UserRepository,
  AuthConfig,
  DEFAULT_AUTH_CONFIG,
  AuthException,
  AuthErrorCode,
} from './types.js';

// ============================================================================
// Password Utilities
// ============================================================================

export async function hashPassword(
  password: string,
  rounds: number = DEFAULT_AUTH_CONFIG.hashRounds
): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  // Constant-time comparison via bcrypt
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (password.length < 8) {
    missing.push('min_length');
  }
  if (password.length > 128) {
    missing.push('max_length');
  }
  if (!/[a-z]/.test(password)) {
    missing.push('lowercase');
  }
  if (!/[A-Z]/.test(password)) {
    missing.push('uppercase');
  }
  if (!/[0-9]/.test(password)) {
    missing.push('digit');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// ============================================================================
// Email Validation
// ============================================================================

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string): boolean {
  if (!email || email.length > 254) {
    return false;
  }
  return EMAIL_REGEX.test(email);
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ============================================================================
// User Factory
// ============================================================================

export function createUser(params: {
  email: Email;
  passwordHash: string;
  displayName?: string;
  roles?: UserRole[];
}): User {
  const now = new Date();
  
  return {
    id: uuidv4(),
    email: normalizeEmail(params.email),
    passwordHash: params.passwordHash,
    status: UserStatus.PENDING_VERIFICATION,
    roles: params.roles ?? [UserRole.USER],
    createdAt: now,
    updatedAt: now,
    lastLogin: null,
    emailVerifiedAt: null,
    failedAttempts: 0,
    lockedUntil: null,
    passwordChangedAt: null,
    displayName: params.displayName ?? null,
    avatarUrl: null,
  };
}

// ============================================================================
// User Commands
// ============================================================================

export function incrementFailedAttempts(
  user: User,
  config: AuthConfig = DEFAULT_AUTH_CONFIG
): User {
  const newFailedAttempts = user.failedAttempts + 1;
  const shouldLock = newFailedAttempts >= config.maxFailedAttempts;

  let lockoutDuration = config.lockoutDuration;
  if (config.progressiveLockout) {
    // Progressive lockout: 15m, 1h, 24h
    const lockoutMultiplier = Math.min(
      Math.floor(newFailedAttempts / config.maxFailedAttempts),
      3
    );
    lockoutDuration = config.lockoutDuration * Math.pow(4, lockoutMultiplier - 1);
  }

  return {
    ...user,
    failedAttempts: newFailedAttempts,
    status: shouldLock ? UserStatus.LOCKED : user.status,
    lockedUntil: shouldLock ? new Date(Date.now() + lockoutDuration) : user.lockedUntil,
    updatedAt: new Date(),
  };
}

export function resetFailedAttempts(user: User): User {
  return {
    ...user,
    failedAttempts: 0,
    lockedUntil: null,
    status: user.status === UserStatus.LOCKED ? UserStatus.ACTIVE : user.status,
    updatedAt: new Date(),
  };
}

export function updateLastLogin(user: User): User {
  return {
    ...user,
    lastLogin: new Date(),
    updatedAt: new Date(),
  };
}

export function verifyUserEmail(user: User): User {
  if (user.status !== UserStatus.PENDING_VERIFICATION) {
    throw new AuthException(
      AuthErrorCode.INVALID_EMAIL,
      'User is not pending verification',
      false,
      400
    );
  }

  return {
    ...user,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    updatedAt: new Date(),
  };
}

export function lockUser(user: User, duration?: number): User {
  return {
    ...user,
    status: UserStatus.LOCKED,
    lockedUntil: duration ? new Date(Date.now() + duration) : null,
    updatedAt: new Date(),
  };
}

export function unlockUser(user: User): User {
  return {
    ...user,
    status: UserStatus.ACTIVE,
    lockedUntil: null,
    failedAttempts: 0,
    updatedAt: new Date(),
  };
}

export function updatePassword(user: User, newPasswordHash: string): User {
  return {
    ...user,
    passwordHash: newPasswordHash,
    passwordChangedAt: new Date(),
    updatedAt: new Date(),
    // Reset lock status on password change
    status: user.status === UserStatus.LOCKED ? UserStatus.ACTIVE : user.status,
    failedAttempts: 0,
    lockedUntil: null,
  };
}

// ============================================================================
// User Computed Properties
// ============================================================================

export function isUserLocked(user: User): boolean {
  if (user.status !== UserStatus.LOCKED) {
    return false;
  }
  
  // If lockedUntil is null, it's indefinitely locked
  if (user.lockedUntil === null) {
    return true;
  }
  
  // Check if lock has expired
  return user.lockedUntil > new Date();
}

export function canUserLogin(user: User): boolean {
  return user.status === UserStatus.ACTIVE && !isUserLocked(user);
}

export function isUserVerified(user: User): boolean {
  return user.emailVerifiedAt !== null;
}

export function getDaysSincePasswordChange(user: User): number | null {
  if (!user.passwordChangedAt) {
    return null;
  }
  
  const diffMs = Date.now() - user.passwordChangedAt.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

// ============================================================================
// User Validation
// ============================================================================

export function validateUserInvariants(user: User): void {
  // ID constraints
  if (!user.id) {
    throw new Error('User ID is required');
  }

  // Email constraints
  if (!validateEmail(user.email)) {
    throw new Error('Invalid email format');
  }

  // Failed attempts constraints
  if (user.failedAttempts < 0 || user.failedAttempts > 10) {
    throw new Error('Failed attempts must be between 0 and 10');
  }

  // Status-lock relationship
  if (user.lockedUntil !== null && user.status !== UserStatus.LOCKED) {
    throw new Error('User with lockedUntil must have LOCKED status');
  }

  // Verification constraints
  if (
    user.status === UserStatus.ACTIVE &&
    user.emailVerifiedAt === null
  ) {
    throw new Error('Active user must have verified email');
  }

  // Timestamp constraints
  if (user.createdAt > user.updatedAt) {
    throw new Error('createdAt must be before or equal to updatedAt');
  }

  if (user.lastLogin && user.lastLogin < user.createdAt) {
    throw new Error('lastLogin must be after createdAt');
  }

  // Role constraints
  if (user.roles.length < 1) {
    throw new Error('User must have at least one role');
  }
}

// ============================================================================
// In-Memory User Repository (for testing/reference)
// ============================================================================

export class InMemoryUserRepository implements UserRepository {
  private users: Map<UserId, User> = new Map();
  private emailIndex: Map<Email, UserId> = new Map();

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const normalizedEmail = normalizeEmail(email);
    const userId = this.emailIndex.get(normalizedEmail);
    if (!userId) return null;
    return this.users.get(userId) ?? null;
  }

  async create(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<User> {
    const normalizedEmail = normalizeEmail(userData.email);
    
    if (this.emailIndex.has(normalizedEmail)) {
      throw new AuthException(
        AuthErrorCode.EMAIL_ALREADY_EXISTS,
        'A user with this email already exists',
        false,
        409
      );
    }

    const now = new Date();
    const user: User = {
      ...userData,
      id: uuidv4(),
      email: normalizedEmail,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    this.emailIndex.set(normalizedEmail, user.id);

    return user;
  }

  async update(id: UserId, data: Partial<User>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) {
      throw new AuthException(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found',
        false,
        404
      );
    }

    // Handle email change
    if (data.email && data.email !== existing.email) {
      const normalizedNewEmail = normalizeEmail(data.email);
      if (this.emailIndex.has(normalizedNewEmail)) {
        throw new AuthException(
          AuthErrorCode.EMAIL_ALREADY_EXISTS,
          'A user with this email already exists',
          false,
          409
        );
      }
      this.emailIndex.delete(existing.email);
      this.emailIndex.set(normalizedNewEmail, id);
    }

    const updated: User = {
      ...existing,
      ...data,
      id: existing.id, // Prevent ID change
      createdAt: existing.createdAt, // Prevent createdAt change
      updatedAt: new Date(),
    };

    this.users.set(id, updated);
    return updated;
  }

  async delete(id: UserId): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      this.emailIndex.delete(user.email);
      this.users.delete(id);
    }
  }

  async existsByEmail(email: Email): Promise<boolean> {
    return this.emailIndex.has(normalizeEmail(email));
  }

  // Testing helpers
  clear(): void {
    this.users.clear();
    this.emailIndex.clear();
  }

  getAll(): User[] {
    return Array.from(this.users.values());
  }
}
