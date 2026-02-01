/**
 * Auth Types
 */

// ============================================
// Core Types
// ============================================

export interface User {
  id: string;
  email: string;
  username?: string;
  passwordHash: string;
  phone?: string;
  
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  
  roles: Role[];
  permissions: Permission[];
}

export type UserStatus = 
  | 'pending_verification'
  | 'active'
  | 'suspended'
  | 'locked'
  | 'deleted';

export interface Session {
  id: string;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  revokeReason?: string;
}

// ============================================
// RBAC Types
// ============================================

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  parentId?: string;
  inheritsPermissions: boolean;
  createdAt: Date;
  isSystemRole: boolean;
}

export interface Permission {
  id: string;
  resource: string;
  action: PermissionAction;
  conditions?: Record<string, unknown>;
}

export type PermissionAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'admin'
  | 'all';

// ============================================
// OAuth Types
// ============================================

export interface OAuthConnection {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  
  email?: string;
  name?: string;
  avatarUrl?: string;
  
  connectedAt: Date;
  lastUsedAt?: Date;
}

export type OAuthProvider =
  | 'google'
  | 'github'
  | 'apple'
  | 'microsoft'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'discord'
  | 'slack';

// ============================================
// MFA Types
// ============================================

export interface MFADevice {
  id: string;
  userId: string;
  type: MFAType;
  
  secret?: string;
  target?: string;
  recoveryCodes?: string[];
  
  name?: string;
  verified: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

export type MFAType =
  | 'totp'
  | 'sms'
  | 'email'
  | 'webauthn'
  | 'push';

// ============================================
// API Key Types
// ============================================

export interface APIKey {
  id: string;
  userId?: string;
  
  keyPrefix: string;
  keyHash: string;
  
  name: string;
  scopes: string[];
  permissions: Permission[];
  
  rateLimit?: number;
  rateLimitWindow?: number;
  
  createdAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  revoked: boolean;
}

// ============================================
// Config Types
// ============================================

export interface AuthConfig {
  jwt: JWTConfig;
  password: PasswordPolicy;
  session: SessionPolicy;
  rateLimit: RateLimitPolicy;
}

export interface JWTConfig {
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512';
  secret?: string;
  publicKey?: string;
  privateKey?: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  issuer: string;
  audience: string;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  maxAgeDays?: number;
  historyCount?: number;
}

export interface SessionPolicy {
  maxDuration: number;
  idleTimeout: number;
  maxConcurrentSessions?: number;
  requireMfa: boolean;
  trustedIps?: string[];
}

export interface RateLimitPolicy {
  loginAttempts: number;
  loginWindow: number;
  lockoutDuration: number;
  apiRequestsPerMinute?: number;
}

// ============================================
// Result Types
// ============================================

export type AuthResult<T> = 
  | { ok: true; data: T }
  | { ok: false; error: AuthError };

export interface AuthError {
  code: string;
  message: string;
  retriable?: boolean;
  data?: Record<string, unknown>;
}

// ============================================
// Input Types
// ============================================

export interface LoginInput {
  email?: string;
  username?: string;
  password: string;
  mfaCode?: string;
  deviceInfo?: {
    ipAddress?: string;
    userAgent?: string;
    fingerprint?: string;
  };
  rememberMe?: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  username?: string;
  phone?: string;
  name?: string;
  termsAccepted: boolean;
  marketingConsent?: boolean;
  inviteCode?: string;
}

export interface TokenPayload {
  sub: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  type: 'access' | 'refresh';
  sessionId: string;
  roles?: string[];
  permissions?: string[];
}
