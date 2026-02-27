/**
 * Counter Tests
 * 
 * Test suite for counter implementation.
 * Used for mutation testing (delete-expectation mutations).
 */
import { describe, it, expect } from 'vitest';
import { increment, decrement, CounterError } from './counter.impl';

describe('Counter', () => {
  describe('increment', () => {
    it('should increment counter by positive amount', () => {
      const counterId = 'test-counter-1';
      const amount = 5;
      
      const result = increment(counterId, amount);
      
      // Target for delete-expectation mutation
      expect(result).toBeDefined();
      expect(result.id).toBe(counterId);
      expect(result.value).toBeGreaterThan(0);
      expect(result.value).toBe(15); // 10 (initial) + 5
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should increment by one', () => {
      const result = increment('counter-2', 1);
      
      expect(result.value).toBe(11); // 10 + 1
    });

    it('should reject negative amounts', () => {
      expect(() => increment('test', -1)).toThrow(CounterError);
      expect(() => increment('test', -1)).toThrow('Amount must be a positive integer');
    });

    it('should reject zero amounts', () => {
      expect(() => increment('test', 0)).toThrow(CounterError);
    });

    it('should reject non-integer amounts', () => {
      expect(() => increment('test', 1.5)).toThrow(CounterError);
    });

    it('should reject empty counter ID', () => {
      expect(() => increment('', 5)).toThrow(CounterError);
      expect(() => increment('', 5)).toThrow('COUNTER_NOT_FOUND');
    });
  });

  describe('decrement', () => {
    it('should decrement counter by positive amount', () => {
      const counterId = 'test-counter-3';
      const amount = 3;
      
      const result = decrement(counterId, amount);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(counterId);
      expect(result.value).toBe(7); // 10 - 3
      expect(result.value).toBeGreaterThanOrEqual(0);
    });

    it('should reject amounts greater than current value', () => {
      expect(() => decrement('test', 15)).toThrow(CounterError);
      expect(() => decrement('test', 15)).toThrow('UNDERFLOW');
    });

    it('should reject negative amounts', () => {
      expect(() => decrement('test', -1)).toThrow(CounterError);
    });

    it('should allow decrementing to zero', () => {
      const result = decrement('counter-4', 10);
      expect(result.value).toBe(0);
    });
  });

  describe('postconditions', () => {
    it('should always return non-negative values', () => {
      const incremented = increment('test', 100);
      expect(incremented.value).toBeGreaterThanOrEqual(0);
      
      const decremented = decrement('test', 5);
      expect(decremented.value).toBeGreaterThanOrEqual(0);
    });

    it('should update timestamp on mutations', () => {
      const before = new Date();
      const result = increment('test', 1);
      const after = new Date();
      
      expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.updated_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('invariants', () => {
    it('should maintain value >= 0 invariant', () => {
      // This test ensures the invariant is checked
      const results = [
        increment('c1', 1),
        increment('c2', 100),
        decrement('c3', 5),
      ];
      
      for (const result of results) {
        expect(result.value).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
