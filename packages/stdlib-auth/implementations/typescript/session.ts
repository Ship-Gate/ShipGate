// ============================================================================
// Session Entity Implementation
// Satisfies: intents/session.isl
// ============================================================================

import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  Session,
  SessionId,
  UserId,
  IpAddress,
  SessionStatus,
  RevocationReason,
  SessionRepository,
  AuthConfig,
  DEFAULT_AUTH_CONFIG,
  AuthException,
  AuthErrorCode,
} from './types';

// ============================================================================
// Token Utilities
// ============================================================================

export function generateSessionToken(length: number = 64): string {
  // Generate cryptographically secure random bytes
  // 64 bytes = 512 bits of entropy
  return randomBytes(length).toString('base64url');
}

export function hashToken(token: string): string {
  // SHA-256 hash for storage
  return createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: string, tokenHash: string): boolean {
  // Constant-time comparison to prevent timing attacks
  const inputHash = hashToken(token);
  if (inputHash.length !== tokenHash.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < inputHash.length; i++) {
    result |= inputHash.charCodeAt(i) ^ tokenHash.charCodeAt(i);
  }
  return result === 0;
}

// ============================================================================
// Session Factory
// ============================================================================

export function createSession(params: {
  userId: UserId;
  ipAddress: IpAddress;
  userAgent?: string;
  deviceFingerprint?: string;
  duration: number;
  countryCode?: string;
  city?: string;
}): { session: Session; token: string } {
  const now = new Date();
  const token = generateSessionToken(DEFAULT_AUTH_CONFIG.tokenLength);
  const tokenHash = hashToken(token);

  const session: Session = {
    id: uuidv4(),
    token: '', // Never store plain token
    tokenHash,
    userId: params.userId,
    status: SessionStatus.ACTIVE,
    createdAt: now,
    expiresAt: new Date(now.getTime() + params.duration),
    lastActivityAt: now,
    revokedAt: null,
    revocationReason: null,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent ?? null,
    deviceFingerprint: params.deviceFingerprint ?? null,
    countryCode: params.countryCode ?? null,
    city: params.city ?? null,
  };

  return { session, token };
}

// ============================================================================
// Session Commands
// ============================================================================

export function revokeSession(
  session: Session,
  reason: RevocationReason
): Session {
  if (session.status !== SessionStatus.ACTIVE) {
    throw new AuthException(
      AuthErrorCode.SESSION_ALREADY_REVOKED,
      'Session is already revoked or expired',
      false,
      409
    );
  }

  return {
    ...session,
    status: SessionStatus.REVOKED,
    revokedAt: new Date(),
    revocationReason: reason,
  };
}

export function expireSession(session: Session): Session {
  return {
    ...session,
    status: SessionStatus.EXPIRED,
    revocationReason: RevocationReason.EXPIRED,
  };
}

export function supersedeSession(session: Session): Session {
  return {
    ...session,
    status: SessionStatus.SUPERSEDED,
    revokedAt: new Date(),
    revocationReason: RevocationReason.SESSION_LIMIT,
  };
}

export function extendSession(
  session: Session,
  additionalDuration: number
): Session {
  if (session.status !== SessionStatus.ACTIVE) {
    throw new AuthException(
      AuthErrorCode.SESSION_EXPIRED,
      'Cannot extend inactive session',
      false,
      400
    );
  }

  // Cap extension at 24 hours
  const maxExtension = 24 * 60 * 60 * 1000;
  const actualExtension = Math.min(additionalDuration, maxExtension);

  return {
    ...session,
    expiresAt: new Date(session.expiresAt.getTime() + actualExtension),
    lastActivityAt: new Date(),
  };
}

export function updateSessionActivity(session: Session): Session {
  if (session.status !== SessionStatus.ACTIVE) {
    return session;
  }

  return {
    ...session,
    lastActivityAt: new Date(),
  };
}

// ============================================================================
// Session Computed Properties
// ============================================================================

export function isSessionValid(session: Session): boolean {
  return (
    session.status === SessionStatus.ACTIVE &&
    session.expiresAt > new Date() &&
    session.revokedAt === null
  );
}

export function isSessionExpired(session: Session): boolean {
  return session.expiresAt <= new Date();
}

export function getTimeUntilExpiry(session: Session): number | null {
  if (!isSessionValid(session)) {
    return null;
  }
  return session.expiresAt.getTime() - Date.now();
}

export function getSessionDuration(session: Session): number {
  return Date.now() - session.createdAt.getTime();
}

export function getIdleTime(session: Session): number {
  return Date.now() - session.lastActivityAt.getTime();
}

// ============================================================================
// Session Validation
// ============================================================================

export function validateSessionInvariants(session: Session): void {
  // ID constraints
  if (!session.id) {
    throw new Error('Session ID is required');
  }

  if (!session.userId) {
    throw new Error('Session user_id is required');
  }

  // Token constraints
  if (!session.tokenHash || session.tokenHash.length < 64) {
    throw new Error('Invalid token hash');
  }

  // Time constraints
  if (session.expiresAt <= session.createdAt) {
    throw new Error('expiresAt must be after createdAt');
  }

  if (session.lastActivityAt < session.createdAt) {
    throw new Error('lastActivityAt must be after or equal to createdAt');
  }

  // Status constraints
  if (session.status === SessionStatus.REVOKED && !session.revokedAt) {
    throw new Error('Revoked session must have revokedAt timestamp');
  }

  if (session.status === SessionStatus.REVOKED && !session.revocationReason) {
    throw new Error('Revoked session must have revocation reason');
  }

  if (session.revokedAt && session.revokedAt < session.createdAt) {
    throw new Error('revokedAt must be after createdAt');
  }

  // IP address required
  if (!session.ipAddress) {
    throw new Error('Session IP address is required');
  }
}

// ============================================================================
// In-Memory Session Repository (for testing/reference)
// ============================================================================

export class InMemorySessionRepository implements SessionRepository {
  private sessions: Map<SessionId, Session> = new Map();
  private tokenHashIndex: Map<string, SessionId> = new Map();
  private userSessionsIndex: Map<UserId, Set<SessionId>> = new Map();

  async findById(id: SessionId): Promise<Session | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    
    // Auto-expire if needed
    if (session.status === SessionStatus.ACTIVE && isSessionExpired(session)) {
      const expired = expireSession(session);
      this.sessions.set(id, expired);
      return expired;
    }
    
    return session;
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const sessionId = this.tokenHashIndex.get(tokenHash);
    if (!sessionId) return null;
    return this.findById(sessionId);
  }

  async findActiveByUserId(userId: UserId): Promise<Session[]> {
    const sessionIds = this.userSessionsIndex.get(userId);
    if (!sessionIds) return [];

    const activeSessions: Session[] = [];
    for (const sessionId of sessionIds) {
      const session = await this.findById(sessionId);
      if (session && isSessionValid(session)) {
        activeSessions.push(session);
      }
    }

    // Sort by created_at descending
    return activeSessions.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async create(sessionData: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
    const now = new Date();
    const session: Session = {
      ...sessionData,
      id: uuidv4(),
      createdAt: now,
    };

    this.sessions.set(session.id, session);
    this.tokenHashIndex.set(session.tokenHash, session.id);

    // Update user sessions index
    if (!this.userSessionsIndex.has(session.userId)) {
      this.userSessionsIndex.set(session.userId, new Set());
    }
    this.userSessionsIndex.get(session.userId)!.add(session.id);

    return session;
  }

  async update(id: SessionId, data: Partial<Session>): Promise<Session> {
    const existing = this.sessions.get(id);
    if (!existing) {
      throw new AuthException(
        AuthErrorCode.SESSION_NOT_FOUND,
        'Session not found',
        false,
        404
      );
    }

    const updated: Session = {
      ...existing,
      ...data,
      id: existing.id, // Prevent ID change
      createdAt: existing.createdAt, // Prevent createdAt change
      userId: existing.userId, // Prevent userId change
    };

    this.sessions.set(id, updated);
    return updated;
  }

  async revokeAllForUser(
    userId: UserId,
    reason: RevocationReason,
    exceptSessionId?: SessionId
  ): Promise<number> {
    const sessionIds = this.userSessionsIndex.get(userId);
    if (!sessionIds) return 0;

    let revokedCount = 0;
    const now = new Date();

    for (const sessionId of sessionIds) {
      if (exceptSessionId && sessionId === exceptSessionId) {
        continue;
      }

      const session = this.sessions.get(sessionId);
      if (session && session.status === SessionStatus.ACTIVE) {
        this.sessions.set(sessionId, {
          ...session,
          status: SessionStatus.REVOKED,
          revokedAt: now,
          revocationReason: reason,
        });
        revokedCount++;
      }
    }

    return revokedCount;
  }

  async countActiveForUser(userId: UserId): Promise<number> {
    const activeSessions = await this.findActiveByUserId(userId);
    return activeSessions.length;
  }

  async deleteExpired(): Promise<number> {
    let deletedCount = 0;
    const now = new Date();

    for (const [sessionId, session] of this.sessions) {
      if (
        session.status !== SessionStatus.ACTIVE ||
        session.expiresAt <= now
      ) {
        // Remove from indexes
        this.tokenHashIndex.delete(session.tokenHash);
        const userSessions = this.userSessionsIndex.get(session.userId);
        if (userSessions) {
          userSessions.delete(sessionId);
        }
        this.sessions.delete(sessionId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // Testing helpers
  clear(): void {
    this.sessions.clear();
    this.tokenHashIndex.clear();
    this.userSessionsIndex.clear();
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  getAllForUser(userId: UserId): Session[] {
    const sessionIds = this.userSessionsIndex.get(userId);
    if (!sessionIds) return [];
    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id)!)
      .filter(Boolean);
  }
}
