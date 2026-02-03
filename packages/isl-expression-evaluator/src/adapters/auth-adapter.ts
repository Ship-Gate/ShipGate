// ============================================================================
// ISL Expression Evaluator - Auth Domain Adapter
// ============================================================================
//
// Fixture-based adapter for auth domain entities:
// - User.exists(id) - Check if user exists by ID
// - User.lookup(email) - Find user by email
// - Session.exists(id) - Check if session exists
// - Session.lookup(token) - Find session by token
//
// Runs entirely offline using in-memory fixtures.
// ============================================================================

import {
  BaseDomainAdapter,
  type FunctionResolution,
  type PropertyResolution,
  type AdapterValue,
} from '../domain-adapter.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * User entity fixture
 */
export interface UserFixture {
  id: string;
  email: string;
  name?: string;
  role?: string;
  active?: boolean;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Session entity fixture
 */
export interface SessionFixture {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * API Key entity fixture
 */
export interface ApiKeyFixture {
  id: string;
  userId: string;
  key: string;
  name?: string;
  scopes?: string[];
  expiresAt?: string;
  lastUsedAt?: string;
}

/**
 * Auth domain fixtures
 */
export interface AuthFixtures {
  users?: UserFixture[];
  sessions?: SessionFixture[];
  apiKeys?: ApiKeyFixture[];
  /** Current authenticated user (for User.current) */
  currentUser?: UserFixture;
  /** Current session (for Session.current) */
  currentSession?: SessionFixture;
}

/**
 * Options for the auth adapter
 */
export interface AuthAdapterOptions {
  /** Initial fixtures */
  fixtures?: AuthFixtures;
  /** Case-insensitive email lookup (default: true) */
  caseInsensitiveEmail?: boolean;
}

// ============================================================================
// AUTH DOMAIN ADAPTER
// ============================================================================

/**
 * Auth domain adapter for offline evaluation of User, Session, ApiKey expressions
 * 
 * @example
 * ```typescript
 * const adapter = new AuthDomainAdapter({
 *   fixtures: {
 *     users: [
 *       { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
 *       { id: 'user-2', email: 'bob@example.com', name: 'Bob' },
 *     ],
 *     currentUser: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
 *   }
 * });
 * 
 * // User.exists({ id: 'user-1' }) -> true
 * // User.lookup({ email: 'alice@example.com' }) -> { id: 'user-1', ... }
 * // User.current.email -> 'alice@example.com'
 * ```
 */
export class AuthDomainAdapter extends BaseDomainAdapter {
  readonly domain = 'auth';
  protected readonly entities = new Set(['User', 'Session', 'ApiKey']);

  private users: Map<string, UserFixture> = new Map();
  private usersByEmail: Map<string, UserFixture> = new Map();
  private sessions: Map<string, SessionFixture> = new Map();
  private sessionsByToken: Map<string, SessionFixture> = new Map();
  private apiKeys: Map<string, ApiKeyFixture> = new Map();
  private apiKeysByKey: Map<string, ApiKeyFixture> = new Map();
  
  private currentUser: UserFixture | undefined;
  private currentSession: SessionFixture | undefined;
  private caseInsensitiveEmail: boolean;

  constructor(options: AuthAdapterOptions = {}) {
    super();
    this.caseInsensitiveEmail = options.caseInsensitiveEmail ?? true;
    
    if (options.fixtures) {
      this.loadFixtures(options.fixtures);
    }
  }

  /**
   * Load fixtures into the adapter
   */
  loadFixtures(fixtures: AuthFixtures): void {
    // Load users
    if (fixtures.users) {
      for (const user of fixtures.users) {
        this.users.set(user.id, user);
        const emailKey = this.caseInsensitiveEmail 
          ? user.email.toLowerCase() 
          : user.email;
        this.usersByEmail.set(emailKey, user);
      }
    }

    // Load sessions
    if (fixtures.sessions) {
      for (const session of fixtures.sessions) {
        this.sessions.set(session.id, session);
        this.sessionsByToken.set(session.token, session);
      }
    }

    // Load API keys
    if (fixtures.apiKeys) {
      for (const apiKey of fixtures.apiKeys) {
        this.apiKeys.set(apiKey.id, apiKey);
        this.apiKeysByKey.set(apiKey.key, apiKey);
      }
    }

    // Set current user/session
    this.currentUser = fixtures.currentUser;
    this.currentSession = fixtures.currentSession;
  }

  /**
   * Clear all fixtures
   */
  clearFixtures(): void {
    this.users.clear();
    this.usersByEmail.clear();
    this.sessions.clear();
    this.sessionsByToken.clear();
    this.apiKeys.clear();
    this.apiKeysByKey.clear();
    this.currentUser = undefined;
    this.currentSession = undefined;
  }

  /**
   * Add a single user fixture
   */
  addUser(user: UserFixture): void {
    this.users.set(user.id, user);
    const emailKey = this.caseInsensitiveEmail 
      ? user.email.toLowerCase() 
      : user.email;
    this.usersByEmail.set(emailKey, user);
  }

  /**
   * Add a single session fixture
   */
  addSession(session: SessionFixture): void {
    this.sessions.set(session.id, session);
    this.sessionsByToken.set(session.token, session);
  }

  /**
   * Set the current authenticated user
   */
  setCurrentUser(user: UserFixture | undefined): void {
    this.currentUser = user;
    if (user) {
      this.addUser(user);
    }
  }

  // ============================================================================
  // FUNCTION RESOLUTION
  // ============================================================================

  resolveFunction(entity: string, method: string, args: unknown[]): FunctionResolution {
    if (!this.canHandle(entity)) {
      return this.unhandled(`Entity ${entity} not handled by auth adapter`);
    }

    switch (entity) {
      case 'User':
        return this.resolveUserFunction(method, args);
      case 'Session':
        return this.resolveSessionFunction(method, args);
      case 'ApiKey':
        return this.resolveApiKeyFunction(method, args);
      default:
        return this.unhandled(`Unknown entity: ${entity}`);
    }
  }

  private resolveUserFunction(method: string, args: unknown[]): FunctionResolution {
    switch (method) {
      case 'exists':
        return this.userExists(args);
      case 'lookup':
        return this.userLookup(args);
      case 'count':
        return this.resolved(this.users.size);
      case 'getAll':
        return this.resolved(Array.from(this.users.values()));
      default:
        return this.unhandled(`Unknown User method: ${method}`);
    }
  }

  private resolveSessionFunction(method: string, args: unknown[]): FunctionResolution {
    switch (method) {
      case 'exists':
        return this.sessionExists(args);
      case 'lookup':
        return this.sessionLookup(args);
      case 'count':
        return this.resolved(this.sessions.size);
      default:
        return this.unhandled(`Unknown Session method: ${method}`);
    }
  }

  private resolveApiKeyFunction(method: string, args: unknown[]): FunctionResolution {
    switch (method) {
      case 'exists':
        return this.apiKeyExists(args);
      case 'lookup':
        return this.apiKeyLookup(args);
      case 'count':
        return this.resolved(this.apiKeys.size);
      default:
        return this.unhandled(`Unknown ApiKey method: ${method}`);
    }
  }

  // ============================================================================
  // USER METHODS
  // ============================================================================

  private userExists(args: unknown[]): FunctionResolution {
    const criteria = this.extractCriteria(args);
    if (!criteria) {
      return this.resolved(this.users.size > 0);
    }

    // Check by ID
    if (criteria.id) {
      const exists = this.users.has(String(criteria.id));
      return this.resolved(exists);
    }

    // Check by email
    if (criteria.email) {
      const emailKey = this.caseInsensitiveEmail 
        ? String(criteria.email).toLowerCase() 
        : String(criteria.email);
      const exists = this.usersByEmail.has(emailKey);
      return this.resolved(exists);
    }

    // Generic search
    const found = this.findUser(criteria);
    return this.resolved(found !== undefined);
  }

  private userLookup(args: unknown[]): FunctionResolution {
    const criteria = this.extractCriteria(args);
    if (!criteria) {
      return this.resolved(null, 'No criteria provided for lookup');
    }

    // Lookup by ID
    if (criteria.id) {
      const user = this.users.get(String(criteria.id));
      return this.resolved(user ?? null);
    }

    // Lookup by email
    if (criteria.email) {
      const emailKey = this.caseInsensitiveEmail 
        ? String(criteria.email).toLowerCase() 
        : String(criteria.email);
      const user = this.usersByEmail.get(emailKey);
      return this.resolved(user ?? null);
    }

    // Generic search
    const found = this.findUser(criteria);
    return this.resolved(found ?? null);
  }

  private findUser(criteria: Record<string, unknown>): UserFixture | undefined {
    for (const user of this.users.values()) {
      if (this.matchesCriteria(user, criteria)) {
        return user;
      }
    }
    return undefined;
  }

  // ============================================================================
  // SESSION METHODS
  // ============================================================================

  private sessionExists(args: unknown[]): FunctionResolution {
    const criteria = this.extractCriteria(args);
    if (!criteria) {
      return this.resolved(this.sessions.size > 0);
    }

    // Check by ID
    if (criteria.id) {
      const exists = this.sessions.has(String(criteria.id));
      return this.resolved(exists);
    }

    // Check by token
    if (criteria.token) {
      const exists = this.sessionsByToken.has(String(criteria.token));
      return this.resolved(exists);
    }

    // Generic search
    const found = this.findSession(criteria);
    return this.resolved(found !== undefined);
  }

  private sessionLookup(args: unknown[]): FunctionResolution {
    const criteria = this.extractCriteria(args);
    if (!criteria) {
      return this.resolved(null, 'No criteria provided for lookup');
    }

    // Lookup by ID
    if (criteria.id) {
      const session = this.sessions.get(String(criteria.id));
      return this.resolved(session ?? null);
    }

    // Lookup by token
    if (criteria.token) {
      const session = this.sessionsByToken.get(String(criteria.token));
      return this.resolved(session ?? null);
    }

    // Generic search
    const found = this.findSession(criteria);
    return this.resolved(found ?? null);
  }

  private findSession(criteria: Record<string, unknown>): SessionFixture | undefined {
    for (const session of this.sessions.values()) {
      if (this.matchesCriteria(session, criteria)) {
        return session;
      }
    }
    return undefined;
  }

  // ============================================================================
  // API KEY METHODS
  // ============================================================================

  private apiKeyExists(args: unknown[]): FunctionResolution {
    const criteria = this.extractCriteria(args);
    if (!criteria) {
      return this.resolved(this.apiKeys.size > 0);
    }

    // Check by ID
    if (criteria.id) {
      const exists = this.apiKeys.has(String(criteria.id));
      return this.resolved(exists);
    }

    // Check by key
    if (criteria.key) {
      const exists = this.apiKeysByKey.has(String(criteria.key));
      return this.resolved(exists);
    }

    // Generic search
    const found = this.findApiKey(criteria);
    return this.resolved(found !== undefined);
  }

  private apiKeyLookup(args: unknown[]): FunctionResolution {
    const criteria = this.extractCriteria(args);
    if (!criteria) {
      return this.resolved(null, 'No criteria provided for lookup');
    }

    // Lookup by ID
    if (criteria.id) {
      const apiKey = this.apiKeys.get(String(criteria.id));
      return this.resolved(apiKey ?? null);
    }

    // Lookup by key
    if (criteria.key) {
      const apiKey = this.apiKeysByKey.get(String(criteria.key));
      return this.resolved(apiKey ?? null);
    }

    // Generic search
    const found = this.findApiKey(criteria);
    return this.resolved(found ?? null);
  }

  private findApiKey(criteria: Record<string, unknown>): ApiKeyFixture | undefined {
    for (const apiKey of this.apiKeys.values()) {
      if (this.matchesCriteria(apiKey, criteria)) {
        return apiKey;
      }
    }
    return undefined;
  }

  // ============================================================================
  // PROPERTY RESOLUTION
  // ============================================================================

  resolveProperty(path: string[]): PropertyResolution {
    if (path.length < 2) {
      return { value: 'unknown', handled: false };
    }

    const [entity, ...rest] = path;

    switch (entity) {
      case 'User':
        return this.resolveUserProperty(rest);
      case 'Session':
        return this.resolveSessionProperty(rest);
      case 'ApiKey':
        return this.resolveApiKeyProperty(rest);
      default:
        return { value: 'unknown', handled: false };
    }
  }

  private resolveUserProperty(path: string[]): PropertyResolution {
    // User.current -> current user
    if (path[0] === 'current') {
      if (path.length === 1) {
        return this.resolvedProperty(this.currentUser ?? null);
      }
      // User.current.email, User.current.name, etc.
      if (this.currentUser) {
        return this.resolvedProperty(
          this.getNestedProperty(this.currentUser, path.slice(1))
        );
      }
      return this.resolvedProperty(null);
    }

    // User.count -> total users
    if (path[0] === 'count' && path.length === 1) {
      return this.resolvedProperty(this.users.size);
    }

    return { value: 'unknown', handled: false };
  }

  private resolveSessionProperty(path: string[]): PropertyResolution {
    // Session.current -> current session
    if (path[0] === 'current') {
      if (path.length === 1) {
        return this.resolvedProperty(this.currentSession ?? null);
      }
      // Session.current.token, etc.
      if (this.currentSession) {
        return this.resolvedProperty(
          this.getNestedProperty(this.currentSession, path.slice(1))
        );
      }
      return this.resolvedProperty(null);
    }

    return { value: 'unknown', handled: false };
  }

  private resolveApiKeyProperty(path: string[]): PropertyResolution {
    // ApiKey.count -> total API keys
    if (path[0] === 'count' && path.length === 1) {
      return this.resolvedProperty(this.apiKeys.size);
    }

    return { value: 'unknown', handled: false };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private extractCriteria(args: unknown[]): Record<string, unknown> | null {
    if (args.length === 0) return null;
    
    const first = args[0];
    
    // Handle direct ID argument: User.exists('user-123')
    if (typeof first === 'string') {
      return { id: first };
    }
    
    // Handle criteria object: User.exists({ email: 'alice@example.com' })
    if (typeof first === 'object' && first !== null) {
      return first as Record<string, unknown>;
    }
    
    return null;
  }

  private matchesCriteria(obj: Record<string, unknown>, criteria: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(criteria)) {
      const objValue = obj[key];
      
      // Special case for email (case insensitive)
      if (key === 'email' && this.caseInsensitiveEmail) {
        if (String(objValue).toLowerCase() !== String(value).toLowerCase()) {
          return false;
        }
        continue;
      }
      
      if (objValue !== value) {
        return false;
      }
    }
    return true;
  }

  private getNestedProperty(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }
}

/**
 * Create an auth adapter with fixtures
 */
export function createAuthAdapter(fixtures?: AuthFixtures): AuthDomainAdapter {
  return new AuthDomainAdapter({ fixtures });
}
