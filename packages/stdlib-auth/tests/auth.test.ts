// ============================================================================
// Authentication Standard Library Tests
// Tests contract compliance for ISL specifications
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuthService,
  createInMemoryAuthService,
  UserStatus,
  SessionStatus,
  RevocationReason,
  AuthErrorCode,
  InMemoryUserRepository,
  InMemorySessionRepository,
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateEmail,
  normalizeEmail,
  createUser,
  incrementFailedAttempts,
  resetFailedAttempts,
  isUserLocked,
  canUserLogin,
  createSession,
  revokeSession,
  isSessionValid,
  hashToken,
  verifyToken,
  DEFAULT_AUTH_CONFIG,
} from '../implementations/typescript';

// ============================================================================
// Test Utilities
// ============================================================================

const validPassword = 'SecurePass123';
const weakPassword = 'weak';
const validEmail = 'test@example.com';
const invalidEmail = 'invalid-email';

// ============================================================================
// Password Utilities Tests
// ============================================================================

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash password with bcrypt', async () => {
      const hash = await hashPassword(validPassword);
      
      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThanOrEqual(60);
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    });

    it('should produce different hashes for same password', async () => {
      const hash1 = await hashPassword(validPassword);
      const hash2 = await hashPassword(validPassword);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const hash = await hashPassword(validPassword);
      const isValid = await verifyPassword(validPassword, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const hash = await hashPassword(validPassword);
      const isValid = await verifyPassword('WrongPassword123', hash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const result = validatePasswordStrength(validPassword);
      
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should reject password without uppercase', () => {
      const result = validatePasswordStrength('securepass123');
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('uppercase');
    });

    it('should reject password without lowercase', () => {
      const result = validatePasswordStrength('SECUREPASS123');
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('lowercase');
    });

    it('should reject password without digit', () => {
      const result = validatePasswordStrength('SecurePassword');
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('digit');
    });

    it('should reject short password', () => {
      const result = validatePasswordStrength('Aa1');
      
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('min_length');
    });
  });
});

// ============================================================================
// Email Utilities Tests
// ============================================================================

describe('Email Utilities', () => {
  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail(validEmail)).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(validateEmail(invalidEmail)).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
    });
  });

  describe('normalizeEmail', () => {
    it('should lowercase and trim email', () => {
      expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
    });
  });
});

// ============================================================================
// User Entity Tests
// ============================================================================

describe('User Entity', () => {
  describe('createUser', () => {
    it('should create user with correct defaults', () => {
      const user = createUser({
        email: validEmail,
        passwordHash: 'hash123',
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(validEmail);
      expect(user.status).toBe(UserStatus.PENDING_VERIFICATION);
      expect(user.failedAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();
    });
  });

  describe('incrementFailedAttempts', () => {
    it('should increment failed attempts', () => {
      const user = createUser({ email: validEmail, passwordHash: 'hash' });
      const updated = incrementFailedAttempts(user);

      expect(updated.failedAttempts).toBe(1);
    });

    it('should lock user after max attempts', () => {
      let user = createUser({ email: validEmail, passwordHash: 'hash' });
      
      for (let i = 0; i < 5; i++) {
        user = incrementFailedAttempts(user);
      }

      expect(user.status).toBe(UserStatus.LOCKED);
      expect(user.lockedUntil).not.toBeNull();
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failed attempts and unlock', () => {
      let user = createUser({ email: validEmail, passwordHash: 'hash' });
      user = { ...user, failedAttempts: 5, status: UserStatus.LOCKED };
      
      const updated = resetFailedAttempts(user);

      expect(updated.failedAttempts).toBe(0);
      expect(updated.lockedUntil).toBeNull();
      expect(updated.status).toBe(UserStatus.ACTIVE);
    });
  });

  describe('isUserLocked', () => {
    it('should return false for active user', () => {
      const user = createUser({ email: validEmail, passwordHash: 'hash' });
      expect(isUserLocked(user)).toBe(false);
    });

    it('should return true for locked user', () => {
      const user = createUser({ email: validEmail, passwordHash: 'hash' });
      const locked = { 
        ...user, 
        status: UserStatus.LOCKED, 
        lockedUntil: new Date(Date.now() + 60000) 
      };
      
      expect(isUserLocked(locked)).toBe(true);
    });

    it('should return false for expired lock', () => {
      const user = createUser({ email: validEmail, passwordHash: 'hash' });
      const locked = { 
        ...user, 
        status: UserStatus.LOCKED, 
        lockedUntil: new Date(Date.now() - 60000) 
      };
      
      expect(isUserLocked(locked)).toBe(false);
    });
  });
});

// ============================================================================
// Session Entity Tests
// ============================================================================

describe('Session Entity', () => {
  describe('createSession', () => {
    it('should create session with token', () => {
      const { session, token } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: 24 * 60 * 60 * 1000,
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.tokenHash).toBeDefined();
      expect(token).toBeDefined();
      expect(token.length).toBeGreaterThanOrEqual(64);
    });

    it('should set correct expiration', () => {
      const duration = 60 * 60 * 1000; // 1 hour
      const { session } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration,
      });

      const expectedExpiry = Date.now() + duration;
      expect(session.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3);
    });
  });

  describe('revokeSession', () => {
    it('should revoke active session', () => {
      const { session } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: 60000,
      });

      const revoked = revokeSession(session, RevocationReason.USER_LOGOUT);

      expect(revoked.status).toBe(SessionStatus.REVOKED);
      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.revocationReason).toBe(RevocationReason.USER_LOGOUT);
    });

    it('should throw when revoking already revoked session', () => {
      const { session } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: 60000,
      });

      const revoked = revokeSession(session, RevocationReason.USER_LOGOUT);

      expect(() => {
        revokeSession(revoked, RevocationReason.USER_LOGOUT);
      }).toThrow();
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid session', () => {
      const { session } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: 60000,
      });

      expect(isSessionValid(session)).toBe(true);
    });

    it('should return false for revoked session', () => {
      const { session } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: 60000,
      });

      const revoked = revokeSession(session, RevocationReason.USER_LOGOUT);
      expect(isSessionValid(revoked)).toBe(false);
    });

    it('should return false for expired session', () => {
      const { session } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: -1000, // Already expired
      });

      expect(isSessionValid(session)).toBe(false);
    });
  });

  describe('Token Functions', () => {
    it('should verify correct token', () => {
      const { session, token } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: 60000,
      });

      expect(verifyToken(token, session.tokenHash)).toBe(true);
    });

    it('should reject incorrect token', () => {
      const { session } = createSession({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        duration: 60000,
      });

      expect(verifyToken('wrong-token', session.tokenHash)).toBe(false);
    });
  });
});

// ============================================================================
// AuthService Integration Tests
// ============================================================================

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = createInMemoryAuthService();
  });

  // ==========================================================================
  // Register Tests
  // ==========================================================================

  describe('register', () => {
    it('should register new user successfully', async () => {
      const result = await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe(validEmail);
        expect(result.data.user.status).toBe(UserStatus.PENDING_VERIFICATION);
      }
    });

    it('should fail when email already exists', async () => {
      // First registration
      await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      // Second registration with same email
      const result = await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.EMAIL_ALREADY_EXISTS);
      }
    });

    it('should fail when passwords do not match', async () => {
      const result = await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: 'DifferentPass123',
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.PASSWORDS_DO_NOT_MATCH);
      }
    });

    it('should fail when password is too weak', async () => {
      const result = await authService.register({
        email: validEmail,
        password: weakPassword,
        confirmPassword: weakPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.PASSWORD_TOO_WEAK);
      }
    });

    it('should fail when terms not accepted', async () => {
      const result = await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: false,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.TERMS_NOT_ACCEPTED);
      }
    });

    it('should fail with invalid email', async () => {
      const result = await authService.register({
        email: invalidEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.INVALID_EMAIL);
      }
    });
  });

  // ==========================================================================
  // Login Tests
  // ==========================================================================

  describe('login', () => {
    beforeEach(async () => {
      // Create and activate a user for login tests
      const userRepo = new InMemoryUserRepository();
      const sessionRepo = new InMemorySessionRepository();
      
      authService = new AuthService({
        userRepository: userRepo,
        sessionRepository: sessionRepo,
      });

      // Create user with ACTIVE status (simulating email verification)
      const hash = await hashPassword(validPassword);
      await userRepo.create({
        email: validEmail,
        passwordHash: hash,
        status: UserStatus.ACTIVE,
        roles: [{ toString: () => 'USER' }] as any,
        lastLogin: null,
        emailVerifiedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: null,
        displayName: null,
        avatarUrl: null,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const result = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe(validEmail);
        expect(result.data.token).toBeDefined();
        expect(result.data.session.status).toBe(SessionStatus.ACTIVE);
      }
    });

    it('should fail with wrong password', async () => {
      const result = await authService.login({
        email: validEmail,
        password: 'WrongPassword123',
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      }
    });

    it('should fail with non-existent email', async () => {
      const result = await authService.login({
        email: 'nonexistent@example.com',
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.INVALID_CREDENTIALS);
      }
    });

    it('should extend session with remember_me', async () => {
      const result = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
        rememberMe: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const sessionDuration = result.data.expiresAt.getTime() - Date.now();
        // Should be close to 30 days
        expect(sessionDuration).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      }
    });
  });

  // ==========================================================================
  // Logout Tests
  // ==========================================================================

  describe('logout', () => {
    let sessionId: string;
    let userId: string;

    beforeEach(async () => {
      const userRepo = new InMemoryUserRepository();
      const sessionRepo = new InMemorySessionRepository();
      
      authService = new AuthService({
        userRepository: userRepo,
        sessionRepository: sessionRepo,
      });

      // Create active user
      const hash = await hashPassword(validPassword);
      const user = await userRepo.create({
        email: validEmail,
        passwordHash: hash,
        status: UserStatus.ACTIVE,
        roles: [{ toString: () => 'USER' }] as any,
        lastLogin: null,
        emailVerifiedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: null,
        displayName: null,
        avatarUrl: null,
      });
      userId = user.id;

      // Login to get session
      const loginResult = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      if (loginResult.success) {
        sessionId = loginResult.data.session.id;
      }
    });

    it('should logout successfully', async () => {
      const result = await authService.logout({
        sessionId,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revokedCount).toBe(1);
      }
    });

    it('should fail for non-existent session', async () => {
      const result = await authService.logout({
        sessionId: 'non-existent-session',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.SESSION_NOT_FOUND);
      }
    });

    it('should revoke all sessions when requested', async () => {
      // Create additional sessions
      await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.2',
      });
      await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.3',
      });

      const result = await authService.logout({
        sessionId,
        revokeAll: true,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.revokedCount).toBe(3);
      }
    });
  });

  // ==========================================================================
  // Validate Session Tests
  // ==========================================================================

  describe('validateSession', () => {
    let token: string;

    beforeEach(async () => {
      const userRepo = new InMemoryUserRepository();
      const sessionRepo = new InMemorySessionRepository();
      
      authService = new AuthService({
        userRepository: userRepo,
        sessionRepository: sessionRepo,
      });

      // Create active user and login
      const hash = await hashPassword(validPassword);
      await userRepo.create({
        email: validEmail,
        passwordHash: hash,
        status: UserStatus.ACTIVE,
        roles: [{ toString: () => 'USER' }] as any,
        lastLogin: null,
        emailVerifiedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: null,
        displayName: null,
        avatarUrl: null,
      });

      const loginResult = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      if (loginResult.success) {
        token = loginResult.data.token;
      }
    });

    it('should validate active session', async () => {
      const result = await authService.validateSession({
        sessionToken: token,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.email).toBe(validEmail);
      }
    });

    it('should fail for invalid token', async () => {
      const result = await authService.validateSession({
        sessionToken: 'invalid-token',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(AuthErrorCode.SESSION_NOT_FOUND);
      }
    });

    it('should fail for revoked session', async () => {
      // Get session ID from login
      const loginResult = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      if (loginResult.success) {
        // Logout to revoke session
        await authService.logout({
          sessionId: loginResult.data.session.id,
        });

        // Try to validate
        const result = await authService.validateSession({
          sessionToken: loginResult.data.token,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe(AuthErrorCode.SESSION_REVOKED);
        }
      }
    });
  });
});

// ============================================================================
// Repository Tests
// ============================================================================

describe('InMemoryUserRepository', () => {
  let repo: InMemoryUserRepository;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
  });

  it('should create and find user by id', async () => {
    const user = await repo.create({
      email: validEmail,
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      roles: [{ toString: () => 'USER' }] as any,
      lastLogin: null,
      emailVerifiedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
      displayName: null,
      avatarUrl: null,
    });

    const found = await repo.findById(user.id);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(validEmail);
  });

  it('should find user by email', async () => {
    await repo.create({
      email: validEmail,
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      roles: [{ toString: () => 'USER' }] as any,
      lastLogin: null,
      emailVerifiedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
      displayName: null,
      avatarUrl: null,
    });

    const found = await repo.findByEmail(validEmail);
    expect(found).not.toBeNull();
    expect(found?.email).toBe(validEmail);
  });

  it('should check email existence', async () => {
    expect(await repo.existsByEmail(validEmail)).toBe(false);

    await repo.create({
      email: validEmail,
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      roles: [{ toString: () => 'USER' }] as any,
      lastLogin: null,
      emailVerifiedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
      displayName: null,
      avatarUrl: null,
    });

    expect(await repo.existsByEmail(validEmail)).toBe(true);
  });

  it('should update user', async () => {
    const user = await repo.create({
      email: validEmail,
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      roles: [{ toString: () => 'USER' }] as any,
      lastLogin: null,
      emailVerifiedAt: new Date(),
      failedAttempts: 0,
      lockedUntil: null,
      passwordChangedAt: null,
      displayName: null,
      avatarUrl: null,
    });

    const updated = await repo.update(user.id, {
      displayName: 'New Name',
    });

    expect(updated.displayName).toBe('New Name');
  });
});

describe('InMemorySessionRepository', () => {
  let repo: InMemorySessionRepository;

  beforeEach(() => {
    repo = new InMemorySessionRepository();
  });

  it('should create and find session by id', async () => {
    const { session } = createSession({
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      duration: 60000,
    });

    const created = await repo.create(session);
    const found = await repo.findById(created.id);

    expect(found).not.toBeNull();
    expect(found?.userId).toBe('user-123');
  });

  it('should find active sessions by user', async () => {
    const { session: session1 } = createSession({
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      duration: 60000,
    });
    const { session: session2 } = createSession({
      userId: 'user-123',
      ipAddress: '192.168.1.2',
      duration: 60000,
    });

    await repo.create(session1);
    await repo.create(session2);

    const sessions = await repo.findActiveByUserId('user-123');
    expect(sessions).toHaveLength(2);
  });

  it('should revoke all sessions for user', async () => {
    const { session: session1 } = createSession({
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      duration: 60000,
    });
    const { session: session2 } = createSession({
      userId: 'user-123',
      ipAddress: '192.168.1.2',
      duration: 60000,
    });

    const created1 = await repo.create(session1);
    await repo.create(session2);

    const count = await repo.revokeAllForUser(
      'user-123',
      RevocationReason.PASSWORD_CHANGE
    );

    expect(count).toBe(2);

    const sessions = await repo.findActiveByUserId('user-123');
    expect(sessions).toHaveLength(0);
  });

  it('should respect except_session_id when revoking', async () => {
    const { session: session1 } = createSession({
      userId: 'user-123',
      ipAddress: '192.168.1.1',
      duration: 60000,
    });
    const { session: session2 } = createSession({
      userId: 'user-123',
      ipAddress: '192.168.1.2',
      duration: 60000,
    });

    const created1 = await repo.create(session1);
    await repo.create(session2);

    const count = await repo.revokeAllForUser(
      'user-123',
      RevocationReason.PASSWORD_CHANGE,
      created1.id
    );

    expect(count).toBe(1);

    const sessions = await repo.findActiveByUserId('user-123');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(created1.id);
  });
});

// ============================================================================
// Contract Compliance Tests (ISL Postconditions)
// ============================================================================

describe('ISL Contract Compliance', () => {
  describe('Register Postconditions', () => {
    let authService: AuthService;

    beforeEach(() => {
      authService = createInMemoryAuthService();
    });

    it('success implies User.status == PENDING_VERIFICATION', async () => {
      const result = await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.status).toBe(UserStatus.PENDING_VERIFICATION);
      }
    });

    it('success implies User.password_hash != input.password', async () => {
      const userRepo = new InMemoryUserRepository();
      authService = new AuthService({
        userRepository: userRepo,
        sessionRepository: new InMemorySessionRepository(),
      });

      await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      const user = await userRepo.findByEmail(validEmail);
      expect(user?.passwordHash).not.toBe(validPassword);
    });

    it('EMAIL_ALREADY_EXISTS implies User.count unchanged', async () => {
      const userRepo = new InMemoryUserRepository();
      authService = new AuthService({
        userRepository: userRepo,
        sessionRepository: new InMemorySessionRepository(),
      });

      await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      const countBefore = userRepo.getAll().length;

      await authService.register({
        email: validEmail,
        password: validPassword,
        confirmPassword: validPassword,
        acceptTerms: true,
        ipAddress: '192.168.1.1',
      });

      const countAfter = userRepo.getAll().length;
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Login Postconditions', () => {
    let authService: AuthService;
    let userRepo: InMemoryUserRepository;
    let sessionRepo: InMemorySessionRepository;

    beforeEach(async () => {
      userRepo = new InMemoryUserRepository();
      sessionRepo = new InMemorySessionRepository();
      authService = new AuthService({
        userRepository: userRepo,
        sessionRepository: sessionRepo,
      });

      const hash = await hashPassword(validPassword);
      await userRepo.create({
        email: validEmail,
        passwordHash: hash,
        status: UserStatus.ACTIVE,
        roles: [{ toString: () => 'USER' }] as any,
        lastLogin: null,
        emailVerifiedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: null,
        displayName: null,
        avatarUrl: null,
      });
    });

    it('success implies Session.exists(result.id)', async () => {
      const result = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        const session = await sessionRepo.findById(result.data.session.id);
        expect(session).not.toBeNull();
      }
    });

    it('success implies Session.expires_at > now()', async () => {
      const result = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('success implies User.failed_attempts == 0', async () => {
      // First fail some logins
      await authService.login({
        email: validEmail,
        password: 'WrongPass123',
        ipAddress: '192.168.1.1',
      });
      await authService.login({
        email: validEmail,
        password: 'WrongPass123',
        ipAddress: '192.168.1.1',
      });

      // Then successful login
      await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      const user = await userRepo.findByEmail(validEmail);
      expect(user?.failedAttempts).toBe(0);
    });

    it('INVALID_CREDENTIALS implies failed_attempts incremented', async () => {
      const userBefore = await userRepo.findByEmail(validEmail);
      const attemptsBefore = userBefore?.failedAttempts ?? 0;

      await authService.login({
        email: validEmail,
        password: 'WrongPass123',
        ipAddress: '192.168.1.1',
      });

      const userAfter = await userRepo.findByEmail(validEmail);
      expect(userAfter?.failedAttempts).toBe(attemptsBefore + 1);
    });

    it('INVALID_CREDENTIALS implies no Session created', async () => {
      const sessionsBefore = sessionRepo.getAll().length;

      await authService.login({
        email: validEmail,
        password: 'WrongPass123',
        ipAddress: '192.168.1.1',
      });

      const sessionsAfter = sessionRepo.getAll().length;
      expect(sessionsAfter).toBe(sessionsBefore);
    });
  });

  describe('Logout Postconditions', () => {
    let authService: AuthService;
    let sessionRepo: InMemorySessionRepository;
    let sessionId: string;

    beforeEach(async () => {
      const userRepo = new InMemoryUserRepository();
      sessionRepo = new InMemorySessionRepository();
      authService = new AuthService({
        userRepository: userRepo,
        sessionRepository: sessionRepo,
      });

      const hash = await hashPassword(validPassword);
      await userRepo.create({
        email: validEmail,
        passwordHash: hash,
        status: UserStatus.ACTIVE,
        roles: [{ toString: () => 'USER' }] as any,
        lastLogin: null,
        emailVerifiedAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: null,
        displayName: null,
        avatarUrl: null,
      });

      const loginResult = await authService.login({
        email: validEmail,
        password: validPassword,
        ipAddress: '192.168.1.1',
      });

      if (loginResult.success) {
        sessionId = loginResult.data.session.id;
      }
    });

    it('success implies Session.status == REVOKED', async () => {
      await authService.logout({ sessionId });

      const session = await sessionRepo.findById(sessionId);
      expect(session?.status).toBe(SessionStatus.REVOKED);
    });

    it('success implies Session.revoked_at == now()', async () => {
      const before = Date.now();
      await authService.logout({ sessionId });
      const after = Date.now();

      const session = await sessionRepo.findById(sessionId);
      expect(session?.revokedAt).not.toBeNull();
      expect(session?.revokedAt?.getTime()).toBeGreaterThanOrEqual(before);
      expect(session?.revokedAt?.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
