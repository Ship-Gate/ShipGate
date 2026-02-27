/**
 * ISL Auth Trace Adapter
 * 
 * Adapter that reconstructs auth domain state from proof bundle trace events.
 * Uses trace events as the source of truth - NO network IO.
 * 
 * @module @isl-lang/adapters/auth
 */

import type {
  TriState,
  AuthAdapter,
  AuthStateSnapshot,
  AuthTraceEvent,
  TraceAdapterOptions,
  LookupCriteria,
  UserEntity,
  SessionEntity,
  LoginAttemptEntity,
} from './types.js';

// ============================================================================
// STATE RECONSTRUCTION
// ============================================================================

/**
 * Reconstruct auth state from trace events
 * 
 * Strategy based on stateMode:
 * - 'before': Use stateBefore from first call event
 * - 'after': Use stateAfter from last return event
 * - 'latest': Use most recent state snapshot from any event
 */
function reconstructState(
  events: AuthTraceEvent[],
  mode: 'before' | 'after' | 'latest'
): AuthStateSnapshot | null {
  if (events.length === 0) {
    return null;
  }

  // Sort events by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  switch (mode) {
    case 'before': {
      // Find first call event with stateBefore
      const callEvent = sorted.find((e) => e.type === 'call' && e.stateBefore);
      return callEvent?.stateBefore ?? null;
    }

    case 'after': {
      // Find last return event with stateAfter
      const returnEvents = sorted.filter((e) => e.type === 'return' && e.stateAfter);
      const lastReturn = returnEvents[returnEvents.length - 1];
      return lastReturn?.stateAfter ?? null;
    }

    case 'latest': {
      // Find most recent state snapshot
      let latestSnapshot: AuthStateSnapshot | null = null;
      let latestTimestamp = -1;

      for (const event of sorted) {
        if (event.stateAfter && event.timestamp > latestTimestamp) {
          latestSnapshot = event.stateAfter;
          latestTimestamp = event.timestamp;
        }
        if (event.stateBefore && event.timestamp > latestTimestamp) {
          latestSnapshot = event.stateBefore;
          latestTimestamp = event.timestamp;
        }
      }

      return latestSnapshot;
    }

    default:
      return null;
  }
}

/**
 * Extract state from generic trace events
 * Handles both typed AuthStateSnapshot and untyped EntityStoreSnapshot
 */
function extractStateFromEvent(
  event: AuthTraceEvent,
  field: 'stateBefore' | 'stateAfter'
): AuthStateSnapshot | null {
  const snapshot = event[field];
  if (!snapshot) return null;

  // If already properly typed
  if (snapshot.users instanceof Map && snapshot.sessions instanceof Map) {
    return snapshot;
  }

  // If coming from generic EntityStoreSnapshot, convert
  const genericSnapshot = snapshot as unknown as {
    entities?: Map<string, Map<string, Record<string, unknown>>>;
    timestamp?: number;
  };

  if (genericSnapshot.entities) {
    const users = new Map<string, UserEntity>();
    const sessions = new Map<string, SessionEntity>();

    // Extract User entities
    const userEntities = genericSnapshot.entities.get('User');
    if (userEntities) {
      for (const [id, data] of userEntities) {
        users.set(id, data as unknown as UserEntity);
      }
    }

    // Extract Session entities
    const sessionEntities = genericSnapshot.entities.get('Session');
    if (sessionEntities) {
      for (const [id, data] of sessionEntities) {
        sessions.set(id, data as unknown as SessionEntity);
      }
    }

    return {
      users,
      sessions,
      timestamp: genericSnapshot.timestamp ?? event.timestamp,
    };
  }

  return null;
}

// ============================================================================
// TRACE ADAPTER IMPLEMENTATION
// ============================================================================

/**
 * TraceAuthAdapter - Adapter backed by proof bundle trace events
 * 
 * OFFLINE-ONLY GUARANTEE: This adapter performs no network IO.
 * All data is reconstructed from trace events provided at construction.
 */
export class TraceAuthAdapter implements AuthAdapter {
  private readonly events: AuthTraceEvent[];
  private readonly stateMode: 'before' | 'after' | 'latest';
  private readonly behavior: string | undefined;
  private readonly state: AuthStateSnapshot | null;
  private readonly now: Date;

  constructor(options: TraceAdapterOptions) {
    this.stateMode = options.stateMode ?? 'after';
    this.behavior = options.behavior;

    // Filter events by behavior if specified
    this.events = options.behavior
      ? options.events.filter((e) => e.behavior === options.behavior)
      : options.events;

    // Reconstruct state from events
    this.state = this.reconstructStateFromEvents();

    // Set "now" to the latest event timestamp
    const latestEvent = this.events
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    this.now = latestEvent
      ? new Date(latestEvent.timestamp)
      : new Date();
  }

  private reconstructStateFromEvents(): AuthStateSnapshot | null {
    // First try the standard reconstruction
    const standardState = reconstructState(this.events, this.stateMode);
    if (standardState) {
      return standardState;
    }

    // Fallback: Build state from individual events
    return this.buildStateFromEventData();
  }

  private buildStateFromEventData(): AuthStateSnapshot | null {
    const users = new Map<string, UserEntity>();
    const sessions = new Map<string, SessionEntity>();
    let latestTimestamp = 0;

    for (const event of this.events) {
      // Try to extract state snapshots
      const beforeState = extractStateFromEvent(event, 'stateBefore');
      const afterState = extractStateFromEvent(event, 'stateAfter');

      // Merge state based on mode
      const stateToUse =
        this.stateMode === 'before'
          ? beforeState
          : this.stateMode === 'after'
          ? afterState ?? beforeState
          : afterState ?? beforeState;

      if (stateToUse) {
        // Merge users
        for (const [id, user] of stateToUse.users) {
          if (!users.has(id) || event.timestamp > latestTimestamp) {
            users.set(id, user);
          }
        }

        // Merge sessions
        for (const [id, session] of stateToUse.sessions) {
          if (!sessions.has(id) || event.timestamp > latestTimestamp) {
            sessions.set(id, session);
          }
        }

        latestTimestamp = Math.max(latestTimestamp, stateToUse.timestamp);
      }

      // Also extract from event output (for return events)
      if (event.type === 'return' && event.output) {
        this.extractEntitiesFromOutput(event.output, users, sessions);
      }
    }

    if (users.size === 0 && sessions.size === 0) {
      return null;
    }

    return {
      users,
      sessions,
      timestamp: latestTimestamp || Date.now(),
    };
  }

  private extractEntitiesFromOutput(
    output: unknown,
    users: Map<string, UserEntity>,
    sessions: Map<string, SessionEntity>
  ): void {
    if (!output || typeof output !== 'object') return;

    const result = output as Record<string, unknown>;

    // Extract session from result.session
    if (result.session && typeof result.session === 'object') {
      const session = result.session as Record<string, unknown>;
      if (session.id && typeof session.id === 'string') {
        sessions.set(session.id, session as unknown as SessionEntity);
      }
    }

    // Extract user from result.user
    if (result.user && typeof result.user === 'object') {
      const user = result.user as Record<string, unknown>;
      if (user.id && typeof user.id === 'string') {
        users.set(user.id, user as unknown as UserEntity);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Core Entity Operations
  // --------------------------------------------------------------------------

  exists(entityName: string, criteria: LookupCriteria): TriState {
    if (!this.state) return 'unknown';

    const result = this.lookup(entityName, criteria);
    if (result === 'unknown') return 'unknown';
    return true;
  }

  lookup(
    entityName: string,
    criteria: LookupCriteria
  ): UserEntity | SessionEntity | LoginAttemptEntity | 'unknown' {
    if (!this.state) return 'unknown';

    const normalized = entityName.toLowerCase();

    switch (normalized) {
      case 'user':
        return this.lookupUserInternal(criteria);
      case 'session':
        return this.lookupSessionInternal(criteria);
      case 'loginattempt':
      case 'login_attempt':
      case 'attempt':
        // Login attempts would need to be extracted from trace events
        return this.lookupAttemptFromEvents(criteria);
      default:
        return 'unknown';
    }
  }

  // --------------------------------------------------------------------------
  // User Operations
  // --------------------------------------------------------------------------

  lookupUserByEmail(email: string): UserEntity | 'unknown' {
    if (!this.state) return 'unknown';

    for (const user of this.state.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return 'unknown';
  }

  lookupUserById(id: string): UserEntity | 'unknown' {
    if (!this.state) return 'unknown';
    return this.state.users.get(id) ?? 'unknown';
  }

  private lookupUserInternal(criteria: LookupCriteria): UserEntity | 'unknown' {
    if (!this.state) return 'unknown';

    // Handle direct ID lookup
    if (criteria.id && Object.keys(criteria).length === 1) {
      return this.lookupUserById(criteria.id);
    }

    // Handle email lookup
    if (criteria.email && Object.keys(criteria).length === 1) {
      return this.lookupUserByEmail(criteria.email);
    }

    // Handle general criteria matching
    for (const user of this.state.users.values()) {
      if (this.matchesCriteria(user as unknown as Record<string, unknown>, criteria)) {
        return user;
      }
    }

    return 'unknown';
  }

  // --------------------------------------------------------------------------
  // Session Operations
  // --------------------------------------------------------------------------

  sessionExists(id: string): TriState {
    if (!this.state) return 'unknown';

    const session = this.state.sessions.get(id);
    if (!session) return false;

    // Check if session is valid (not expired, not revoked)
    if (session.status && session.status !== 'ACTIVE') return false;

    const expiresAt = session.expires_at instanceof Date
      ? session.expires_at
      : new Date(session.expires_at as unknown as string | number);

    if (expiresAt <= this.now) return false;

    return true;
  }

  getSession(id: string): SessionEntity | 'unknown' {
    if (!this.state) return 'unknown';
    return this.state.sessions.get(id) ?? 'unknown';
  }

  private lookupSessionInternal(criteria: LookupCriteria): SessionEntity | 'unknown' {
    if (!this.state) return 'unknown';

    // Handle direct ID lookup
    if (criteria.id && Object.keys(criteria).length === 1) {
      return this.getSession(criteria.id);
    }

    // Handle general criteria matching
    for (const session of this.state.sessions.values()) {
      if (this.matchesCriteria(session as unknown as Record<string, unknown>, criteria)) {
        return session;
      }
    }

    return 'unknown';
  }

  // --------------------------------------------------------------------------
  // Login Attempt Operations (from events)
  // --------------------------------------------------------------------------

  private lookupAttemptFromEvents(
    criteria: LookupCriteria
  ): LoginAttemptEntity | 'unknown' {
    // Reconstruct login attempts from call/return events
    for (const event of this.events) {
      if (event.type === 'call' && event.behavior?.toLowerCase().includes('login')) {
        const attempt = this.eventToAttempt(event);
        if (attempt && this.matchesCriteria(attempt as unknown as Record<string, unknown>, criteria)) {
          return attempt;
        }
      }
    }
    return 'unknown';
  }

  private eventToAttempt(event: AuthTraceEvent): LoginAttemptEntity | null {
    if (!event.input) return null;

    // Find matching return event
    const returnEvent = this.events.find(
      (e) =>
        e.type === 'return' &&
        e.behavior === event.behavior &&
        e.timestamp > event.timestamp
    );

    return {
      id: event.id,
      user_id: null,
      email: (event.input.email as string) ?? '',
      success: !returnEvent?.error,
      timestamp: new Date(event.timestamp),
      ip_address: (event.input.ip as string) ?? 'unknown',
      failure_reason: returnEvent?.error?.message,
    };
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
      this.matchesCriteria(entity as unknown as Record<string, unknown>, criteria)
    ).length;
  }

  getAll(
    entityName: string
  ): ReadonlyArray<UserEntity | SessionEntity | LoginAttemptEntity> {
    if (!this.state) return [];

    const normalized = entityName.toLowerCase();

    switch (normalized) {
      case 'user':
        return Array.from(this.state.users.values());
      case 'session':
        return Array.from(this.state.sessions.values());
      case 'loginattempt':
      case 'login_attempt':
      case 'attempt':
        return this.getAllAttemptsFromEvents();
      default:
        return [];
    }
  }

  private getAllAttemptsFromEvents(): LoginAttemptEntity[] {
    const attempts: LoginAttemptEntity[] = [];

    for (const event of this.events) {
      if (event.type === 'call' && event.behavior?.toLowerCase().includes('login')) {
        const attempt = this.eventToAttempt(event);
        if (attempt) {
          attempts.push(attempt);
        }
      }
    }

    return attempts;
  }

  getNow(): Date {
    return this.now;
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
  // Utilities
  // --------------------------------------------------------------------------

  private matchesCriteria(
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
      if (value instanceof Date) {
        const entityDate =
          entityValue instanceof Date
            ? entityValue
            : new Date(entityValue as string | number);
        if (value.getTime() !== entityDate.getTime()) return false;
        continue;
      }

      // Direct comparison
      if (entityValue !== value) return false;
    }
    return true;
  }

  // --------------------------------------------------------------------------
  // Trace Event Access (for debugging/advanced use)
  // --------------------------------------------------------------------------

  /**
   * Get all trace events
   */
  getEvents(): ReadonlyArray<AuthTraceEvent> {
    return this.events;
  }

  /**
   * Get events by type
   */
  getEventsByType(type: AuthTraceEvent['type']): ReadonlyArray<AuthTraceEvent> {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events by behavior
   */
  getEventsByBehavior(behavior: string): ReadonlyArray<AuthTraceEvent> {
    return this.events.filter((e) => e.behavior === behavior);
  }

  /**
   * Check if state was successfully reconstructed
   */
  hasState(): boolean {
    return this.state !== null;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an auth adapter from trace events
 * 
 * @example
 * ```typescript
 * // From proof bundle
 * const bundle = await loadProofBundle('proof.json');
 * const adapter = createTraceAdapter({
 *   events: bundle.trace.events,
 *   stateMode: 'after',
 *   behavior: 'UserLogin',
 * });
 * 
 * // Check if user exists after login
 * const user = adapter.lookupUserById('user-123');
 * if (user !== 'unknown') {
 *   console.log(user.failed_attempts);
 * }
 * ```
 */
export function createTraceAdapter(options: TraceAdapterOptions): AuthAdapter {
  return new TraceAuthAdapter(options);
}

// ============================================================================
// TRACE EVENT HELPERS
// ============================================================================

/**
 * Create a minimal trace event for testing
 */
export function createTestTraceEvent(
  overrides: Partial<AuthTraceEvent> = {}
): AuthTraceEvent {
  return {
    id: overrides.id ?? `event-${Date.now()}`,
    type: overrides.type ?? 'call',
    timestamp: overrides.timestamp ?? Date.now(),
    behavior: overrides.behavior ?? 'UserLogin',
    input: overrides.input,
    output: overrides.output,
    error: overrides.error,
    stateBefore: overrides.stateBefore,
    stateAfter: overrides.stateAfter,
  };
}

/**
 * Create a state snapshot for testing
 */
export function createTestStateSnapshot(
  users: UserEntity[],
  sessions: SessionEntity[]
): AuthStateSnapshot {
  const userMap = new Map<string, UserEntity>();
  const sessionMap = new Map<string, SessionEntity>();

  for (const user of users) {
    userMap.set(user.id, user);
  }

  for (const session of sessions) {
    sessionMap.set(session.id, session);
  }

  return {
    users: userMap,
    sessions: sessionMap,
    timestamp: Date.now(),
  };
}
