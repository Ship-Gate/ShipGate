/**
 * Session Management
 */

import { v4 as uuid } from 'uuid';
import type { Session, SessionPolicy, AuthResult } from './types';

export interface SessionStore {
  create(session: Omit<Session, 'id'>): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  update(id: string, updates: Partial<Session>): Promise<Session>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<number>;
  deleteExpired(): Promise<number>;
}

export class SessionManager {
  constructor(
    private store: SessionStore,
    private policy: SessionPolicy
  ) {}

  /**
   * Create a new session
   */
  async create(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    }
  ): Promise<AuthResult<Session>> {
    // Check concurrent sessions limit
    if (this.policy.maxConcurrentSessions) {
      const existingSessions = await this.store.findByUserId(userId);
      const activeSessions = existingSessions.filter(
        (s) => !s.revoked && s.expiresAt > new Date()
      );

      if (activeSessions.length >= this.policy.maxConcurrentSessions) {
        // Revoke oldest session
        const oldest = activeSessions.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )[0];
        await this.revoke(oldest.id, 'max_sessions_exceeded');
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.policy.maxDuration);

    const session = await this.store.create({
      userId,
      accessToken,
      refreshToken,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      deviceFingerprint: metadata?.deviceFingerprint,
      createdAt: now,
      expiresAt,
      lastActivityAt: now,
      revoked: false,
    });

    return { ok: true, data: session };
  }

  /**
   * Validate a session
   */
  async validate(sessionId: string): Promise<AuthResult<Session>> {
    const session = await this.store.findById(sessionId);

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

    const now = new Date();

    // Check expiry
    if (session.expiresAt < now) {
      return {
        ok: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
        },
      };
    }

    // Check idle timeout
    const idleTime = now.getTime() - session.lastActivityAt.getTime();
    if (idleTime > this.policy.idleTimeout) {
      return {
        ok: false,
        error: {
          code: 'SESSION_IDLE_TIMEOUT',
          message: 'Session timed out due to inactivity',
        },
      };
    }

    // Update last activity
    await this.store.update(sessionId, { lastActivityAt: now });

    return { ok: true, data: session };
  }

  /**
   * Revoke a session
   */
  async revoke(sessionId: string, reason?: string): Promise<AuthResult<void>> {
    const session = await this.store.findById(sessionId);
    
    if (!session) {
      return {
        ok: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      };
    }

    await this.store.update(sessionId, {
      revoked: true,
      revokedAt: new Date(),
      revokeReason: reason,
    });

    return { ok: true, data: undefined };
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
    const sessions = await this.store.findByUserId(userId);
    let count = 0;

    for (const session of sessions) {
      if (session.id !== exceptSessionId && !session.revoked) {
        await this.revoke(session.id, 'revoke_all');
        count++;
      }
    }

    return count;
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    const sessions = await this.store.findByUserId(userId);
    const now = new Date();

    return sessions.filter(
      (s) => !s.revoked && s.expiresAt > now
    );
  }

  /**
   * Extend session
   */
  async extend(sessionId: string): Promise<AuthResult<Session>> {
    const session = await this.store.findById(sessionId);

    if (!session || session.revoked) {
      return {
        ok: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or revoked',
        },
      };
    }

    const newExpiresAt = new Date(Date.now() + this.policy.maxDuration);

    const updated = await this.store.update(sessionId, {
      expiresAt: newExpiresAt,
      lastActivityAt: new Date(),
    });

    return { ok: true, data: updated };
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(): Promise<number> {
    return this.store.deleteExpired();
  }
}

/**
 * In-memory session store (for development/testing)
 */
export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  async create(session: Omit<Session, 'id'>): Promise<Session> {
    const id = uuid();
    const newSession = { ...session, id };
    this.sessions.set(id, newSession);
    return newSession;
  }

  async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId
    );
  }

  async update(id: string, updates: Partial<Session>): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error('Session not found');
    }
    const updated = { ...session, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteByUserId(userId: string): Promise<number> {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }
}

/**
 * Create session manager
 */
export function createSessionManager(
  store: SessionStore,
  policy: SessionPolicy
): SessionManager {
  return new SessionManager(store, policy);
}
