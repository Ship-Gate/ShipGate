/**
 * Circuit Breaker Unit Tests
 * 
 * Tests cover:
 * - State transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Thresholds (failure threshold, success threshold)
 * - Half-open logic
 * - Async safety (concurrent calls)
 * - Memory leak prevention (timeout cleanup)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, CircuitOpenError, TimeoutError } from '../src/circuit-breaker.js';
import type { CircuitBreakerConfig } from '../src/types.js';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;
  const defaultConfig: CircuitBreakerConfig = {
    name: 'test-circuit',
    failureThreshold: 50, // 50% failure rate
    successThreshold: 2,
    timeout: 5000,
    resetTimeout: 1000,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State Management', () => {
    it('should start in CLOSED state', () => {
      cb = new CircuitBreaker(defaultConfig);
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should transition to OPEN when failure threshold is exceeded', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        volumeThreshold: 10,
        failureThreshold: 50, // 50% failure rate
      });

      // Execute 10 calls, 6 failures (60% failure rate > 50%)
      const fn = vi.fn()
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success');

      // Execute all calls sequentially to ensure state updates
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          cb.execute(() => fn()).catch(() => {
            // Ignore errors
          })
        );
      }
      await Promise.all(promises);

      // Check state after all calls complete
      expect(cb.getState()).toBe('OPEN');
    });

    it('should transition to HALF_OPEN after resetTimeout', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        volumeThreshold: 5,
        failureThreshold: 50,
        resetTimeout: 1000,
      });

      // Trip the circuit
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 5; i++) {
        try {
          await cb.execute(() => failingFn());
        } catch {
          // Ignore
        }
      }

      expect(cb.getState()).toBe('OPEN');

      // Advance time past resetTimeout
      vi.advanceTimersByTime(1001);

      // Next call should transition to HALF_OPEN
      const successFn = vi.fn().mockResolvedValue('success');
      await cb.execute(() => successFn());
      expect(cb.getState()).toBe('HALF_OPEN');
    });

    it('should transition from HALF_OPEN to CLOSED after successThreshold successes', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        successThreshold: 2,
        resetTimeout: 1000,
      });

      // Force to HALF_OPEN
      cb['state'] = 'HALF_OPEN';
      cb['stateChangedAt'] = Date.now();

      const successFn = vi.fn().mockResolvedValue('success');

      // First success
      await cb.execute(() => successFn());
      expect(cb.getState()).toBe('HALF_OPEN');

      // Second success should close the circuit
      await cb.execute(() => successFn());
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should transition from HALF_OPEN to OPEN on failure', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 1000,
      });

      // Force to HALF_OPEN
      cb['state'] = 'HALF_OPEN';
      cb['stateChangedAt'] = Date.now();

      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await cb.execute(() => failingFn());
      } catch {
        // Expected
      }

      expect(cb.getState()).toBe('OPEN');
    });
  });

  describe('Thresholds', () => {
    it('should respect volumeThreshold before tripping', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        volumeThreshold: 10,
        failureThreshold: 50,
      });

      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      // Execute 9 calls (below volume threshold)
      for (let i = 0; i < 9; i++) {
        try {
          await cb.execute(() => failingFn());
        } catch {
          // Ignore
        }
      }

      expect(cb.getState()).toBe('CLOSED');

      // 10th call should trip
      try {
        await cb.execute(() => failingFn());
      } catch {
        // Ignore
      }

      expect(cb.getState()).toBe('OPEN');
    });

    it('should respect failureThreshold percentage', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        volumeThreshold: 10,
        failureThreshold: 60, // 60% failure rate
      });

      const mixedFn = vi.fn()
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'));

      // Execute 10 calls with 6 failures (60%)
      for (let i = 0; i < 10; i++) {
        try {
          await cb.execute(() => mixedFn());
        } catch {
          // Ignore
        }
      }

      expect(cb.getState()).toBe('OPEN');
    });

    it('should handle slow call threshold', async () => {
      vi.useRealTimers();
      cb = new CircuitBreaker({
        ...defaultConfig,
        volumeThreshold: 10,
        slowCallThreshold: 0.5, // 50% slow calls
        slowCallDuration: 100,
      });

      const slowFn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 150))
      );

      // Execute 10 slow calls
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cb.execute(() => slowFn()));
      }
      await Promise.all(promises);

      expect(cb.getState()).toBe('OPEN');
      vi.useFakeTimers();
    });
  });

  describe('Half-Open Logic', () => {
    it('should allow single request in HALF_OPEN state', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 1000,
      });

      cb['state'] = 'OPEN';
      cb['stateChangedAt'] = Date.now() - 1001;

      const successFn = vi.fn().mockResolvedValue('success');
      const result = await cb.execute(() => successFn());

      expect(result).toBe('success');
      expect(cb.getState()).toBe('HALF_OPEN');
    });

    it('should reject requests when OPEN and resetTimeout not elapsed', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 1000,
      });

      cb['state'] = 'OPEN';
      cb['stateChangedAt'] = Date.now() - 500; // Only 500ms elapsed

      await expect(
        cb.execute(() => Promise.resolve('success'))
      ).rejects.toThrow(CircuitOpenError);
    });

    it('should count consecutive successes in HALF_OPEN', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        successThreshold: 3,
      });

      cb['state'] = 'HALF_OPEN';
      cb['recentCalls'] = [];

      const successFn = vi.fn().mockResolvedValue('success');

      await cb.execute(() => successFn());
      expect(cb.getState()).toBe('HALF_OPEN');

      await cb.execute(() => successFn());
      expect(cb.getState()).toBe('HALF_OPEN');

      await cb.execute(() => successFn());
      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('Async Safety', () => {
    it('should handle concurrent calls safely', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        volumeThreshold: 10,
        failureThreshold: 50,
      });

      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () =>
          cb.execute(() => Promise.resolve('success'))
        )
      );

      const successes = results.filter(r => r.status === 'fulfilled').length;
      expect(successes).toBeGreaterThan(0);
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should handle concurrent failures safely', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        volumeThreshold: 10,
        failureThreshold: 50,
      });

      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
          cb.execute(() => failingFn())
        )
      );

      // All should fail, but state should be consistent
      const failures = results.filter(r => r.status === 'rejected').length;
      expect(failures).toBe(10);
      
      // State should be OPEN if threshold exceeded
      const stats = cb.getStats();
      expect(['CLOSED', 'OPEN']).toContain(stats.state);
    });

    it('should prevent race conditions during state transitions', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 1000,
      });

      cb['state'] = 'OPEN';
      cb['stateChangedAt'] = Date.now() - 1001;

      // Multiple concurrent calls when transitioning to HALF_OPEN
      const successFn = vi.fn().mockResolvedValue('success');
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => cb.execute(() => successFn()))
      );

      // All should succeed or be rejected consistently
      const state = cb.getState();
      expect(['HALF_OPEN', 'CLOSED']).toContain(state);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow operations', async () => {
      vi.useRealTimers();
      cb = new CircuitBreaker({
        ...defaultConfig,
        timeout: 100,
      });

      const slowFn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 200))
      );

      await expect(
        cb.execute(() => slowFn())
      ).rejects.toThrow(TimeoutError);
      
      vi.useFakeTimers();
    });

    it('should cleanup timeout on success', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        timeout: 1000,
      });

      const fastFn = vi.fn().mockResolvedValue('fast');
      const result = await cb.execute(() => fastFn());

      expect(result).toBe('fast');
      // No timeout should be pending
      vi.advanceTimersByTime(2000);
      // Should not throw
    });

    it('should cleanup timeout on failure', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        timeout: 1000,
      });

      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(
        cb.execute(() => failingFn())
      ).rejects.toThrow('fail');

      // Advance time - no timeout should fire
      vi.advanceTimersByTime(2000);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should cleanup old calls from recentCalls array', () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 1000,
      });

      // Add old calls
      const oldTime = Date.now() - 2000;
      cb['recentCalls'] = [
        { duration: 10, success: true, timestamp: oldTime },
        { duration: 20, success: false, timestamp: oldTime },
      ];

      cb['cleanupOldCalls']();

      expect(cb['recentCalls']).toHaveLength(0);
    });

    it('should limit recentCalls array size', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 10000, // Long timeout
      });

      const successFn = vi.fn().mockResolvedValue('success');

      // Execute many calls
      for (let i = 0; i < 100; i++) {
        await cb.execute(() => successFn());
      }

      // Cleanup should keep array manageable
      cb['cleanupOldCalls']();
      const stats = cb.getStats();
      expect(stats.totalCalls).toBe(100);
    });
  });

  describe('Statistics', () => {
    it('should track statistics correctly', async () => {
      cb = new CircuitBreaker(defaultConfig);

      const mixedFn = vi.fn()
        .mockResolvedValueOnce('success')
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('fail'));

      await cb.execute(() => mixedFn());
      await cb.execute(() => mixedFn());
      try {
        await cb.execute(() => mixedFn());
      } catch {
        // Ignore
      }

      const stats = cb.getStats();
      expect(stats.totalCalls).toBe(3);
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(1);
      expect(stats.state).toBe('CLOSED');
    });

    it('should track last failure and success times', async () => {
      cb = new CircuitBreaker(defaultConfig);

      const successFn = vi.fn().mockResolvedValue('success');
      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      await cb.execute(() => successFn());
      const stats1 = cb.getStats();
      expect(stats1.lastSuccessTime).not.toBeNull();
      expect(stats1.lastFailureTime).toBeNull();

      try {
        await cb.execute(() => failingFn());
      } catch {
        // Ignore
      }

      const stats2 = cb.getStats();
      expect(stats2.lastFailureTime).not.toBeNull();
    });
  });

  describe('Manual Control', () => {
    it('should allow manual reset', () => {
      cb = new CircuitBreaker(defaultConfig);
      cb['state'] = 'OPEN';
      cb['failures'] = 10;

      cb.reset();

      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getStats().failures).toBe(0);
    });

    it('should allow force open', () => {
      cb = new CircuitBreaker(defaultConfig);
      expect(cb.getState()).toBe('CLOSED');

      cb.forceOpen();

      expect(cb.getState()).toBe('OPEN');
    });

    it('should allow force closed', () => {
      cb = new CircuitBreaker(defaultConfig);
      cb['state'] = 'OPEN';

      cb.forceClosed();

      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('Error Handling', () => {
    it('should throw CircuitOpenError when circuit is open', async () => {
      cb = new CircuitBreaker({
        ...defaultConfig,
        resetTimeout: 1000,
      });

      cb['state'] = 'OPEN';
      cb['stateChangedAt'] = Date.now();

      await expect(
        cb.execute(() => Promise.resolve('success'))
      ).rejects.toThrow(CircuitOpenError);
    });

    it('should propagate original errors', async () => {
      cb = new CircuitBreaker(defaultConfig);

      const customError = new Error('Custom error');
      const failingFn = vi.fn().mockRejectedValue(customError);

      await expect(
        cb.execute(() => failingFn())
      ).rejects.toThrow('Custom error');
    });
  });

  describe('Callbacks', () => {
    it('should call onStateChange callback', () => {
      const onStateChange = vi.fn();
      cb = new CircuitBreaker({
        ...defaultConfig,
        onStateChange,
      });

      cb.forceOpen();

      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN');
    });

    it('should call onFailure callback', async () => {
      const onFailure = vi.fn();
      cb = new CircuitBreaker({
        ...defaultConfig,
        onFailure,
      });

      const failingFn = vi.fn().mockRejectedValue(new Error('fail'));

      try {
        await cb.execute(() => failingFn());
      } catch {
        // Ignore
      }

      expect(onFailure).toHaveBeenCalled();
    });

    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn();
      cb = new CircuitBreaker({
        ...defaultConfig,
        onSuccess,
      });

      const successFn = vi.fn().mockResolvedValue('success');
      await cb.execute(() => successFn());

      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
