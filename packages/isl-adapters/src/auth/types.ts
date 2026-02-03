/**
 * ISL Auth Domain Adapter Types
 * 
 * Provides type definitions for authentication-related entity queries
 * in ISL verification. All adapters are offline-only (no network IO).
 * 
 * @module @isl-lang/adapters/auth
 */

/**
 * Tri-state value for expression evaluation
 * - true: condition is satisfied
 * - false: condition is not satisfied  
 * - 'unknown': cannot determine (fail-closed in verification)
 */
export type TriState = true | false | 'unknown';

// ============================================================================
// USER STATUS ENUM
// ============================================================================

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'INACTIVE' | 'SUSPENDED';

// ============================================================================
// ENTITY SCHEMAS
// ============================================================================

/**
 * User entity matching login.isl schema
 */
export interface UserEntity {
  /** Unique user identifier */
  id: string;
  /** User email address */
  email: string;
  /** Hashed password (never plain text) */
  password_hash: string;
  /** Current account status */
  status: UserStatus;
  /** Number of consecutive failed login attempts */
  failed_attempts: number;
  /** Last successful login timestamp */
  last_login: Date | null;
  /** Account creation timestamp */
  created_at: Date;
  /** Last modification timestamp */
  updated_at: Date;
}

/**
 * Session entity matching login.isl schema
 */
export interface SessionEntity {
  /** Unique session identifier */
  id: string;
  /** Associated user ID */
  user_id: string;
  /** Access token (minimum 32 chars) */
  access_token: string;
  /** Session expiration timestamp */
  expires_at: Date;
  /** Session creation timestamp */
  created_at: Date;
  /** Session status */
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

/**
 * Login attempt record for audit trail
 */
export interface LoginAttemptEntity {
  /** Unique attempt identifier */
  id: string;
  /** Associated user ID (if user exists) */
  user_id: string | null;
  /** Email used in attempt */
  email: string;
  /** Whether login succeeded */
  success: boolean;
  /** Attempt timestamp */
  timestamp: Date;
  /** Client IP address (for rate limiting) */
  ip_address: string;
  /** Failure reason if applicable */
  failure_reason?: string;
}

// ============================================================================
// FIXTURE STORE SCHEMA
// ============================================================================

/**
 * Complete fixture store for auth domain testing
 * This is the in-memory data source for verification
 */
export interface AuthFixtureStore {
  /** User entities by ID */
  users: Map<string, UserEntity>;
  /** Session entities by ID */
  sessions: Map<string, SessionEntity>;
  /** Login attempt records */
  attempts: LoginAttemptEntity[];
  /** Current "now" timestamp for testing time-based conditions */
  now: Date;
}

/**
 * Serializable fixture data for test setup
 */
export interface AuthFixtureData {
  users: UserEntity[];
  sessions: SessionEntity[];
  attempts?: LoginAttemptEntity[];
  now?: string | Date;
}

// ============================================================================
// AUTH ADAPTER INTERFACE
// ============================================================================

/**
 * Lookup criteria for entity queries
 */
export interface LookupCriteria {
  id?: string;
  email?: string;
  user_id?: string;
  [key: string]: unknown;
}

/**
 * Auth domain adapter interface for expression evaluation
 * 
 * All methods are synchronous - NO network IO allowed.
 * Must work entirely from in-memory fixtures or trace events.
 * 
 * Implements queries used in login.isl:
 * - Session.exists(id)
 * - User.lookup(id).last_login
 * - User.lookup(id).failed_attempts
 * - User.lookup_by_email(email).failed_attempts
 * - User.status
 */
export interface AuthAdapter {
  /**
   * Check if an entity exists
   * 
   * @param entityName - 'User' | 'Session' | 'LoginAttempt'
   * @param criteria - Lookup criteria (id, email, etc.)
   * @returns TriState - true/false/'unknown'
   */
  exists(entityName: string, criteria: LookupCriteria): TriState;

  /**
   * Lookup an entity by criteria
   * 
   * @param entityName - 'User' | 'Session' | 'LoginAttempt'
   * @param criteria - Lookup criteria (id, email, etc.)
   * @returns Entity or 'unknown' if not found
   */
  lookup(
    entityName: string,
    criteria: LookupCriteria
  ): UserEntity | SessionEntity | LoginAttemptEntity | 'unknown';

  /**
   * Lookup user by email (convenience method)
   * Maps to User.lookup_by_email(email) in ISL
   */
  lookupUserByEmail(email: string): UserEntity | 'unknown';

  /**
   * Lookup user by ID (convenience method)
   * Maps to User.lookup(id) in ISL
   */
  lookupUserById(id: string): UserEntity | 'unknown';

  /**
   * Check if session exists by ID
   * Maps to Session.exists(id) in ISL
   */
  sessionExists(id: string): TriState;

  /**
   * Get session by ID
   */
  getSession(id: string): SessionEntity | 'unknown';

  /**
   * Count entities matching criteria
   */
  count(entityName: string, criteria?: LookupCriteria): number;

  /**
   * Get all entities of a type
   */
  getAll(entityName: string): ReadonlyArray<UserEntity | SessionEntity | LoginAttemptEntity>;

  /**
   * Get current timestamp (for now() expressions)
   */
  getNow(): Date;

  /**
   * Check if adapter is offline-only (must always return true)
   */
  isOffline(): true;
}

// ============================================================================
// TRACE EVENT TYPES
// ============================================================================

/**
 * State snapshot from trace events
 */
export interface AuthStateSnapshot {
  users: Map<string, UserEntity>;
  sessions: Map<string, SessionEntity>;
  timestamp: number;
}

/**
 * Auth-specific trace event
 */
export interface AuthTraceEvent {
  id: string;
  type: 'call' | 'return' | 'state_change' | 'check' | 'error';
  timestamp: number;
  behavior?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: { code: string; message: string };
  stateBefore?: AuthStateSnapshot;
  stateAfter?: AuthStateSnapshot;
}

// ============================================================================
// ADAPTER OPTIONS
// ============================================================================

/**
 * Options for creating a fixture-based adapter
 */
export interface FixtureAdapterOptions {
  /** Initial fixture data */
  fixtures: AuthFixtureData;
  /** Strict mode: throw on invalid queries (default: false, returns 'unknown') */
  strict?: boolean;
}

/**
 * Options for creating a trace-based adapter
 */
export interface TraceAdapterOptions {
  /** Trace events to replay */
  events: AuthTraceEvent[];
  /** Which event's state to use ('before' | 'after' | 'latest') */
  stateMode?: 'before' | 'after' | 'latest';
  /** Behavior name to filter events (optional) */
  behavior?: string;
}

// ============================================================================
// FACTORY FUNCTIONS (implemented in concrete adapters)
// ============================================================================

/**
 * Create an auth adapter from fixture data
 */
export type CreateFixtureAdapter = (options: FixtureAdapterOptions) => AuthAdapter;

/**
 * Create an auth adapter from trace events
 */
export type CreateTraceAdapter = (options: TraceAdapterOptions) => AuthAdapter;
