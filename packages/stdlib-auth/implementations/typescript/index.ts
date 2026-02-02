// ============================================================================
// Authentication Standard Library - Main Entry Point
// @isl-lang/stdlib-auth
// ============================================================================

import {
  UserId,
  SessionId,
  UserStatus,
  SessionStatus,
  RevocationReason,
  RegisterInput,
  RegisterOutput,
  LoginInput,
  LoginOutput,
  LogoutInput,
  LogoutOutput,
  ValidateSessionInput,
  ValidateSessionOutput,
  RequestPasswordResetInput,
  RequestPasswordResetOutput,
  PasswordResetInput,
  PasswordResetOutput,
  ChangePasswordInput,
  ChangePasswordOutput,
  Result,
  success,
  failure,
  AuthException,
  AuthErrorCode,
  AuthConfig,
  DEFAULT_AUTH_CONFIG,
  UserRepository,
  SessionRepository,
  PasswordResetTokenRepository,
  EventEmitter,
} from './types';

import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  validateEmail,
  normalizeEmail,
  incrementFailedAttempts,
  resetFailedAttempts,
  updateLastLogin,
  updatePassword,
  isUserLocked,
  InMemoryUserRepository,
} from './user';

import {
  createSession,
  revokeSession,
  hashToken,
  InMemorySessionRepository,
} from './session';

// Re-export types
export * from './types';
export * from './user';
export * from './session';

// ============================================================================
// Auth Service
// ============================================================================

export interface AuthServiceDependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  passwordResetTokenRepository?: PasswordResetTokenRepository;
  eventEmitter?: EventEmitter;
  config?: Partial<AuthConfig>;
}

export class AuthService {
  private readonly userRepo: UserRepository;
  private readonly sessionRepo: SessionRepository;
  private readonly resetTokenRepo?: PasswordResetTokenRepository;
  private readonly eventEmitter?: EventEmitter;
  private readonly config: AuthConfig;

  constructor(deps: AuthServiceDependencies) {
    this.userRepo = deps.userRepository;
    this.sessionRepo = deps.sessionRepository;
    this.resetTokenRepo = deps.passwordResetTokenRepository;
    this.eventEmitter = deps.eventEmitter;
    this.config = { ...DEFAULT_AUTH_CONFIG, ...deps.config };
  }

  // ==========================================================================
  // Register
  // ==========================================================================

  async register(input: RegisterInput): Promise<Result<RegisterOutput>> {
    try {
      // Validate email
      if (!validateEmail(input.email)) {
        throw new AuthException(
          AuthErrorCode.INVALID_EMAIL,
          'Invalid email format',
          true,
          400
        );
      }

      // Validate terms acceptance
      if (!input.acceptTerms) {
        throw new AuthException(
          AuthErrorCode.TERMS_NOT_ACCEPTED,
          'You must accept the terms and conditions',
          true,
          400
        );
      }

      // Validate password match
      if (input.password !== input.confirmPassword) {
        throw new AuthException(
          AuthErrorCode.PASSWORDS_DO_NOT_MATCH,
          'Password and confirmation do not match',
          true,
          400
        );
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(input.password);
      if (!passwordValidation.valid) {
        throw new AuthException(
          AuthErrorCode.PASSWORD_TOO_WEAK,
          'Password does not meet strength requirements',
          true,
          400,
          undefined,
          { missing: passwordValidation.missing }
        );
      }

      // Check if email exists
      if (await this.userRepo.existsByEmail(input.email)) {
        throw new AuthException(
          AuthErrorCode.EMAIL_ALREADY_EXISTS,
          'A user with this email already exists',
          false,
          409
        );
      }

      // Hash password
      const passwordHash = await hashPassword(
        input.password,
        this.config.hashRounds
      );

      // Create user
      const user = await this.userRepo.create({
        email: normalizeEmail(input.email),
        passwordHash,
        displayName: input.displayName ?? null,
        status: UserStatus.PENDING_VERIFICATION,
        roles: [{ toString: () => 'USER' }] as any,
        lastLogin: null,
        emailVerifiedAt: null,
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: null,
        avatarUrl: null,
      });

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'UserRegistered',
          timestamp: new Date(),
          userId: user.id,
          email: user.email,
          ipAddress: input.ipAddress,
        });
      }

      return success({
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      if (error instanceof AuthException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Login
  // ==========================================================================

  async login(input: LoginInput): Promise<Result<LoginOutput>> {
    try {
      // Validate email format
      if (!validateEmail(input.email)) {
        throw new AuthException(
          AuthErrorCode.INVALID_CREDENTIALS,
          'Invalid credentials',
          true,
          401,
          1
        );
      }

      // Find user
      const user = await this.userRepo.findByEmail(input.email);
      
      if (!user) {
        // Still perform password hash to prevent timing attacks
        await hashPassword('dummy-password', this.config.hashRounds);
        throw new AuthException(
          AuthErrorCode.INVALID_CREDENTIALS,
          'Invalid credentials',
          true,
          401,
          1
        );
      }

      // Check if user is locked
      if (isUserLocked(user)) {
        throw new AuthException(
          AuthErrorCode.USER_LOCKED,
          'Account is locked due to too many failed attempts',
          true,
          423,
          15 * 60, // 15 minutes
          {
            lockedUntil: user.lockedUntil,
            canResetPassword: true,
          }
        );
      }

      // Check user status
      if (user.status === UserStatus.INACTIVE) {
        throw new AuthException(
          AuthErrorCode.USER_INACTIVE,
          'Account is inactive',
          false,
          403
        );
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new AuthException(
          AuthErrorCode.USER_SUSPENDED,
          'Account has been suspended',
          false,
          403,
          undefined,
          { contactSupport: true }
        );
      }

      if (user.status === UserStatus.PENDING_VERIFICATION) {
        throw new AuthException(
          AuthErrorCode.EMAIL_NOT_VERIFIED,
          'Please verify your email address',
          false,
          403,
          undefined,
          { canResendVerification: true }
        );
      }

      // Verify password
      const passwordValid = await verifyPassword(input.password, user.passwordHash);
      
      if (!passwordValid) {
        // Increment failed attempts
        const updatedUser = incrementFailedAttempts(user, this.config);
        await this.userRepo.update(user.id, updatedUser);

        // Emit event
        if (this.eventEmitter) {
          await this.eventEmitter.emit({
            type: 'InvalidLoginAttempt',
            timestamp: new Date(),
            email: input.email,
            reason: 'INVALID_CREDENTIALS',
            ipAddress: input.ipAddress,
          });

          if (updatedUser.status === UserStatus.LOCKED) {
            await this.eventEmitter.emit({
              type: 'AccountLocked',
              timestamp: new Date(),
              userId: user.id,
              failedAttempts: updatedUser.failedAttempts,
              lockedUntil: updatedUser.lockedUntil,
              ipAddress: input.ipAddress,
            });
          }
        }

        throw new AuthException(
          AuthErrorCode.INVALID_CREDENTIALS,
          'Invalid credentials',
          true,
          401,
          1
        );
      }

      // Check session limit
      const activeSessionCount = await this.sessionRepo.countActiveForUser(user.id);
      if (activeSessionCount >= this.config.maxConcurrentSessions) {
        // Revoke oldest session
        const activeSessions = await this.sessionRepo.findActiveByUserId(user.id);
        const oldestSession = activeSessions[activeSessions.length - 1];
        if (oldestSession) {
          await this.sessionRepo.update(oldestSession.id, {
            status: SessionStatus.REVOKED,
            revokedAt: new Date(),
            revocationReason: RevocationReason.SESSION_LIMIT,
          });
        }
      }

      // Create session
      const sessionDuration = input.rememberMe
        ? this.config.extendedSessionDuration
        : this.config.sessionDuration;

      const { session, token } = createSession({
        userId: user.id,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceFingerprint: input.deviceFingerprint,
        duration: sessionDuration,
      });

      await this.sessionRepo.create(session);

      // Update user
      const updatedUser = updateLastLogin(resetFailedAttempts(user));
      await this.userRepo.update(user.id, updatedUser);

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'UserLoggedIn',
          timestamp: new Date(),
          userId: user.id,
          sessionId: session.id,
          ipAddress: input.ipAddress,
        });
      }

      return success({
        session,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          roles: user.roles,
        },
        token,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      if (error instanceof AuthException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Logout
  // ==========================================================================

  async logout(input: LogoutInput): Promise<Result<LogoutOutput>> {
    try {
      const session = await this.sessionRepo.findById(input.sessionId);

      if (!session) {
        throw new AuthException(
          AuthErrorCode.SESSION_NOT_FOUND,
          'Session not found',
          false,
          404
        );
      }

      if (session.status === SessionStatus.REVOKED) {
        throw new AuthException(
          AuthErrorCode.SESSION_ALREADY_REVOKED,
          'Session was already revoked',
          false,
          409
        );
      }

      const reason = input.reason ?? RevocationReason.USER_LOGOUT;
      let revokedCount = 0;

      if (input.revokeAll) {
        // Revoke all sessions for the user
        revokedCount = await this.sessionRepo.revokeAllForUser(
          session.userId,
          reason
        );
      } else {
        // Revoke single session
        const revoked = revokeSession(session, reason);
        await this.sessionRepo.update(session.id, revoked);
        revokedCount = 1;
      }

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'UserLoggedOut',
          timestamp: new Date(),
          userId: session.userId,
          sessionId: session.id,
          reason,
        });
      }

      return success({
        revokedCount,
        message: input.revokeAll
          ? `Successfully logged out of all ${revokedCount} sessions`
          : 'Successfully logged out',
      });
    } catch (error) {
      if (error instanceof AuthException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Validate Session
  // ==========================================================================

  async validateSession(
    input: ValidateSessionInput
  ): Promise<Result<ValidateSessionOutput>> {
    try {
      const tokenHash = hashToken(input.sessionToken);
      const session = await this.sessionRepo.findByTokenHash(tokenHash);

      if (!session) {
        throw new AuthException(
          AuthErrorCode.SESSION_NOT_FOUND,
          'Invalid session',
          false,
          401
        );
      }

      if (session.status === SessionStatus.REVOKED) {
        throw new AuthException(
          AuthErrorCode.SESSION_REVOKED,
          'Session has been revoked',
          false,
          401
        );
      }

      if (session.expiresAt <= new Date()) {
        throw new AuthException(
          AuthErrorCode.SESSION_EXPIRED,
          'Session has expired',
          false,
          401
        );
      }

      const user = await this.userRepo.findById(session.userId);

      if (!user) {
        throw new AuthException(
          AuthErrorCode.USER_NOT_FOUND,
          'User not found',
          false,
          401
        );
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new AuthException(
          AuthErrorCode.USER_INACTIVE,
          'User account is not active',
          false,
          403
        );
      }

      // Update last activity
      await this.sessionRepo.update(session.id, {
        lastActivityAt: new Date(),
      });

      return success({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          roles: user.roles,
          status: user.status,
        },
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof AuthException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Request Password Reset
  // ==========================================================================

  async requestPasswordReset(
    input: RequestPasswordResetInput
  ): Promise<Result<RequestPasswordResetOutput>> {
    // Always return success to prevent email enumeration
    const message =
      'If an account exists with this email, a reset link has been sent';

    try {
      const user = await this.userRepo.findByEmail(input.email);

      if (user && this.resetTokenRepo) {
        // Invalidate existing tokens
        await this.resetTokenRepo.invalidateForUser(user.id);

        // Create new token (in real implementation, this would be sent via email)
        const token = createSession({
          userId: user.id,
          ipAddress: input.ipAddress,
          duration: this.config.resetTokenExpiry,
        }).token;

        await this.resetTokenRepo.create({
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + this.config.resetTokenExpiry),
          usedAt: null,
          ipAddress: input.ipAddress,
        });

        // Emit event
        if (this.eventEmitter) {
          await this.eventEmitter.emit({
            type: 'PasswordResetRequested',
            timestamp: new Date(),
            userId: user.id,
            ipAddress: input.ipAddress,
          });
        }
      }

      return success({ message });
    } catch {
      // Still return success to prevent enumeration
      return success({ message });
    }
  }

  // ==========================================================================
  // Password Reset
  // ==========================================================================

  async passwordReset(
    input: PasswordResetInput
  ): Promise<Result<PasswordResetOutput>> {
    try {
      if (!this.resetTokenRepo) {
        throw new AuthException(
          AuthErrorCode.INTERNAL_ERROR,
          'Password reset not configured',
          false,
          500
        );
      }

      // Validate password match
      if (input.newPassword !== input.confirmPassword) {
        throw new AuthException(
          AuthErrorCode.PASSWORDS_DO_NOT_MATCH,
          'Password and confirmation do not match',
          true,
          400
        );
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(input.newPassword);
      if (!passwordValidation.valid) {
        throw new AuthException(
          AuthErrorCode.PASSWORD_TOO_WEAK,
          'Password does not meet strength requirements',
          true,
          400,
          undefined,
          { missing: passwordValidation.missing }
        );
      }

      // Find token
      const tokenHash = hashToken(input.token);
      const resetToken = await this.resetTokenRepo.findByTokenHash(tokenHash);

      if (!resetToken) {
        throw new AuthException(
          AuthErrorCode.INVALID_TOKEN,
          'Invalid or expired reset token',
          false,
          400
        );
      }

      if (resetToken.usedAt) {
        throw new AuthException(
          AuthErrorCode.INVALID_TOKEN,
          'Reset token has already been used',
          false,
          400
        );
      }

      if (resetToken.expiresAt <= new Date()) {
        throw new AuthException(
          AuthErrorCode.INVALID_TOKEN,
          'Reset token has expired',
          false,
          400
        );
      }

      // Get user
      const user = await this.userRepo.findById(resetToken.userId);

      if (!user) {
        throw new AuthException(
          AuthErrorCode.USER_NOT_FOUND,
          'User not found',
          false,
          400
        );
      }

      if (user.status === UserStatus.SUSPENDED) {
        throw new AuthException(
          AuthErrorCode.USER_SUSPENDED,
          'Cannot reset password for suspended account',
          false,
          403
        );
      }

      // Hash new password
      const newPasswordHash = await hashPassword(
        input.newPassword,
        this.config.hashRounds
      );

      // Update user password
      const updatedUser = updatePassword(user, newPasswordHash);
      await this.userRepo.update(user.id, updatedUser);

      // Mark token as used
      await this.resetTokenRepo.markUsed(resetToken.id);

      // Revoke all sessions
      const sessionsRevoked = await this.sessionRepo.revokeAllForUser(
        user.id,
        RevocationReason.PASSWORD_CHANGE
      );

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'PasswordResetCompleted',
          timestamp: new Date(),
          userId: user.id,
          sessionsRevoked,
          ipAddress: input.ipAddress,
        });
      }

      return success({
        message: 'Password has been reset successfully',
        sessionsRevoked,
      });
    } catch (error) {
      if (error instanceof AuthException) {
        return failure(error.toError());
      }
      throw error;
    }
  }

  // ==========================================================================
  // Change Password (Authenticated)
  // ==========================================================================

  async changePassword(
    userId: UserId,
    currentSessionId: SessionId,
    input: ChangePasswordInput
  ): Promise<Result<ChangePasswordOutput>> {
    try {
      // Validate password match
      if (input.newPassword !== input.confirmPassword) {
        throw new AuthException(
          AuthErrorCode.PASSWORDS_DO_NOT_MATCH,
          'Password and confirmation do not match',
          true,
          400
        );
      }

      // Cannot use same password
      if (input.currentPassword === input.newPassword) {
        throw new AuthException(
          AuthErrorCode.PASSWORD_SAME_AS_OLD,
          'New password cannot be the same as current password',
          true,
          400
        );
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(input.newPassword);
      if (!passwordValidation.valid) {
        throw new AuthException(
          AuthErrorCode.PASSWORD_TOO_WEAK,
          'Password does not meet strength requirements',
          true,
          400,
          undefined,
          { missing: passwordValidation.missing }
        );
      }

      // Get user
      const user = await this.userRepo.findById(userId);

      if (!user) {
        throw new AuthException(
          AuthErrorCode.USER_NOT_FOUND,
          'User not found',
          false,
          404
        );
      }

      // Verify current password
      const passwordValid = await verifyPassword(
        input.currentPassword,
        user.passwordHash
      );

      if (!passwordValid) {
        // Increment failed attempts
        const updatedUser = incrementFailedAttempts(user, this.config);
        await this.userRepo.update(user.id, updatedUser);

        throw new AuthException(
          AuthErrorCode.INVALID_CURRENT_PASSWORD,
          'Current password is incorrect',
          true,
          400
        );
      }

      // Hash new password
      const newPasswordHash = await hashPassword(
        input.newPassword,
        this.config.hashRounds
      );

      // Update password
      const updatedUser = updatePassword(user, newPasswordHash);
      await this.userRepo.update(user.id, updatedUser);

      // Revoke other sessions if requested
      let sessionsRevoked = 0;
      if (input.revokeOtherSessions !== false) {
        sessionsRevoked = await this.sessionRepo.revokeAllForUser(
          user.id,
          RevocationReason.PASSWORD_CHANGE,
          currentSessionId
        );
      }

      // Emit event
      if (this.eventEmitter) {
        await this.eventEmitter.emit({
          type: 'PasswordChanged',
          timestamp: new Date(),
          userId: user.id,
          sessionsRevoked,
        });
      }

      return success({
        message: 'Password has been changed successfully',
        sessionsRevoked,
      });
    } catch (error) {
      if (error instanceof AuthException) {
        return failure(error.toError());
      }
      throw error;
    }
  }
}

// ============================================================================
// Factory for creating AuthService with in-memory repositories (testing)
// ============================================================================

export function createInMemoryAuthService(
  config?: Partial<AuthConfig>
): AuthService {
  return new AuthService({
    userRepository: new InMemoryUserRepository(),
    sessionRepository: new InMemorySessionRepository(),
    config,
  });
}
