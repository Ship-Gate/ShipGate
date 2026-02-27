// ============================================================================
// ISL Standard Library - Rate Limiter Tests
// @stdlib/rate-limit/tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRateLimiter,
  createMemoryStorage,
  RateLimitAction,
  IdentifierType,
  type RateLimiter,
  type MemoryRateLimitStorage,
} from '../implementations/typescript';

describe('RateLimiter', () => {
  let storage: MemoryRateLimitStorage;
  let limiter: RateLimiter;

  beforeEach(() => {
    storage = createMemoryStorage();
    limiter = createRateLimiter({
      storage,
      configs: [
        { name: 'default', limit: 10, windowMs: 60000 },
        { name: 'strict', limit: 3, windowMs: 60000, blockDurationMs: 300000 },
        { name: 'api', limit: 100, windowMs: 60000, warnThreshold: 0.8 },
      ],
    });
  });

  describe('check', () => {
    it('should allow requests under the limit', async () => {
      const result = await limiter.check({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(result.allowed).toBe(true);
      expect(result.action).toBe(RateLimitAction.ALLOW);
      expect(result.remaining).toBe(10);
      expect(result.limit).toBe(10);
    });

    it('should decrement remaining on checkAndIncrement', async () => {
      const result1 = await limiter.checkAndIncrement({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(result1.remaining).toBe(9);

      const result2 = await limiter.checkAndIncrement({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(result2.remaining).toBe(8);
    });

    it('should deny requests over the limit', async () => {
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await limiter.checkAndIncrement({
          key: 'user-1',
          identifierType: IdentifierType.USER_ID,
          configName: 'default',
        });
      }

      // 11th request should be denied
      const result = await limiter.check({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(result.allowed).toBe(false);
      expect(result.action).toBe(RateLimitAction.DENY);
      expect(result.remaining).toBe(0);
    });

    it('should warn when approaching limit', async () => {
      // Make 80 requests (80% of 100)
      for (let i = 0; i < 80; i++) {
        await limiter.checkAndIncrement({
          key: 'api-key-1',
          identifierType: IdentifierType.API_KEY,
          configName: 'api',
        });
      }

      const result = await limiter.check({
        key: 'api-key-1',
        identifierType: IdentifierType.API_KEY,
        configName: 'api',
      });

      expect(result.action).toBe(RateLimitAction.WARN);
      expect(result.allowed).toBe(true);
    });

    it('should include rate limit headers', async () => {
      const result = await limiter.check({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(result.headers).toBeDefined();
      expect(result.headers!['X-RateLimit-Limit']).toBe('10');
      expect(result.headers!['X-RateLimit-Remaining']).toBeDefined();
      expect(result.headers!['X-RateLimit-Reset']).toBeDefined();
    });

    it('should handle weighted requests', async () => {
      await limiter.checkAndIncrement({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
        weight: 5,
      });

      const result = await limiter.check({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(result.remaining).toBe(5);
    });
  });

  describe('blocking', () => {
    it('should block an identifier', async () => {
      await limiter.block({
        key: 'bad-user',
        identifierType: IdentifierType.USER_ID,
        durationMs: 60000,
        reason: 'Suspicious activity',
      });

      const result = await limiter.check({
        key: 'bad-user',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(result.allowed).toBe(false);
      expect(result.action).toBe(RateLimitAction.DENY);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should unblock an identifier', async () => {
      await limiter.block({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        durationMs: 60000,
        reason: 'Test block',
      });

      const blocked = await limiter.isBlocked('user-1', IdentifierType.USER_ID);
      expect(blocked.blocked).toBe(true);

      await limiter.unblock({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
      });

      const unblocked = await limiter.isBlocked('user-1', IdentifierType.USER_ID);
      expect(unblocked.blocked).toBe(false);
    });

    it('should list active blocks', async () => {
      await limiter.block({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        durationMs: 60000,
        reason: 'Test 1',
      });

      await limiter.block({
        key: '192.168.1.1',
        identifierType: IdentifierType.IP,
        durationMs: 60000,
        reason: 'Test 2',
      });

      const result = await limiter.listBlocks();
      expect(result.blocks.length).toBe(2);
    });
  });

  describe('configuration', () => {
    it('should use default config when specified config not found', async () => {
      const result = await limiter.check({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'nonexistent',
      });

      expect(result.configName).toBe('default');
    });

    it('should add new config dynamically', () => {
      limiter.addConfig({
        name: 'custom',
        limit: 50,
        windowMs: 30000,
      });

      const config = limiter.getConfig('custom');
      expect(config).toBeDefined();
      expect(config!.limit).toBe(50);
    });

    it('should remove config', () => {
      limiter.addConfig({
        name: 'temp',
        limit: 10,
        windowMs: 60000,
      });

      expect(limiter.removeConfig('temp')).toBe(true);
      expect(limiter.getConfig('temp')).toBeUndefined();
    });
  });

  describe('status', () => {
    it('should return current bucket status', async () => {
      await limiter.checkAndIncrement({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      const status = await limiter.getStatus({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      expect(status.state.currentCount).toBe(1);
      expect(status.state.remaining).toBe(9);
      expect(status.isBlocked).toBe(false);
    });
  });

  describe('violations', () => {
    it('should record violation when limit exceeded', async () => {
      // Exceed limit
      for (let i = 0; i < 15; i++) {
        await limiter.checkAndIncrement({
          key: 'user-1',
          identifierType: IdentifierType.USER_ID,
          configName: 'default',
        });
      }

      const history = await limiter.getViolationHistory({
        key: 'user-1',
      });

      expect(history.violations.length).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up old entries', async () => {
      // Create some entries
      await limiter.checkAndIncrement({
        key: 'user-1',
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
      });

      const stats = storage.getStats();
      expect(stats.buckets).toBe(1);

      // Cleanup won't remove fresh entries
      const cleaned = await limiter.cleanup(1000);
      expect(cleaned).toBe(0);
    });
  });

  describe('health check', () => {
    it('should return true for healthy storage', async () => {
      const healthy = await limiter.healthCheck();
      expect(healthy).toBe(true);
    });
  });
});

describe('MemoryRateLimitStorage', () => {
  let storage: MemoryRateLimitStorage;

  beforeEach(() => {
    storage = createMemoryStorage({ maxBuckets: 100, maxViolations: 50 });
  });

  it('should enforce max buckets limit', async () => {
    // Create more buckets than limit
    for (let i = 0; i < 110; i++) {
      await storage.setBucket({
        id: `bucket-${i}`,
        key: `key-${i}`,
        identifierType: IdentifierType.USER_ID,
        configName: 'default',
        currentCount: 0,
        totalRequests: 0,
        windowStart: new Date(),
        windowSizeMs: 60000,
        limit: 10,
        violationCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const stats = storage.getStats();
    expect(stats.buckets).toBeLessThanOrEqual(100);
  });

  it('should clear all data', () => {
    storage.clear();
    const stats = storage.getStats();
    expect(stats.buckets).toBe(0);
    expect(stats.blocks).toBe(0);
    expect(stats.violations).toBe(0);
  });
});
