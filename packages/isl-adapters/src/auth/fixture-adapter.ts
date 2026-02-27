/**
 * ISL Auth Fixture Adapter
 * 
 * In-memory adapter for evaluating auth domain expressions.
 * Uses fixture data as the source of truth - NO network IO.
 * 
 * @module @isl-lang/adapters/auth
 */

import type {
  TriState,
  AuthAdapter,
  AuthFixtureStore,
  AuthFixtureData,
  FixtureAdapterOptions,
  LookupCriteria,
  UserEntity,
  SessionEntity,
  LoginAttemptEntity,
} from './types.js';

// ============================================================================
// FIXTURE STORE HELPERS
// ============================================================================

/**
 * Create an empty fixture store
 */
function createEmptyStore(): AuthFixtureStore {
  return {
    users: new Map(),
    sessions: new Map(),
    attempts: [],
    now: new Date(),
  };
}

/**
 * Hydrate fixture store from serializable data
 */
function hydrateStore(data: AuthFixtureData): AuthFixtureStore {
  const store = createEmptyStore();

  // Hydrate users
  for (const user of data.users) {
    store.users.set(user.id, {
      ...user,
      last_login: user.last_login ? new Date(user.last_login) : null,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at),
    });
  }

  // Hydrate sessions
  for (const session of data.sessions) {
    store.sessions.set(session.id, {
      ...session,
      expires_at: new Date(session.expires_at),
      created_at: new Date(session.created_at),
    });
  }

  // Hydrate attempts
  if (data.attempts) {
    for (const attempt of data.attempts) {
      store.attempts.push({
        ...attempt,
        timestamp: new Date(attempt.timestamp),
      });
    }
  }

  // Set now timestamp
  if (data.now) {
    store.now = new Date(data.now);
  }

  return store;
}

/**
 * Match entity against criteria
 */
function matchesCriteria(
  entity: Record<string, unknown>,
  criteria: LookupCriteria
): boolean {
  for (const [key, value] of Object.entries(criteria)) {
    if (value === undefined) continue;
    
    const entityValue = entity[key];
    
    // Handle null comparison
    if (value === null && entityValue === null) continue;
    if (value === null || entityValue === null) return false;
    
    // Handle date comparison
    if (value instanceof Date && entityValue instanceof Date) {
      if (value.getTime() !== entityValue.getTime()) return false;
      continue;
    }
    
    // Direct comparison
    if (entityValue !== value) return false;
  }
  return true;
}

// ============================================================================
// FIXTURE ADAPTER IMPLEMENTATION
// ============================================================================

/**
 * FixtureAuthAdapter - In-memory adapter backed by fixture data
 * 
 * OFFLINE-ONLY GUARANTEE: This adapter performs no network IO.
 * All data comes from the fixture store provided at construction.
 */
export class FixtureAuthAdapter implements AuthAdapter {
  private readonly store: AuthFixtureStore;
  private readonly strict: boolean;

  constructor(options: FixtureAdapterOptions) {
    this.store = hydrateStore(options.fixtures);
    this.strict = options.strict ?? false;
  }

  // --------------------------------------------------------------------------
  // Core Entity Operations
  // --------------------------------------------------------------------------

  exists(entityName: string, criteria: LookupCriteria): TriState {
    const result = this.lookup(entityName, criteria);
    if (result === 'unknown') {
      return this.strict ? false : 'unknown';
    }
    return true;
  }

  lookup(
    entityName: string,
    criteria: LookupCriteria
  ): UserEntity | SessionEntity | LoginAttemptEntity | 'unknown' {
    const normalized = entityName.toLowerCase();

    switch (normalized) {
      case 'user':
        return this.lookupUser(criteria);
      case 'session':
        return this.lookupSession(criteria);
      case 'loginattempt':
      case 'login_attempt':
      case 'attempt':
        return this.lookupAttempt(criteria);
      default:
        return 'unknown';
    }
  }

  // --------------------------------------------------------------------------
  // User Operations
  // --------------------------------------------------------------------------

  lookupUserByEmail(email: string): UserEntity | 'unknown' {
    for (const user of this.store.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return 'unknown';
  }

  lookupUserById(id: string): UserEntity | 'unknown' {
    return this.store.users.get(id) ?? 'unknown';
  }

  private lookupUser(criteria: LookupCriteria): UserEntity | 'unknown' {
    // Handle direct ID lookup
    if (criteria.id && Object.keys(criteria).length === 1) {
      return this.lookupUserById(criteria.id);
    }

    // Handle email lookup
    if (criteria.email && Object.keys(criteria).length === 1) {
      return this.lookupUserByEmail(criteria.email);
    }

    // Handle general criteria matching
    for (const user of this.store.users.values()) {
      if (matchesCriteria(user as unknown as Record<string, unknown>, criteria)) {
        return user;
      }
    }

    return 'unknown';
  }

  // --------------------------------------------------------------------------
  // Session Operations
  // --------------------------------------------------------------------------

  sessionExists(id: string): TriState {
    const session = this.store.sessions.get(id);
    if (!session) return false;
    
    // Check if session is valid (not expired, not revoked)
    if (session.status !== 'ACTIVE') return false;
    if (session.expires_at <= this.store.now) return false;
    
    return true;
  }

  getSession(id: string): SessionEntity | 'unknown' {
    return this.store.sessions.get(id) ?? 'unknown';
  }

  private lookupSession(criteria: LookupCriteria): SessionEntity | 'unknown' {
    // Handle direct ID lookup
    if (criteria.id && Object.keys(criteria).length === 1) {
      return this.getSession(criteria.id);
    }

    // Handle user_id lookup
    if (criteria.user_id) {
      for (const session of this.store.sessions.values()) {
        if (
          session.user_id === criteria.user_id &&
          matchesCriteria(session as unknown as Record<string, unknown>, criteria)
        ) {
          return session;
        }
      }
      return 'unknown';
    }

    // Handle general criteria matching
    for (const session of this.store.sessions.values()) {
      if (matchesCriteria(session as unknown as Record<string, unknown>, criteria)) {
        return session;
      }
    }

    return 'unknown';
  }

  // --------------------------------------------------------------------------
  // Login Attempt Operations
  // --------------------------------------------------------------------------

  private lookupAttempt(criteria: LookupCriteria): LoginAttemptEntity | 'unknown' {
    for (const attempt of this.store.attempts) {
      if (matchesCriteria(attempt as unknown as Record<string, unknown>, criteria)) {
        return attempt;
      }
    }
    return 'unknown';
  }

  // --------------------------------------------------------------------------
  // Aggregate Operations
  // --------------------------------------------------------------------------

  count(entityName: string, criteria?: LookupCriteria): number {
    const all = this.getAll(entityName);
    
    if (!criteria || Object.keys(criteria).length === 0) {
      return all.length;
    }

    return all.filter((entity) =>
      matchesCriteria(entity as unknown as Record<string, unknown>, criteria)
    ).length;
  }

  getAll(
    entityName: string
  ): ReadonlyArray<UserEntity | SessionEntity | LoginAttemptEntity> {
    const normalized = entityName.toLowerCase();

    switch (normalized) {
      case 'user':
        return Array.from(this.store.users.values());
      case 'session':
        return Array.from(this.store.sessions.values());
      case 'loginattempt':
      case 'login_attempt':
      case 'attempt':
        return this.store.attempts;
      default:
        return [];
    }
  }

  getNow(): Date {
    return this.store.now;
  }

  // --------------------------------------------------------------------------
  // Offline Guarantee
  // --------------------------------------------------------------------------

  /**
   * Returns true - this adapter performs no network IO
   */
  isOffline(): true {
    return true;
  }

  // --------------------------------------------------------------------------
  // Store Mutation (for test setup)
  // --------------------------------------------------------------------------

  /**
   * Update the current timestamp (for time-based tests)
   */
  setNow(date: Date): void {
    this.store.now = date;
  }

  /**
   * Add or update a user
   */
  upsertUser(user: UserEntity): void {
    this.store.users.set(user.id, user);
  }

  /**
   * Add or update a session
   */
  upsertSession(session: SessionEntity): void {
    this.store.sessions.set(session.id, session);
  }

  /**
   * Add a login attempt
   */
  addAttempt(attempt: LoginAttemptEntity): void {
    this.store.attempts.push(attempt);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.store.users.clear();
    this.store.sessions.clear();
    this.store.attempts.length = 0;
  }

  /**
   * Create a snapshot of current state
   */
  snapshot(): AuthFixtureData {
    return {
      users: Array.from(this.store.users.values()),
      sessions: Array.from(this.store.sessions.values()),
      attempts: [...this.store.attempts],
      now: this.store.now.toISOString(),
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an auth adapter from fixture data
 * 
 * @example
 * ```typescript
 * const adapter = createFixtureAdapter({
 *   fixtures: {
 *     users: [
 *       { id: 'u1', email: 'test@example.com', status: 'ACTIVE', failed_attempts: 0, ... }
 *     ],
 *     sessions: [],
 *   }
 * });
 * 
 * // Use in verification
 * const user = adapter.lookupUserByEmail('test@example.com');
 * if (user !== 'unknown') {
 *   console.log(user.failed_attempts); // 0
 * }
 * ```
 */
export function createFixtureAdapter(options: FixtureAdapterOptions): AuthAdapter {
  return new FixtureAuthAdapter(options);
}

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create a minimal user entity for testing
 */
export function createTestUser(overrides: Partial<UserEntity> = {}): UserEntity {
  const now = new Date();
  return {
    id: overrides.id ?? `user-${Date.now()}`,
    email: overrides.email ?? 'test@example.com',
    password_hash: overrides.password_hash ?? 'hashed_password_here',
    status: overrides.status ?? 'ACTIVE',
    failed_attempts: overrides.failed_attempts ?? 0,
    last_login: overrides.last_login ?? null,
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

/**
 * Create a minimal session entity for testing
 */
export function createTestSession(
  userId: string,
  overrides: Partial<SessionEntity> = {}
): SessionEntity {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    id: overrides.id ?? `session-${Date.now()}`,
    user_id: userId,
    access_token: overrides.access_token ?? generateToken(32),
    expires_at: overrides.expires_at ?? oneHourLater,
    created_at: overrides.created_at ?? now,
    status: overrides.status ?? 'ACTIVE',
  };
}

/**
 * Generate a random token of specified length
 */
function generateToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
