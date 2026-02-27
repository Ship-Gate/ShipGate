/**
 * Main Auth Service
 */

import { v4 as uuid } from 'uuid';
import type {
  AuthConfig,
  User,
  Session,
  LoginInput,
  RegisterInput,
  AuthResult,
  TokenPayload,
} from './types';
import { hashPassword, verifyPassword, validatePassword } from './password';
import { createToken, verifyToken } from './jwt';

export interface AuthStore {
  findUserByEmail(email: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  
  createSession(session: Omit<Session, 'id'>): Promise<Session>;
  findSession(id: string): Promise<Session | null>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session>;
  revokeSession(id: string, reason?: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<number>;
}

export class AuthService {
  constructor(
    private store: AuthStore,
    private config: AuthConfig
  ) {}

  /**
   * Register new user
   */
  async register(input: RegisterInput): Promise<AuthResult<{ user: User; verificationRequired: boolean }>> {
    // Validate password
    const passwordValidation = validatePassword(input.password, this.config.password);
    if (!passwordValidation.valid) {
      return {
        ok: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password does not meet requirements',
          retriable: true,
          data: { requirements: passwordValidation.failures },
        },
      };
    }

    // Check if email exists
    const existingUser = await this.store.findUserByEmail(input.email);
    if (existingUser) {
      return {
        ok: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered',
          retriable: false,
        },
      };
    }

    // Check username if provided
    if (input.username) {
      const existingUsername = await this.store.findUserByUsername(input.username);
      if (existingUsername) {
        return {
          ok: false,
          error: {
            code: 'USERNAME_EXISTS',
            message: 'Username already taken',
            retriable: false,
          },
        };
      }
    }

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create user
    const user = await this.store.createUser({
      email: input.email,
      username: input.username,
      passwordHash,
      phone: input.phone,
      status: 'pending_verification',
      emailVerified: false,
      phoneVerified: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      roles: [],
      permissions: [],
    });

    return {
      ok: true,
      data: {
        user,
        verificationRequired: true,
      },
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput): Promise<AuthResult<{
    user: User;
    session: Session;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    requiresMfa?: boolean;
  }>> {
    // Find user
    const user = input.email
      ? await this.store.findUserByEmail(input.email)
      : input.username
        ? await this.store.findUserByUsername(input.username)
        : null;

    if (!user) {
      return {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email/username or password',
          retriable: true,
        },
      };
    }

    // Check if locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return {
        ok: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is locked due to too many failed attempts',
          retriable: false,
          data: { lockedUntil: user.lockedUntil.toISOString() },
        },
      };
    }

    // Verify password
    const passwordValid = await verifyPassword(input.password, user.passwordHash);
    if (!passwordValid) {
      // Increment failed attempts
      const newAttempts = user.failedLoginAttempts + 1;
      const updates: Partial<User> = { failedLoginAttempts: newAttempts };

      if (newAttempts >= this.config.rateLimit.loginAttempts) {
        updates.lockedUntil = new Date(Date.now() + this.config.rateLimit.lockoutDuration);
        updates.status = 'locked';
      }

      await this.store.updateUser(user.id, updates);

      if (newAttempts >= this.config.rateLimit.loginAttempts) {
        return {
          ok: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Too many failed attempts',
            retriable: false,
            data: { lockedUntil: updates.lockedUntil!.toISOString() },
          },
        };
      }

      return {
        ok: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email/username or password',
          retriable: true,
        },
      };
    }

    // Check status
    if (user.status === 'pending_verification') {
      return {
        ok: false,
        error: {
          code: 'ACCOUNT_NOT_VERIFIED',
          message: 'Please verify your email first',
          retriable: false,
        },
      };
    }

    if (user.status === 'suspended') {
      return {
        ok: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Account has been suspended',
          retriable: false,
        },
      };
    }

    // Check MFA
    if (user.mfaEnabled && !input.mfaCode) {
      return {
        ok: false,
        error: {
          code: 'MFA_REQUIRED',
          message: 'MFA code required',
          retriable: true,
          data: { mfaType: 'totp' },
        },
      };
    }

    // Create session
    const sessionId = uuid();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.session.maxDuration);

    const accessToken = await createToken(
      {
        sub: user.id,
        sessionId,
        type: 'access',
        roles: user.roles.map(r => r.name),
      },
      this.config.jwt,
      this.config.jwt.accessTokenExpiry
    );

    const refreshToken = await createToken(
      {
        sub: user.id,
        sessionId,
        type: 'refresh',
      },
      this.config.jwt,
      this.config.jwt.refreshTokenExpiry
    );

    const session = await this.store.createSession({
      userId: user.id,
      accessToken,
      refreshToken,
      ipAddress: input.deviceInfo?.ipAddress,
      userAgent: input.deviceInfo?.userAgent,
      deviceFingerprint: input.deviceInfo?.fingerprint,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      revoked: false,
    });

    // Reset failed attempts and update last login
    await this.store.updateUser(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      lastLoginAt: now,
    });

    return {
      ok: true,
      data: {
        user,
        session,
        accessToken,
        refreshToken,
        expiresIn: this.config.jwt.accessTokenExpiry,
      },
    };
  }

  /**
   * Verify session from access token
   */
  async verifySession(accessToken: string): Promise<AuthResult<{
    user: User;
    session: Session;
  }>> {
    // Verify token
    const tokenResult = await verifyToken(accessToken, this.config.jwt);
    if (!tokenResult.ok) {
      return {
        ok: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token is invalid or expired',
        },
      };
    }

    const payload = tokenResult.data as TokenPayload;

    // Find session
    const session = await this.store.findSession(payload.sessionId);
    if (!session) {
      return {
        ok: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      };
    }

    if (session.revoked) {
      return {
        ok: false,
        error: {
          code: 'SESSION_REVOKED',
          message: 'Session has been revoked',
        },
      };
    }

    if (session.expiresAt < new Date()) {
      return {
        ok: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
        },
      };
    }

    // Find user
    const user = await this.store.findUserById(payload.sub);
    if (!user) {
      return {
        ok: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      };
    }

    if (user.status !== 'active') {
      return {
        ok: false,
        error: {
          code: 'USER_SUSPENDED',
          message: 'User account is not active',
        },
      };
    }

    // Update last activity
    await this.store.updateSession(session.id, {
      lastActivityAt: new Date(),
    });

    return {
      ok: true,
      data: { user, session },
    };
  }

  /**
   * Logout
   */
  async logout(sessionId: string, allSessions = false): Promise<AuthResult<{ sessionsRevoked: number }>> {
    if (allSessions) {
      const session = await this.store.findSession(sessionId);
      if (!session) {
        return {
          ok: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
          },
        };
      }
      
      const count = await this.store.revokeAllUserSessions(session.userId);
      return {
        ok: true,
        data: { sessionsRevoked: count },
      };
    }

    await this.store.revokeSession(sessionId, 'user_logout');
    return {
      ok: true,
      data: { sessionsRevoked: 1 },
    };
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string): Promise<AuthResult<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }>> {
    const tokenResult = await verifyToken(refreshToken, this.config.jwt);
    if (!tokenResult.ok) {
      return {
        ok: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Refresh token is invalid or expired',
        },
      };
    }

    const payload = tokenResult.data as TokenPayload;

    if (payload.type !== 'refresh') {
      return {
        ok: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Not a refresh token',
        },
      };
    }

    const session = await this.store.findSession(payload.sessionId);
    if (!session || session.revoked) {
      return {
        ok: false,
        error: {
          code: 'SESSION_REVOKED',
          message: 'Session has been revoked',
        },
      };
    }

    const user = await this.store.findUserById(payload.sub);
    if (!user) {
      return {
        ok: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      };
    }

    // Generate new tokens
    const newAccessToken = await createToken(
      {
        sub: user.id,
        sessionId: session.id,
        type: 'access',
        roles: user.roles.map(r => r.name),
      },
      this.config.jwt,
      this.config.jwt.accessTokenExpiry
    );

    const newRefreshToken = await createToken(
      {
        sub: user.id,
        sessionId: session.id,
        type: 'refresh',
      },
      this.config.jwt,
      this.config.jwt.refreshTokenExpiry
    );

    // Update session
    await this.store.updateSession(session.id, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      lastActivityAt: new Date(),
    });

    return {
      ok: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.config.jwt.accessTokenExpiry,
      },
    };
  }
}

/**
 * Create auth service with config
 */
export function createAuthService(store: AuthStore, config: AuthConfig): AuthService {
  return new AuthService(store, config);
}
