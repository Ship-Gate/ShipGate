/**
 * Tests for ISL Test Runtime
 * 
 * Validates that entity proxies work correctly for generated tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext } from '../src/context.js';

describe('TestContext', () => {
  const ctx = createTestContext({ entities: ['User', 'Session'] });
  const { User, Session } = ctx.entities;

  beforeEach(() => {
    ctx.reset();
  });

  describe('Entity Proxy', () => {
    it('exists() returns false when no entities', () => {
      expect(User.exists()).toBe(false);
      expect(User.exists({ id: 'user_1' })).toBe(false);
    });

    it('exists() returns true after create', () => {
      const user = User.create({ id: 'user_1', email: 'test@example.com', name: 'Test' });
      
      expect(User.exists()).toBe(true);
      expect(User.exists({ id: 'user_1' })).toBe(true);
      expect(User.exists({ email: 'test@example.com' })).toBe(true);
      expect(User.exists({ id: 'user_999' })).toBe(false);
    });

    it('lookup() returns entity by criteria', () => {
      User.create({ id: 'user_1', email: 'alice@example.com', name: 'Alice' });
      User.create({ id: 'user_2', email: 'bob@example.com', name: 'Bob' });

      const alice = User.lookup({ email: 'alice@example.com' });
      expect(alice).toBeDefined();
      expect(alice?.name).toBe('Alice');

      const bob = User.lookup({ id: 'user_2' });
      expect(bob?.email).toBe('bob@example.com');

      const nobody = User.lookup({ id: 'user_999' });
      expect(nobody).toBeUndefined();
    });

    it('count() returns number of entities', () => {
      expect(User.count()).toBe(0);

      User.create({ id: 'user_1', email: 'a@test.com' });
      expect(User.count()).toBe(1);

      User.create({ id: 'user_2', email: 'b@test.com' });
      expect(User.count()).toBe(2);

      expect(User.count({ email: 'a@test.com' })).toBe(1);
    });

    it('getAll() returns all entities', () => {
      User.create({ id: 'u1', email: 'a@test.com' });
      User.create({ id: 'u2', email: 'b@test.com' });

      const all = User.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('State Capture (old)', () => {
    it('captures state for old() evaluation', () => {
      // Initial state
      User.create({ id: 'user_1', email: 'old@example.com' });
      
      // Capture state BEFORE modification
      const __old__ = ctx.captureState();

      // Modify state
      User.update('user_1', { email: 'new@example.com' });

      // Current state shows new email
      const current = User.lookup({ id: 'user_1' });
      expect(current?.email).toBe('new@example.com');

      // Old state shows previous email
      const oldUser = __old__.entity('User').lookup({ id: 'user_1' });
      expect(oldUser?.email).toBe('old@example.com');
    });

    it('old state count reflects pre-modification state', () => {
      User.create({ id: 'u1' });
      User.create({ id: 'u2' });
      
      const __old__ = ctx.captureState();
      expect(__old__.entity('User').count()).toBe(2);

      User.create({ id: 'u3' });
      
      expect(User.count()).toBe(3);
      expect(__old__.entity('User').count()).toBe(2);
    });
  });

  describe('Multiple Entity Types', () => {
    it('tracks different entity types separately', () => {
      User.create({ id: 'user_1' });
      Session.create({ id: 'session_1', userId: 'user_1' });

      expect(User.count()).toBe(1);
      expect(Session.count()).toBe(1);
      expect(User.exists({ id: 'user_1' })).toBe(true);
      expect(Session.exists({ userId: 'user_1' })).toBe(true);
    });
  });
});

describe('Example: CreateUser postcondition', () => {
  const ctx = createTestContext({ entities: ['User'] });
  const { User } = ctx.entities;

  beforeEach(() => ctx.reset());

  /**
   * This demonstrates what generated test code would look like.
   * 
   * ISL postcondition:
   *   success implies User.exists(result.id)
   * 
   * Compiles to:
   *   expect(User.exists({ id: result.id })).toBe(true)
   */
  it('success implies User.exists({ id: result.id })', async () => {
    // Simulate the behavior creating a user
    const result = {
      success: true,
      data: {
        id: 'user_001',
        email: 'test@example.com',
        name: 'Test User',
      },
    };

    // Simulate what the behavior would do internally
    if (result.success) {
      User.create(result.data);
    }

    // The generated postcondition check:
    // success implies User.exists({ id: result.id })
    if (result.success) {
      expect(User.exists({ id: result.data.id })).toBe(true);
    }
  });

  /**
   * ISL postcondition:
   *   success implies result.email == input.email
   * 
   * This one doesn't need entity proxy, just direct comparison.
   */
  it('success implies result.email === input.email', () => {
    const input = { email: 'test@example.com', name: 'Test' };
    const result = {
      success: true,
      data: {
        id: 'user_001',
        email: 'test@example.com',
        name: 'Test',
      },
    };

    if (result.success) {
      expect(result.data.email).toEqual(input.email);
    }
  });
});
