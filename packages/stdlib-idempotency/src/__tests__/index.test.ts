import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Clock, Random } from '../types';
import { InMemoryStore } from '../key/store';
import { KeyGenerator } from '../key/generator';
import { KeyEntry } from '../key/entry';
import { IdempotencyGuard } from '../middleware/guard';
import { BloomFilter } from '../dedup/bloom';
import { Deduplicator } from '../dedup/deduplicator';
import { Retry } from '../retry/retry';
import { CircuitBreaker } from '../retry/circuit-breaker';
import { ExponentialBackoff, RetryConditions } from '../retry/strategies';

// Mock implementations
const mockClock: Clock = {
  now: () => new Date('2024-01-01T00:00:00.000Z')
};

const mockRandom: Random = {
  uuid: () => '12345678-1234-1234-1234-123456789abc',
  bytes: (length: number) => new Uint8Array(length).fill(0x42),
  random: () => 0.5
};

describe('Idempotency Package', () => {
  describe('KeyGenerator', () => {
    let generator: KeyGenerator;

    beforeEach(() => {
      generator = new KeyGenerator(mockRandom);
    });

    it('generates UUID keys', () => {
      const key = generator.uuid();
      expect(key).toBe('12345678-1234-1234-1234-123456789abc');
    });

    it('generates random keys with prefix', () => {
      generator = new KeyGenerator(mockRandom, { prefix: 'test_' });
      const key = generator.random(16);
      expect(key).toMatch(/^test_/);
    });

    it('generates deterministic keys', () => {
      const key1 = generator.deterministic('test');
      const key2 = generator.deterministic('test');
      expect(key1).toBe(key2);
    });

    it('generates timestamp-based keys', () => {
      const key = generator.timestamp();
      expect(key).toMatch(/^\d+-[a-f0-9]+$/);
    });
  });

  describe('InMemoryStore', () => {
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore(mockClock, mockRandom, {
        defaultTtl: 60000,
        cleanupInterval: 1000
      });
    });

    it('stores and retrieves records', async () => {
      const record = {
        key: 'test-key',
        requestHash: 'hash',
        status: 'PROCESSING' as const,
        createdAt: mockClock.now(),
        updatedAt: mockClock.now(),
        expiresAt: new Date(mockClock.now().getTime() + 60000)
      };

      await store.create(record);
      const retrieved = await store.get('test-key');
      
      expect(retrieved).toEqual(record);
    });

    it('handles concurrent lock acquisition', async () => {
      const key = 'test-key';
      const lockToken = 'token1';
      const expiresAt = new Date(mockClock.now().getTime() + 30000);

      const acquired1 = await store.acquireLock(key, lockToken, expiresAt);
      expect(acquired1).toBe(true);

      const acquired2 = await store.acquireLock(key, 'token2', expiresAt);
      expect(acquired2).toBe(false);

      const released = await store.releaseLock(key, lockToken);
      expect(released).toBe(true);
    });

    it('cleans up expired records', async () => {
      const expiredRecord = {
        key: 'expired-key',
        requestHash: 'hash',
        status: 'PROCESSING' as const,
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
        expiresAt: new Date('2023-01-01T00:00:00.000Z')
      };

      await store.create(expiredRecord);
      const retrieved = await store.get('expired-key');
      expect(retrieved).toBeNull();
    });
  });

  describe('KeyEntry', () => {
    let keyEntry: KeyEntry;

    beforeEach(() => {
      keyEntry = new KeyEntry();
    });

    it('validates keys correctly', () => {
      expect(() => keyEntry.validate('valid-key-123')).not.toThrow();
      expect(() => keyEntry.validate('')).toThrow();
      expect(() => keyEntry.validate('invalid key!')).toThrow();
    });

    it('creates request hash', () => {
      const hash = keyEntry.createRequestHash({
        method: 'POST',
        url: '/api/test',
        headers: { 'Content-Type': 'application/json' },
        body: '{"test": true}'
      });

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('marks records as completed', () => {
      const record = {
        key: 'test',
        requestHash: 'hash',
        status: 'PROCESSING' as const,
        createdAt: mockClock.now(),
        updatedAt: mockClock.now(),
        expiresAt: new Date(mockClock.now().getTime() + 60000)
      };

      const completed = keyEntry.markCompleted(
        record,
        '{"result": "success"}',
        200,
        'application/json'
      );

      expect(completed.status).toBe('COMPLETED');
      expect(completed.response).toBe('{"result": "success"}');
      expect(completed.httpStatusCode).toBe(200);
    });
  });

  describe('BloomFilter', () => {
    let filter: BloomFilter;

    beforeEach(() => {
      filter = new BloomFilter(
        {
          expectedItems: 1000,
          falsePositiveRate: 0.01
        },
        mockRandom
      );
    });

    it('adds and checks items', () => {
      filter.add('item1');
      expect(filter.mightContain('item1')).toBe(true);
      expect(filter.mightContain('item2')).toBe(false);
    });

    it('has reasonable false positive rate', () => {
      // Add many items
      for (let i = 0; i < 1000; i++) {
        filter.add(`item${i}`);
      }

      // Check items not added
      let falsePositives = 0;
      for (let i = 1000; i < 1100; i++) {
        if (filter.mightContain(`item${i}`)) {
          falsePositives++;
        }
      }

      // Should be around 1% (10 items out of 1000)
      expect(falsePositives).toBeLessThan(20);
    });

    it('provides statistics', () => {
      const stats = filter.stats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.hashCount).toBeGreaterThan(0);
      expect(stats.expectedFalsePositiveRate).toBe(0.01);
    });
  });

  describe('Deduplicator', () => {
    let deduplicator: Deduplicator;

    beforeEach(() => {
      deduplicator = new Deduplicator(mockClock, mockRandom, {
        timeWindow: 60000,
        maxCacheSize: 1000
      });
    });

    it('detects duplicates', () => {
      const result1 = deduplicator.check('item1');
      expect(result1.isDuplicate).toBe(false);

      const result2 = deduplicator.check('item1');
      expect(result2.isDuplicate).toBe(true);
      expect(result2.count).toBe(2);
    });

    it('handles false positives from Bloom filter', () => {
      // Add item to Bloom filter but not cache
      deduplicator.add('item1');
      deduplicator.remove('item1');

      const result = deduplicator.check('item1');
      expect(result.isDuplicate).toBe(false); // Should handle false positive
    });

    it('provides statistics', () => {
      deduplicator.check('item1');
      deduplicator.check('item2');

      const stats = deduplicator.stats();
      expect(stats.cache.size).toBe(2);
      expect(stats.bloomFilter).toBeDefined();
    });
  });

  describe('Retry', () => {
    let retry: Retry;

    beforeEach(() => {
      retry = Retry.withDefaults(mockClock, mockRandom, {
        maxAttempts: 3,
        initialDelay: 100
      });
    });

    it('retries on failure', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await retry.execute(fn);
      
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('respects retry conditions', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Non-retryable'));
      const condition = RetryConditions.networkErrors;

      const result = await retry.execute(fn, condition);
      
      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
    });

    it('uses exponential backoff', async () => {
      const backoff = new ExponentialBackoff(2, 0, mockRandom);
      const delays: number[] = [];

      const customRetry = new Retry(mockClock, mockRandom, {
        maxAttempts: 3,
        initialDelay: 100
      });

      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          delays.push(backoff.calculate(attempts, 100));
          throw new Error('Failure');
        }
        return 'success';
      });

      await customRetry.executeWithBackoff(fn, backoff);
      
      expect(delays).toEqual([100, 200]);
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = CircuitBreaker.withDefaults(mockClock, mockRandom, {
        failureThreshold: 3,
        recoveryTimeout: 60000
      });
    });

    it('opens after failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failure'));

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch {
          // Ignore
        }
      }

      expect(circuitBreaker.isOpen()).toBe(true);

      // Should reject on 4th call
      await expect(circuitBreaker.execute(fn)).rejects.toThrow();
    });

    it('transitions through states correctly', async () => {
      const successFn = vi.fn().mockResolvedValue('success');
      const failFn = vi.fn().mockRejectedValue(new Error('failure'));

      // Fail to open
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failFn);
        } catch {
          // Ignore
        }
      }

      expect(circuitBreaker.isOpen()).toBe(true);

      // Mock time passing
      mockClock.now = () => new Date('2024-01-01T02:00:00.000Z');

      // Should transition to half-open
      try {
        await circuitBreaker.execute(successFn);
      } catch {
        // Ignore
      }

      expect(circuitBreaker.isHalfOpen()).toBe(true);

      // Success should close circuit
      await circuitBreaker.execute(successFn);
      expect(circuitBreaker.isClosed()).toBe(true);
    });

    it('provides metrics', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failure'));

      try {
        await circuitBreaker.execute(fn);
      } catch {
        // Ignore
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(1);
      expect(metrics.successes).toBe(0);
      expect(metrics.lastFailureTime).toBeDefined();
    });
  });

  describe('IdempotencyGuard', () => {
    let guard: IdempotencyGuard;
    let store: InMemoryStore;

    beforeEach(() => {
      store = new InMemoryStore(mockClock, mockRandom, { defaultTtl: 60000 });
      guard = new IdempotencyGuard(store, mockClock, new KeyEntry());
    });

    it('processes new requests', async () => {
      const request = {
        method: 'POST',
        url: '/api/test',
        headers: { 'Idempotency-Key': 'test-key' },
        body: '{"test": true}'
      };

      const result = await guard.process(request);
      
      expect(result.continue).toBe(true);
      expect(result.idempotency.key).toBe('test-key');
      expect(result.idempotency.isReplay).toBe(false);
      expect(result.idempotency.lockToken).toBeDefined();
    });

    it('handles replay requests', async () => {
      const record = {
        key: 'test-key',
        requestHash: 'hash',
        response: '{"result": "cached"}',
        status: 'COMPLETED' as const,
        httpStatusCode: 200,
        contentType: 'application/json',
        createdAt: mockClock.now(),
        updatedAt: mockClock.now(),
        expiresAt: new Date(mockClock.now().getTime() + 60000),
        completedAt: mockClock.now()
      };

      await store.create(record);

      const request = {
        method: 'POST',
        url: '/api/test',
        headers: { 'Idempotency-Key': 'test-key' },
        body: '{"test": true}'
      };

      const result = await guard.process(request);
      
      expect(result.continue).toBe(false);
      expect(result.idempotency.isReplay).toBe(true);
      expect(result.response?.body).toBe('{"result": "cached"}');
    });

    it('rejects invalid keys', async () => {
      const request = {
        method: 'POST',
        url: '/api/test',
        headers: { 'Idempotency-Key': 'invalid key!' },
        body: '{"test": true}'
      };

      const result = await guard.process(request);
      
      expect(result.continue).toBe(false);
      expect(result.response?.statusCode).toBe(400);
    });
  });
});
