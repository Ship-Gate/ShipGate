/**
 * Auth Adapter Tests
 * 
 * Verifies that both FixtureAuthAdapter and TraceAuthAdapter can resolve
 * all login.isl queries from their respective data sources.
 * 
 * Test Coverage:
 * - Session.exists(id)
 * - User.lookup(id).last_login
 * - User.lookup(id).failed_attempts
 * - User.lookup_by_email(email).failed_attempts
 * - User.status
 * - Offline-only guarantee
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Types
  type AuthAdapter,
  type UserEntity,
  type SessionEntity,
  type AuthFixtureData,
  type AuthTraceEvent,
  
  // Fixture adapter
  FixtureAuthAdapter,
  createFixtureAdapter,
  createTestUser,
  createTestSession,
  
  // Trace adapter
  TraceAuthAdapter,
  createTraceAdapter,
  createTestTraceEvent,
  createTestStateSnapshot,
  
  // Utilities
  wrapForEvaluator,
  assertOffline,
} from '../src/auth/index.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const NOW = new Date('2026-02-02T12:00:00Z');
const ONE_HOUR_AGO = new Date('2026-02-02T11:00:00Z');
const ONE_HOUR_LATER = new Date('2026-02-02T13:00:00Z');

function createTestFixtures(): AuthFixtureData {
  return {
    users: [
      {
        id: 'user-1',
        email: 'alice@example.com',
        password_hash: 'hashed_password_1',
        status: 'ACTIVE',
        failed_attempts: 0,
        last_login: ONE_HOUR_AGO,
        created_at: new Date('2025-01-01'),
        updated_at: NOW,
      },
      {
        id: 'user-2',
        email: 'bob@example.com',
        password_hash: 'hashed_password_2',
        status: 'LOCKED',
        failed_attempts: 5,
        last_login: null,
        created_at: new Date('2025-01-01'),
        updated_at: NOW,
      },
      {
        id: 'user-3',
        email: 'charlie@example.com',
        password_hash: 'hashed_password_3',
        status: 'INACTIVE',
        failed_attempts: 2,
        last_login: new Date('2025-12-01'),
        created_at: new Date('2025-01-01'),
        updated_at: NOW,
      },
    ],
    sessions: [
      {
        id: 'session-1',
        user_id: 'user-1',
        access_token: 'a'.repeat(32),
        expires_at: ONE_HOUR_LATER,
        created_at: NOW,
        status: 'ACTIVE',
      },
      {
        id: 'session-2',
        user_id: 'user-1',
        access_token: 'b'.repeat(32),
        expires_at: ONE_HOUR_AGO, // Expired
        created_at: new Date('2026-02-02T10:00:00Z'),
        status: 'ACTIVE',
      },
      {
        id: 'session-3',
        user_id: 'user-3',
        access_token: 'c'.repeat(32),
        expires_at: ONE_HOUR_LATER,
        created_at: NOW,
        status: 'REVOKED',
      },
    ],
    now: NOW.toISOString(),
  };
}

function createTestTraceEvents(): AuthTraceEvent[] {
  const users: UserEntity[] = [
    {
      id: 'user-1',
      email: 'alice@example.com',
      password_hash: 'hashed_password_1',
      status: 'ACTIVE',
      failed_attempts: 0,
      last_login: ONE_HOUR_AGO,
      created_at: new Date('2025-01-01'),
      updated_at: NOW,
    },
    {
      id: 'user-2',
      email: 'bob@example.com',
      password_hash: 'hashed_password_2',
      status: 'LOCKED',
      failed_attempts: 5,
      last_login: null,
      created_at: new Date('2025-01-01'),
      updated_at: NOW,
    },
  ];

  const sessions: SessionEntity[] = [
    {
      id: 'session-1',
      user_id: 'user-1',
      access_token: 'a'.repeat(32),
      expires_at: ONE_HOUR_LATER,
      created_at: NOW,
      status: 'ACTIVE',
    },
  ];

  const stateBefore = createTestStateSnapshot(users, []);
  const stateAfter = createTestStateSnapshot(users, sessions);

  return [
    createTestTraceEvent({
      id: 'event-1',
      type: 'call',
      timestamp: NOW.getTime() - 100,
      behavior: 'UserLogin',
      input: { email: 'alice@example.com', password: 'password123' },
      stateBefore,
    }),
    createTestTraceEvent({
      id: 'event-2',
      type: 'return',
      timestamp: NOW.getTime(),
      behavior: 'UserLogin',
      output: {
        session: sessions[0],
        user: users[0],
      },
      stateAfter,
    }),
  ];
}

// ============================================================================
// FIXTURE ADAPTER TESTS
// ============================================================================

describe('FixtureAuthAdapter', () => {
  let adapter: FixtureAuthAdapter;

  beforeEach(() => {
    adapter = new FixtureAuthAdapter({
      fixtures: createTestFixtures(),
    });
  });

  describe('Offline Guarantee', () => {
    it('isOffline() returns true', () => {
      expect(adapter.isOffline()).toBe(true);
    });

    it('assertOffline does not throw', () => {
      expect(() => assertOffline(adapter)).not.toThrow();
    });
  });

  describe('Session.exists(id)', () => {
    it('returns true for active, non-expired session', () => {
      expect(adapter.sessionExists('session-1')).toBe(true);
    });

    it('returns false for expired session', () => {
      expect(adapter.sessionExists('session-2')).toBe(false);
    });

    it('returns false for revoked session', () => {
      expect(adapter.sessionExists('session-3')).toBe(false);
    });

    it('returns false for non-existent session', () => {
      expect(adapter.sessionExists('session-999')).toBe(false);
    });
  });

  describe('User.lookup(id)', () => {
    it('returns user by ID', () => {
      const user = adapter.lookupUserById('user-1');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.id).toBe('user-1');
        expect(user.email).toBe('alice@example.com');
      }
    });

    it('returns unknown for non-existent user', () => {
      expect(adapter.lookupUserById('user-999')).toBe('unknown');
    });
  });

  describe('User.lookup(id).last_login', () => {
    it('returns last_login for user with login history', () => {
      const user = adapter.lookupUserById('user-1');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.last_login).toEqual(ONE_HOUR_AGO);
      }
    });

    it('returns null for user who never logged in', () => {
      const user = adapter.lookupUserById('user-2');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.last_login).toBeNull();
      }
    });
  });

  describe('User.lookup(id).failed_attempts', () => {
    it('returns 0 for user with no failed attempts', () => {
      const user = adapter.lookupUserById('user-1');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.failed_attempts).toBe(0);
      }
    });

    it('returns count for user with failed attempts', () => {
      const user = adapter.lookupUserById('user-2');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.failed_attempts).toBe(5);
      }
    });
  });

  describe('User.lookup_by_email(email).failed_attempts', () => {
    it('returns failed_attempts by email', () => {
      const user = adapter.lookupUserByEmail('bob@example.com');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.failed_attempts).toBe(5);
      }
    });

    it('returns unknown for non-existent email', () => {
      expect(adapter.lookupUserByEmail('notfound@example.com')).toBe('unknown');
    });
  });

  describe('User.status', () => {
    it('returns ACTIVE status', () => {
      const user = adapter.lookupUserById('user-1');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.status).toBe('ACTIVE');
      }
    });

    it('returns LOCKED status', () => {
      const user = adapter.lookupUserById('user-2');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.status).toBe('LOCKED');
      }
    });

    it('returns INACTIVE status', () => {
      const user = adapter.lookupUserById('user-3');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.status).toBe('INACTIVE');
      }
    });
  });

  describe('Generic lookup/exists', () => {
    it('lookup User by criteria', () => {
      const user = adapter.lookup('User', { email: 'alice@example.com' });
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect((user as UserEntity).id).toBe('user-1');
      }
    });

    it('exists User by criteria', () => {
      expect(adapter.exists('User', { id: 'user-1' })).toBe(true);
      expect(adapter.exists('User', { id: 'user-999' })).toBe('unknown');
    });

    it('lookup Session by user_id', () => {
      const session = adapter.lookup('Session', { user_id: 'user-1' });
      expect(session).not.toBe('unknown');
    });
  });

  describe('Aggregate operations', () => {
    it('count returns total users', () => {
      expect(adapter.count('User')).toBe(3);
    });

    it('count returns filtered count', () => {
      expect(adapter.count('User', { status: 'ACTIVE' })).toBe(1);
    });

    it('getAll returns all entities', () => {
      const users = adapter.getAll('User');
      expect(users.length).toBe(3);
    });
  });

  describe('Store mutations', () => {
    it('upsertUser adds new user', () => {
      const newUser = createTestUser({ id: 'user-new', email: 'new@example.com' });
      adapter.upsertUser(newUser);
      expect(adapter.lookupUserById('user-new')).not.toBe('unknown');
    });

    it('setNow updates current time', () => {
      const futureDate = new Date('2026-12-31T23:59:59Z');
      adapter.setNow(futureDate);
      expect(adapter.getNow()).toEqual(futureDate);
    });

    it('clear removes all data', () => {
      adapter.clear();
      expect(adapter.count('User')).toBe(0);
      expect(adapter.count('Session')).toBe(0);
    });
  });
});

// ============================================================================
// TRACE ADAPTER TESTS
// ============================================================================

describe('TraceAuthAdapter', () => {
  let adapter: TraceAuthAdapter;

  beforeEach(() => {
    adapter = new TraceAuthAdapter({
      events: createTestTraceEvents(),
      stateMode: 'after',
    });
  });

  describe('Offline Guarantee', () => {
    it('isOffline() returns true', () => {
      expect(adapter.isOffline()).toBe(true);
    });

    it('assertOffline does not throw', () => {
      expect(() => assertOffline(adapter)).not.toThrow();
    });
  });

  describe('State reconstruction', () => {
    it('hasState returns true when state is reconstructed', () => {
      expect(adapter.hasState()).toBe(true);
    });

    it('hasState returns false for empty events', () => {
      const emptyAdapter = new TraceAuthAdapter({ events: [] });
      expect(emptyAdapter.hasState()).toBe(false);
    });
  });

  describe('Session.exists(id)', () => {
    it('returns true for active session from trace', () => {
      expect(adapter.sessionExists('session-1')).toBe(true);
    });

    it('returns false for non-existent session', () => {
      expect(adapter.sessionExists('session-999')).toBe(false);
    });
  });

  describe('User.lookup(id)', () => {
    it('returns user from trace state', () => {
      const user = adapter.lookupUserById('user-1');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.email).toBe('alice@example.com');
      }
    });

    it('returns unknown for non-existent user', () => {
      expect(adapter.lookupUserById('user-999')).toBe('unknown');
    });
  });

  describe('User.lookup(id).failed_attempts', () => {
    it('returns failed_attempts from trace state', () => {
      const user = adapter.lookupUserById('user-1');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.failed_attempts).toBe(0);
      }
    });

    it('returns failed_attempts for locked user', () => {
      const user = adapter.lookupUserById('user-2');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.failed_attempts).toBe(5);
      }
    });
  });

  describe('User.lookup_by_email(email).failed_attempts', () => {
    it('returns user by email from trace state', () => {
      const user = adapter.lookupUserByEmail('alice@example.com');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.failed_attempts).toBe(0);
      }
    });
  });

  describe('User.status', () => {
    it('returns status from trace state', () => {
      const user = adapter.lookupUserById('user-1');
      expect(user).not.toBe('unknown');
      if (user !== 'unknown') {
        expect(user.status).toBe('ACTIVE');
      }
    });
  });

  describe('State mode variations', () => {
    it('before mode uses stateBefore', () => {
      const beforeAdapter = new TraceAuthAdapter({
        events: createTestTraceEvents(),
        stateMode: 'before',
      });
      
      // Before login, no session exists
      expect(beforeAdapter.sessionExists('session-1')).toBe(false);
    });

    it('after mode uses stateAfter', () => {
      const afterAdapter = new TraceAuthAdapter({
        events: createTestTraceEvents(),
        stateMode: 'after',
      });
      
      // After login, session exists
      expect(afterAdapter.sessionExists('session-1')).toBe(true);
    });
  });

  describe('Event access', () => {
    it('getEvents returns all events', () => {
      expect(adapter.getEvents().length).toBe(2);
    });

    it('getEventsByType filters by type', () => {
      expect(adapter.getEventsByType('call').length).toBe(1);
      expect(adapter.getEventsByType('return').length).toBe(1);
    });

    it('getEventsByBehavior filters by behavior', () => {
      expect(adapter.getEventsByBehavior('UserLogin').length).toBe(2);
      expect(adapter.getEventsByBehavior('Other').length).toBe(0);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe('Factory Functions', () => {
  describe('createFixtureAdapter', () => {
    it('creates a valid adapter', () => {
      const adapter = createFixtureAdapter({
        fixtures: createTestFixtures(),
      });
      expect(adapter.isOffline()).toBe(true);
      expect(adapter.lookupUserById('user-1')).not.toBe('unknown');
    });
  });

  describe('createTraceAdapter', () => {
    it('creates a valid adapter', () => {
      const adapter = createTraceAdapter({
        events: createTestTraceEvents(),
      });
      expect(adapter.isOffline()).toBe(true);
    });
  });
});

// ============================================================================
// EVALUATOR WRAPPER TESTS
// ============================================================================

describe('wrapForEvaluator', () => {
  let adapter: AuthAdapter;
  let wrapped: ReturnType<typeof wrapForEvaluator>;

  beforeEach(() => {
    adapter = createFixtureAdapter({
      fixtures: createTestFixtures(),
    });
    wrapped = wrapForEvaluator(adapter);
  });

  describe('is_valid', () => {
    it('returns true for non-empty string', () => {
      expect(wrapped.is_valid('hello')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(wrapped.is_valid('')).toBe(false);
    });

    it('returns false for null', () => {
      expect(wrapped.is_valid(null)).toBe(false);
    });
  });

  describe('length', () => {
    it('returns string length', () => {
      expect(wrapped.length('hello')).toBe(5);
    });

    it('returns array length', () => {
      expect(wrapped.length([1, 2, 3])).toBe(3);
    });

    it('returns unknown for null', () => {
      expect(wrapped.length(null)).toBe('unknown');
    });
  });

  describe('exists', () => {
    it('delegates to adapter', () => {
      expect(wrapped.exists('User', { id: 'user-1' })).toBe(true);
    });
  });

  describe('lookup', () => {
    it('delegates to adapter', () => {
      const result = wrapped.lookup('User', { id: 'user-1' });
      expect(result).not.toBe('unknown');
    });
  });
});

// ============================================================================
// TEST HELPER TESTS
// ============================================================================

describe('Test Helpers', () => {
  describe('createTestUser', () => {
    it('creates a valid user with defaults', () => {
      const user = createTestUser();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.status).toBe('ACTIVE');
      expect(user.failed_attempts).toBe(0);
    });

    it('allows overrides', () => {
      const user = createTestUser({
        email: 'custom@example.com',
        failed_attempts: 3,
      });
      expect(user.email).toBe('custom@example.com');
      expect(user.failed_attempts).toBe(3);
    });
  });

  describe('createTestSession', () => {
    it('creates a valid session', () => {
      const session = createTestSession('user-1');
      expect(session.user_id).toBe('user-1');
      expect(session.access_token.length).toBeGreaterThanOrEqual(32);
      expect(session.status).toBe('ACTIVE');
    });
  });

  describe('createTestTraceEvent', () => {
    it('creates a valid event', () => {
      const event = createTestTraceEvent({
        type: 'call',
        behavior: 'TestBehavior',
      });
      expect(event.type).toBe('call');
      expect(event.behavior).toBe('TestBehavior');
    });
  });

  describe('createTestStateSnapshot', () => {
    it('creates a valid snapshot', () => {
      const users = [createTestUser({ id: 'test-user' })];
      const sessions = [createTestSession('test-user')];
      const snapshot = createTestStateSnapshot(users, sessions);
      
      expect(snapshot.users.size).toBe(1);
      expect(snapshot.sessions.size).toBe(1);
      expect(snapshot.users.get('test-user')).toBeDefined();
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  describe('Empty fixtures', () => {
    it('handles empty user list', () => {
      const adapter = createFixtureAdapter({
        fixtures: { users: [], sessions: [] },
      });
      expect(adapter.lookupUserById('any')).toBe('unknown');
      expect(adapter.count('User')).toBe(0);
    });
  });

  describe('Empty trace events', () => {
    it('handles no events gracefully', () => {
      const adapter = createTraceAdapter({ events: [] });
      expect(adapter.lookupUserById('any')).toBe('unknown');
      expect(adapter.hasState()).toBe(false);
    });
  });

  describe('Strict mode', () => {
    it('returns false instead of unknown in strict mode', () => {
      const adapter = createFixtureAdapter({
        fixtures: { users: [], sessions: [] },
        strict: true,
      });
      expect(adapter.exists('User', { id: 'nonexistent' })).toBe(false);
    });
  });

  describe('Behavior filtering in trace adapter', () => {
    it('filters events by behavior', () => {
      const events = [
        createTestTraceEvent({ behavior: 'UserLogin' }),
        createTestTraceEvent({ behavior: 'OtherBehavior' }),
      ];
      
      const adapter = new TraceAuthAdapter({
        events,
        behavior: 'UserLogin',
      });
      
      expect(adapter.getEvents().length).toBe(1);
    });
  });
});
