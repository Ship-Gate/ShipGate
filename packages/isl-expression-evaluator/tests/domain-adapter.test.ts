// ============================================================================
// ISL Expression Evaluator - Domain Adapter Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuthDomainAdapter,
  createAuthAdapter,
  type UserFixture,
  type SessionFixture,
} from '../src/adapters/auth-adapter.js';
import {
  TraceDrivenAdapter,
  createTraceAdapter,
  createAdapterFromProofBundle,
} from '../src/adapters/trace-adapter.js';
import {
  CompositeAdapter,
  createDomainAdapterBridge,
  type DomainAdapter,
} from '../src/domain-adapter.js';
import type { Trace, TraceEvent, HandlerReturnEvent, StateChangeEvent } from '@isl-lang/trace-format';

// ============================================================================
// AUTH ADAPTER TESTS (Fixture-Based)
// ============================================================================

describe('AuthDomainAdapter', () => {
  describe('User.exists()', () => {
    it('should return true for existing user by ID', () => {
      const adapter = createAuthAdapter({
        users: [
          { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
          { id: 'user-2', email: 'bob@example.com', name: 'Bob' },
        ],
      });

      const result = adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return true when passing ID directly as string', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-123', email: 'test@example.com' }],
      });

      const result = adapter.resolveFunction('User', 'exists', ['user-123']);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return false for non-existent user', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-1', email: 'alice@example.com' }],
      });

      const result = adapter.resolveFunction('User', 'exists', [{ id: 'user-999' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should check existence by email', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-1', email: 'alice@example.com' }],
      });

      const result = adapter.resolveFunction('User', 'exists', [{ email: 'alice@example.com' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should handle case-insensitive email by default', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-1', email: 'Alice@Example.COM' }],
      });

      const result = adapter.resolveFunction('User', 'exists', [{ email: 'alice@example.com' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return true if any users exist when no criteria provided', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-1', email: 'test@example.com' }],
      });

      const result = adapter.resolveFunction('User', 'exists', []);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should return false when no users and no criteria', () => {
      const adapter = createAuthAdapter({ users: [] });

      const result = adapter.resolveFunction('User', 'exists', []);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(false);
    });
  });

  describe('User.lookup()', () => {
    it('should return user by ID', () => {
      const user: UserFixture = { id: 'user-1', email: 'alice@example.com', name: 'Alice' };
      const adapter = createAuthAdapter({ users: [user] });

      const result = adapter.resolveFunction('User', 'lookup', [{ id: 'user-1' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toEqual(user);
    });

    it('should return user by email', () => {
      const user: UserFixture = { id: 'user-1', email: 'alice@example.com', name: 'Alice' };
      const adapter = createAuthAdapter({ users: [user] });

      const result = adapter.resolveFunction('User', 'lookup', [{ email: 'alice@example.com' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toEqual(user);
    });

    it('should return null for non-existent user', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-1', email: 'alice@example.com' }],
      });

      const result = adapter.resolveFunction('User', 'lookup', [{ id: 'user-999' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBeNull();
    });

    it('should return null when no criteria provided', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-1', email: 'alice@example.com' }],
      });

      const result = adapter.resolveFunction('User', 'lookup', []);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('User.current property', () => {
    it('should resolve User.current to the current user', () => {
      const currentUser: UserFixture = { id: 'user-1', email: 'alice@example.com', name: 'Alice' };
      const adapter = createAuthAdapter({ currentUser });

      const result = adapter.resolveProperty(['User', 'current']);
      
      expect(result.handled).toBe(true);
      expect(result.value).toEqual(currentUser);
    });

    it('should resolve User.current.email', () => {
      const currentUser: UserFixture = { id: 'user-1', email: 'alice@example.com', name: 'Alice' };
      const adapter = createAuthAdapter({ currentUser });

      const result = adapter.resolveProperty(['User', 'current', 'email']);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe('alice@example.com');
    });

    it('should return null when no current user', () => {
      const adapter = createAuthAdapter({});

      const result = adapter.resolveProperty(['User', 'current']);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBeNull();
    });
  });

  describe('Session operations', () => {
    it('should check session existence by ID', () => {
      const adapter = createAuthAdapter({
        sessions: [{ id: 'sess-1', userId: 'user-1', token: 'abc123', expiresAt: '2026-12-31' }],
      });

      const result = adapter.resolveFunction('Session', 'exists', [{ id: 'sess-1' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should lookup session by token', () => {
      const session: SessionFixture = { id: 'sess-1', userId: 'user-1', token: 'abc123', expiresAt: '2026-12-31' };
      const adapter = createAuthAdapter({ sessions: [session] });

      const result = adapter.resolveFunction('Session', 'lookup', [{ token: 'abc123' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toEqual(session);
    });

    it('should resolve Session.current', () => {
      const currentSession: SessionFixture = { id: 'sess-1', userId: 'user-1', token: 'abc123', expiresAt: '2026-12-31' };
      const adapter = createAuthAdapter({ currentSession });

      const result = adapter.resolveProperty(['Session', 'current']);
      
      expect(result.handled).toBe(true);
      expect(result.value).toEqual(currentSession);
    });
  });

  describe('dynamic fixture management', () => {
    it('should allow adding users after construction', () => {
      const adapter = new AuthDomainAdapter();
      
      // Initially no users
      let result = adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]);
      expect(result.value).toBe(false);

      // Add user
      adapter.addUser({ id: 'user-1', email: 'alice@example.com' });

      // Now exists
      result = adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]);
      expect(result.value).toBe(true);
    });

    it('should allow setting current user', () => {
      const adapter = new AuthDomainAdapter();
      
      adapter.setCurrentUser({ id: 'user-1', email: 'alice@example.com', name: 'Alice' });

      const result = adapter.resolveProperty(['User', 'current', 'name']);
      expect(result.value).toBe('Alice');
    });

    it('should allow clearing fixtures', () => {
      const adapter = createAuthAdapter({
        users: [{ id: 'user-1', email: 'alice@example.com' }],
      });
      
      expect(adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]).value).toBe(true);

      adapter.clearFixtures();

      expect(adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]).value).toBe(false);
    });
  });

  describe('canHandle', () => {
    it('should handle User, Session, ApiKey', () => {
      const adapter = new AuthDomainAdapter();
      
      expect(adapter.canHandle('User')).toBe(true);
      expect(adapter.canHandle('Session')).toBe(true);
      expect(adapter.canHandle('ApiKey')).toBe(true);
    });

    it('should not handle other entities', () => {
      const adapter = new AuthDomainAdapter();
      
      expect(adapter.canHandle('Order')).toBe(false);
      expect(adapter.canHandle('Payment')).toBe(false);
    });
  });
});

// ============================================================================
// TRACE-DRIVEN ADAPTER TESTS
// ============================================================================

describe('TraceDrivenAdapter', () => {
  describe('resolving function calls from traces', () => {
    it('should resolve function from handler_return event', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-1',
          handler: 'User.exists',
          inputs: { id: 'user-123' },
          outputs: { result: true },
          events: [],
        } as HandlerReturnEvent,
      ];

      const adapter = createTraceAdapter({ events });

      const result = adapter.resolveFunction('User', 'exists', [{ id: 'user-123' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should resolve lookup function returning an object', () => {
      const userData = { id: 'user-123', email: 'alice@example.com', name: 'Alice' };
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-1',
          handler: 'User.lookup',
          inputs: { email: 'alice@example.com' },
          outputs: { result: userData },
          events: [],
        } as HandlerReturnEvent,
      ];

      const adapter = createTraceAdapter({ events });

      const result = adapter.resolveFunction('User', 'lookup', [{ email: 'alice@example.com' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toEqual(userData);
    });

    it('should use most recent call result when multiple matches', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-1',
          handler: 'User.exists',
          inputs: { id: 'user-123' },
          outputs: { result: false },
          events: [],
        } as HandlerReturnEvent,
        {
          time: '2026-02-02T10:01:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-2',
          handler: 'User.exists',
          inputs: { id: 'user-123' },
          outputs: { result: true }, // User was created
          events: [],
        } as HandlerReturnEvent,
      ];

      const adapter = createTraceAdapter({ events });

      const result = adapter.resolveFunction('User', 'exists', [{ id: 'user-123' }]);
      
      expect(result.value).toBe(true); // Most recent result
    });

    it('should fuzzy match when exact args do not match', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-1',
          handler: 'User.exists',
          inputs: { id: 'user-123', extra: 'field' },
          outputs: { result: true },
          events: [],
        } as HandlerReturnEvent,
      ];

      const adapter = createTraceAdapter({ events });

      // Query with just id (subset of original args)
      const result = adapter.resolveFunction('User', 'exists', [{ id: 'user-123' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('resolving properties from state_change events', () => {
    it('should resolve property from state_change event', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'state_change',
          correlationId: 'corr-1',
          handler: 'updateUser',
          inputs: {
            path: ['User', 'current', 'email'],
            oldValue: 'old@example.com',
          },
          outputs: {
            newValue: 'new@example.com',
            source: 'updateUser',
          },
          events: [],
        } as StateChangeEvent,
      ];

      const adapter = createTraceAdapter({ events });

      const result = adapter.resolveProperty(['User', 'current', 'email']);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe('new@example.com');
    });

    it('should use most recent state value', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'state_change',
          correlationId: 'corr-1',
          handler: 'updateUser',
          inputs: { path: ['User', 'balance'], oldValue: 100 },
          outputs: { newValue: 200, source: 'deposit' },
          events: [],
        } as StateChangeEvent,
        {
          time: '2026-02-02T10:01:00.000Z',
          kind: 'state_change',
          correlationId: 'corr-2',
          handler: 'updateUser',
          inputs: { path: ['User', 'balance'], oldValue: 200 },
          outputs: { newValue: 150, source: 'withdrawal' },
          events: [],
        } as StateChangeEvent,
      ];

      const adapter = createTraceAdapter({ events });

      const result = adapter.resolveProperty(['User', 'balance']);
      
      expect(result.value).toBe(150); // Most recent
    });
  });

  describe('initial state resolution', () => {
    it('should resolve from initial state when no trace data', () => {
      const adapter = createTraceAdapter({
        initialState: {
          User: {
            'user-1': { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
            'user-2': { id: 'user-2', email: 'bob@example.com', name: 'Bob' },
          },
        },
      });

      const result = adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should lookup from initial state', () => {
      const alice = { id: 'user-1', email: 'alice@example.com', name: 'Alice' };
      const adapter = createTraceAdapter({
        initialState: {
          User: { 'user-1': alice },
        },
      });

      const result = adapter.resolveFunction('User', 'lookup', [{ id: 'user-1' }]);
      
      expect(result.value).toEqual(alice);
    });

    it('should resolve nested property from initial state', () => {
      const adapter = createTraceAdapter({
        initialState: {
          User: {
            current: { id: 'user-1', email: 'alice@example.com' },
          },
        },
      });

      const result = adapter.resolveProperty(['User', 'current', 'email']);
      
      expect(result.value).toBe('alice@example.com');
    });
  });

  describe('loading from proof bundles', () => {
    it('should load traces from proof bundle format', () => {
      const trace: Trace = {
        id: 'trace-1',
        name: 'Login test',
        domain: 'auth',
        startTime: '2026-02-02T10:00:00.000Z',
        correlationId: 'corr-1',
        events: [
          {
            time: '2026-02-02T10:00:00.000Z',
            kind: 'handler_return',
            correlationId: 'corr-1',
            handler: 'User.exists',
            inputs: { email: 'alice@example.com' },
            outputs: { result: true },
            events: [],
          } as HandlerReturnEvent,
        ],
        initialState: {
          User: { 'user-1': { id: 'user-1', email: 'alice@example.com' } },
        },
      };

      const adapter = createAdapterFromProofBundle({ traces: [trace] });

      const result = adapter.resolveFunction('User', 'exists', [{ email: 'alice@example.com' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should merge initial states from multiple traces', () => {
      const trace1: Trace = {
        id: 'trace-1',
        name: 'Test 1',
        domain: 'auth',
        startTime: '2026-02-02T10:00:00.000Z',
        correlationId: 'corr-1',
        events: [],
        initialState: {
          User: { 'user-1': { id: 'user-1', email: 'alice@example.com' } },
        },
      };

      const trace2: Trace = {
        id: 'trace-2',
        name: 'Test 2',
        domain: 'auth',
        startTime: '2026-02-02T11:00:00.000Z',
        correlationId: 'corr-2',
        events: [],
        initialState: {
          User: { 'user-2': { id: 'user-2', email: 'bob@example.com' } },
        },
      };

      const adapter = createAdapterFromProofBundle({ traces: [trace1, trace2] });

      expect(adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]).value).toBe(true);
      expect(adapter.resolveFunction('User', 'exists', [{ id: 'user-2' }]).value).toBe(true);
    });
  });

  describe('filtering', () => {
    it('should filter by correlation ID', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-1',
          handler: 'User.exists',
          inputs: { id: 'user-1' },
          outputs: { result: true },
          events: [],
        } as HandlerReturnEvent,
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-2',
          handler: 'User.exists',
          inputs: { id: 'user-2' },
          outputs: { result: true },
          events: [],
        } as HandlerReturnEvent,
      ];

      const adapter = createTraceAdapter({ events, correlationId: 'corr-1' });

      // Should find user-1 (matching correlation ID)
      expect(adapter.resolveFunction('User', 'exists', [{ id: 'user-1' }]).value).toBe(true);
      
      // Should not find user-2 (different correlation ID)
      expect(adapter.resolveFunction('User', 'exists', [{ id: 'user-2' }]).value).toBe('unknown');
    });
  });

  describe('nested events', () => {
    it('should process nested events', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_call',
          correlationId: 'corr-1',
          handler: 'login',
          inputs: {},
          outputs: {},
          events: [
            {
              time: '2026-02-02T10:00:01.000Z',
              kind: 'handler_return',
              correlationId: 'corr-1',
              handler: 'User.exists',
              inputs: { id: 'user-123' },
              outputs: { result: true },
              events: [],
            } as HandlerReturnEvent,
          ],
        },
      ];

      const adapter = createTraceAdapter({ events });

      const result = adapter.resolveFunction('User', 'exists', [{ id: 'user-123' }]);
      
      expect(result.handled).toBe(true);
      expect(result.value).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should track indexed data', () => {
      const events: TraceEvent[] = [
        {
          time: '2026-02-02T10:00:00.000Z',
          kind: 'handler_return',
          correlationId: 'corr-1',
          handler: 'User.exists',
          inputs: { id: 'user-1' },
          outputs: { result: true },
          events: [],
        } as HandlerReturnEvent,
        {
          time: '2026-02-02T10:00:01.000Z',
          kind: 'state_change',
          correlationId: 'corr-1',
          handler: 'update',
          inputs: { path: ['User', 'email'], oldValue: 'old' },
          outputs: { newValue: 'new', source: 'test' },
          events: [],
        } as StateChangeEvent,
      ];

      const adapter = createTraceAdapter({ events });

      const stats = adapter.getStats();
      
      expect(stats.functionCalls).toBeGreaterThan(0);
      expect(stats.propertyValues).toBe(1);
    });
  });
});

// ============================================================================
// COMPOSITE ADAPTER TESTS
// ============================================================================

describe('CompositeAdapter', () => {
  it('should delegate to appropriate adapter', () => {
    const authAdapter = createAuthAdapter({
      users: [{ id: 'user-1', email: 'alice@example.com' }],
    });

    const composite = new CompositeAdapter({ adapters: [authAdapter] });

    const result = composite.resolveFunction('User', 'exists', [{ id: 'user-1' }]);
    
    expect(result.handled).toBe(true);
    expect(result.value).toBe(true);
  });

  it('should check canHandle across all adapters', () => {
    const authAdapter = createAuthAdapter();
    const composite = new CompositeAdapter({ adapters: [authAdapter] });

    expect(composite.canHandle('User')).toBe(true);
    expect(composite.canHandle('Order')).toBe(false);
  });

  it('should allow adding adapters dynamically', () => {
    const composite = new CompositeAdapter({ adapters: [] });
    
    expect(composite.canHandle('User')).toBe(false);

    composite.addAdapter(createAuthAdapter());

    expect(composite.canHandle('User')).toBe(true);
  });
});

// ============================================================================
// BRIDGE ADAPTER TESTS
// ============================================================================

describe('createDomainAdapterBridge', () => {
  it('should bridge domain adapter to ExpressionAdapter interface', () => {
    const authAdapter = createAuthAdapter({
      users: [{ id: 'user-1', email: 'alice@example.com' }],
    });

    const bridge = createDomainAdapterBridge(authAdapter);

    // exists() method
    expect(bridge.exists('User', { id: 'user-1' })).toBe('true');
    expect(bridge.exists('User', { id: 'user-999' })).toBe('false');

    // lookup() method
    const user = bridge.lookup('User', { id: 'user-1' });
    expect(user).not.toBe('unknown');
    expect((user as { email: string }).email).toBe('alice@example.com');

    // is_valid() method
    expect(bridge.is_valid('hello')).toBe('true');
    expect(bridge.is_valid('')).toBe('false');
    expect(bridge.is_valid(null)).toBe('false');

    // length() method
    expect(bridge.length('hello')).toBe(5);
    expect(bridge.length([1, 2, 3])).toBe(3);
    expect(bridge.length(123)).toBe('unknown');
  });

  it('should bridge property access', () => {
    const authAdapter = createAuthAdapter({
      currentUser: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
    });

    const bridge = createDomainAdapterBridge(authAdapter);

    // Direct object property access
    const obj = { foo: 'bar' };
    expect(bridge.getProperty(obj, 'foo')).toBe('bar');

    // Unknown property
    expect(bridge.getProperty(obj, 'missing')).toBe('unknown');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Adapter Integration', () => {
  describe('fixture adapter for unit testing', () => {
    it('should support complete auth flow testing', () => {
      const adapter = createAuthAdapter({
        users: [
          { id: 'user-1', email: 'alice@example.com', name: 'Alice', role: 'admin', active: true },
          { id: 'user-2', email: 'bob@example.com', name: 'Bob', role: 'user', active: false },
        ],
        sessions: [
          { id: 'sess-1', userId: 'user-1', token: 'token-123', expiresAt: '2026-12-31' },
        ],
        currentUser: { id: 'user-1', email: 'alice@example.com', name: 'Alice', role: 'admin' },
      });

      // Test precondition: user exists
      expect(adapter.resolveFunction('User', 'exists', [{ email: 'alice@example.com' }]).value).toBe(true);

      // Test postcondition: session created
      expect(adapter.resolveFunction('Session', 'exists', [{ userId: 'user-1' }]).value).toBe(true);

      // Test property access
      expect(adapter.resolveProperty(['User', 'current', 'role']).value).toBe('admin');

      // Test count
      expect(adapter.resolveFunction('User', 'count', []).value).toBe(2);
    });
  });

  describe('trace adapter for verification', () => {
    it('should support verification against recorded traces', () => {
      // Simulated proof bundle trace
      const trace: Trace = {
        id: 'trace-login-1',
        name: 'Successful login',
        domain: 'auth',
        startTime: '2026-02-02T10:00:00.000Z',
        correlationId: 'corr-login-1',
        events: [
          // Precondition check
          {
            time: '2026-02-02T10:00:01.000Z',
            kind: 'handler_return',
            correlationId: 'corr-login-1',
            handler: 'User.exists',
            inputs: { email: 'alice@example.com' },
            outputs: { result: true },
            events: [],
          } as HandlerReturnEvent,
          // User lookup
          {
            time: '2026-02-02T10:00:02.000Z',
            kind: 'handler_return',
            correlationId: 'corr-login-1',
            handler: 'User.lookup',
            inputs: { email: 'alice@example.com' },
            outputs: {
              result: { id: 'user-1', email: 'alice@example.com', name: 'Alice' },
            },
            events: [],
          } as HandlerReturnEvent,
          // Session creation
          {
            time: '2026-02-02T10:00:03.000Z',
            kind: 'handler_return',
            correlationId: 'corr-login-1',
            handler: 'Session.exists',
            inputs: { userId: 'user-1' },
            outputs: { result: true },
            events: [],
          } as HandlerReturnEvent,
        ],
      };

      const adapter = createAdapterFromProofBundle({ traces: [trace] });

      // Verify precondition was met
      const userExists = adapter.resolveFunction('User', 'exists', [{ email: 'alice@example.com' }]);
      expect(userExists.value).toBe(true);

      // Verify user was looked up correctly
      const user = adapter.resolveFunction('User', 'lookup', [{ email: 'alice@example.com' }]);
      expect((user.value as { name: string }).name).toBe('Alice');

      // Verify session was created
      const sessionExists = adapter.resolveFunction('Session', 'exists', [{ userId: 'user-1' }]);
      expect(sessionExists.value).toBe(true);
    });
  });

  describe('combining fixture and trace adapters', () => {
    it('should use fixture adapter as fallback when trace has no data', () => {
      const fixtureAdapter = createAuthAdapter({
        users: [{ id: 'fallback-user', email: 'fallback@example.com' }],
      });

      const traceAdapter = createTraceAdapter({
        events: [
          {
            time: '2026-02-02T10:00:00.000Z',
            kind: 'handler_return',
            correlationId: 'corr-1',
            handler: 'User.exists',
            inputs: { id: 'trace-user' },
            outputs: { result: true },
            events: [],
          } as HandlerReturnEvent,
        ],
      });

      const composite = new CompositeAdapter({
        adapters: [traceAdapter, fixtureAdapter],
        firstMatchWins: false, // Try all adapters
      });

      // From trace
      expect(composite.resolveFunction('User', 'exists', [{ id: 'trace-user' }]).value).toBe(true);
    });
  });
});
