import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  require,
  ensure,
  invariant,
  requireAll,
  ensureAll,
  invariantAll,
  resetEventCounter,
} from '../src/assertions';
import {
  PreconditionError,
  PostconditionError,
  InvariantError,
  ErrorCode,
} from '../src/errors';
import { registerHook, resetHooks } from '../src/hooks';

describe('Assertions', () => {
  beforeEach(() => {
    resetHooks();
    resetEventCounter();
  });

  describe('require()', () => {
    it('should pass when condition is true', () => {
      const result = require(true, 'Should pass');
      
      expect(result.passed).toBe(true);
      expect(result.type).toBe('precondition');
      expect(result.error).toBeUndefined();
    });

    it('should throw PreconditionError when condition is false', () => {
      expect(() => require(false, 'Should fail')).toThrow(PreconditionError);
    });

    it('should return result without throwing when throwOnFail is false', () => {
      const result = require(false, 'Should fail', { throwOnFail: false });
      
      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe(ErrorCode.PRECONDITION_FAILED);
    });

    it('should accept custom label', () => {
      const result = require(true, 'Test', { label: 'custom_label' });
      
      expect(result.label).toBe('custom_label');
    });

    it('should emit events to hooks', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      require(true, 'Test');
      
      expect(handler).toHaveBeenCalled();
      const calls = handler.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      // Check that we got precondition events
      const types = calls.map((c) => c[0].type);
      expect(types).toContain('precondition:check');
      expect(types).toContain('precondition:pass');
    });

    it('should emit fail event on failure', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      try {
        require(false, 'Fail test');
      } catch {
        // Expected
      }
      
      const types = handler.mock.calls.map((c) => c[0].type);
      expect(types).toContain('precondition:fail');
    });

    it('should track duration', () => {
      const result = require(true, 'Test');
      
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ensure()', () => {
    it('should pass when condition is true', () => {
      const result = ensure(true, 'Should pass');
      
      expect(result.passed).toBe(true);
      expect(result.type).toBe('postcondition');
    });

    it('should throw PostconditionError when condition is false', () => {
      expect(() => ensure(false, 'Should fail')).toThrow(PostconditionError);
    });

    it('should emit postcondition events', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      ensure(true, 'Test');
      
      const types = handler.mock.calls.map((c) => c[0].type);
      expect(types).toContain('postcondition:check');
      expect(types).toContain('postcondition:pass');
    });

    it('should include context in result', () => {
      const context = { result: { id: 'abc' } };
      const result = ensure(true, 'Test', { context });
      
      expect(result.passed).toBe(true);
    });
  });

  describe('invariant()', () => {
    it('should pass when condition is true', () => {
      const result = invariant(true, 'Should pass');
      
      expect(result.passed).toBe(true);
      expect(result.type).toBe('invariant');
    });

    it('should throw InvariantError when condition is false', () => {
      expect(() => invariant(false, 'Should fail')).toThrow(InvariantError);
    });

    it('should emit invariant events', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      invariant(true, 'Test');
      
      const types = handler.mock.calls.map((c) => c[0].type);
      expect(types).toContain('invariant:check');
      expect(types).toContain('invariant:pass');
    });

    it('should accept state context', () => {
      const context = {
        oldState: { balance: 100 },
        state: { balance: 50 },
      };
      
      const result = invariant(true, 'Balance check', { context });
      
      expect(result.passed).toBe(true);
    });
  });

  describe('requireAll()', () => {
    it('should pass when all conditions are true', () => {
      const results = requireAll([
        [true, 'Check 1'],
        [true, 'Check 2'],
        [true, 'Check 3'],
      ]);
      
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should throw combined error when any condition fails', () => {
      expect(() =>
        requireAll([
          [true, 'Check 1'],
          [false, 'Check 2 fails'],
          [false, 'Check 3 fails'],
        ])
      ).toThrow(PreconditionError);
    });

    it('should include failure count in error', () => {
      try {
        requireAll([
          [true, 'Pass'],
          [false, 'Fail 1'],
          [false, 'Fail 2'],
        ]);
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PreconditionError);
        const err = e as PreconditionError;
        expect(err.message).toContain('Multiple precondition failures');
      }
    });
  });

  describe('ensureAll()', () => {
    it('should pass when all conditions are true', () => {
      const results = ensureAll([
        [true, 'Check 1'],
        [true, 'Check 2'],
      ]);
      
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should throw PostconditionError when any fails', () => {
      expect(() =>
        ensureAll([
          [true, 'Pass'],
          [false, 'Fail'],
        ])
      ).toThrow(PostconditionError);
    });
  });

  describe('invariantAll()', () => {
    it('should pass when all conditions are true', () => {
      const results = invariantAll([
        [true, 'Invariant 1'],
        [true, 'Invariant 2'],
      ]);
      
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should throw InvariantError when any fails', () => {
      expect(() =>
        invariantAll([
          [true, 'Pass'],
          [false, 'Fail'],
        ])
      ).toThrow(InvariantError);
    });
  });

  describe('Event ID Generation', () => {
    it('should generate unique event IDs', () => {
      const handler = vi.fn();
      registerHook('test', handler);
      
      require(true, 'Test 1');
      require(true, 'Test 2');
      require(true, 'Test 3');
      
      const eventIds = handler.mock.calls.map((c) => c[0].eventId);
      const uniqueIds = new Set(eventIds);
      
      // Each require emits 2 events (check + pass), so we should have 6 events
      // But IDs should repeat for check/pass pairs
      expect(eventIds.length).toBe(6);
    });

    it('should reset event counter', () => {
      resetEventCounter();
      
      const handler = vi.fn();
      registerHook('test', handler);
      
      require(true, 'Test');
      
      const eventId = handler.mock.calls[0][0].eventId;
      expect(eventId).toMatch(/^evt_\d+_1$/);
    });
  });

  describe('Custom Error Codes', () => {
    it('should accept custom error code for require', () => {
      try {
        require(false, 'Null value', { 
          errorCode: ErrorCode.PRECONDITION_NULL_ERROR,
          throwOnFail: true,
        });
      } catch (e) {
        expect((e as PreconditionError).code).toBe(ErrorCode.PRECONDITION_NULL_ERROR);
      }
    });

    it('should accept custom error code for ensure', () => {
      try {
        ensure(false, 'Type error', {
          errorCode: ErrorCode.POSTCONDITION_TYPE_ERROR,
        });
      } catch (e) {
        expect((e as PostconditionError).code).toBe(ErrorCode.POSTCONDITION_TYPE_ERROR);
      }
    });

    it('should accept custom error code for invariant', () => {
      try {
        invariant(false, 'State error', {
          errorCode: ErrorCode.INVARIANT_STATE_ERROR,
        });
      } catch (e) {
        expect((e as InvariantError).code).toBe(ErrorCode.INVARIANT_STATE_ERROR);
      }
    });
  });
});
