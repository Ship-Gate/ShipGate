import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Clock, Random, IdempotencyConfig } from '../types';
import { InMemoryStore } from '../key/store';
import { KeyGenerator } from '../key/generator';
import { KeyEntry } from '../key/entry';
import { HttpIdempotencyMiddleware } from '../middleware/http';
import { Deduplicator } from '../dedup/deduplicator';
import { Retry } from '../retry/retry';
import { CircuitBreaker } from '../retry/circuit-breaker';

// Mock implementations
const mockClock: Clock = {
  now: () => new Date('2024-01-01T00:00:00.000Z')
};

const mockRandom: Random = {
  uuid: () => '12345678-1234-1234-1234-123456789abc',
  bytes: (length: number) => new Uint8Array(length).fill(0x42),
  random: () => 0.5
};

describe('Integration Tests', () => {
  let store: InMemoryStore;
  let middleware: HttpIdempotencyMiddleware;
  let deduplicator: Deduplicator;
  let retry: Retry;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    store = new InMemoryStore(mockClock, mockRandom, {
      defaultTtl: 60000,
      cleanupInterval: 1000
    });

    const config: IdempotencyConfig = {
      defaultTtl: 60000,
      lockTimeout: 30000,
      maxRequestHashSize: 1024000,
      fingerprintHeaders: ['Content-Type', 'Authorization']
    };

    middleware = new HttpIdempotencyMiddleware(store, mockClock, config);
    deduplicator = new Deduplicator(mockClock, mockRandom);
    retry = Retry.withDefaults(mockClock, mockRandom, {
      maxAttempts: 3,
      initialDelay: 100
    });
    circuitBreaker = CircuitBreaker.withDefaults(mockClock, mockRandom, {
      failureThreshold: 5,
      recoveryTimeout: 60000
    });
  });

  it('handles concurrent requests with same key', async () => {
    const key = 'concurrent-test-key';
    const request = {
      method: 'POST',
      url: '/api/test',
      headers: { 'Idempotency-Key': key },
      body: '{"test": true}'
    };

    // Process first request
    const result1 = await middleware['guard'].process(request);
    expect(result1.continue).toBe(true);
    expect(result1.idempotency.lockToken).toBeDefined();

    // Process second request with same key
    const result2 = await middleware['guard'].process(request);
    expect(result2.continue).toBe(false);
    expect(result2.response?.statusCode).toBe(409);
  });

  it('returns cached result for completed requests', async () => {
    const key = 'cached-test-key';
    const request = {
      method: 'POST',
      url: '/api/test',
      headers: { 'Idempotency-Key': key },
      body: '{"test": true}'
    };

    // Create completed record
    const record = new KeyEntry().createRecord(
      key,
      'hash',
      60000,
      mockClock.now()
    );
    
    const completed = new KeyEntry().markCompleted(
      record,
      '{"result": "cached"}',
      200,
      'application/json'
    );

    await store.create(completed);

    // Process request
    const result = await middleware['guard'].process(request);
    
    expect(result.continue).toBe(false);
    expect(result.idempotency.isReplay).toBe(true);
    expect(result.response?.body).toBe('{"result": "cached"}');
  });

  it('prevents duplicate processing with deduplicator', async () => {
    const item = 'duplicate-item';
    
    // First check
    const result1 = deduplicator.check(item);
    expect(result1.isDuplicate).toBe(false);
    expect(result1.count).toBe(1);

    // Second check
    const result2 = deduplicator.check(item);
    expect(result2.isDuplicate).toBe(true);
    expect(result2.count).toBe(2);

    // Verify Bloom filter stats
    const stats = deduplicator.stats();
    expect(stats.cache.size).toBe(1);
  });

  it('retries failed operations', async () => {
    let attempts = 0;
    const operation = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });

    const result = await retry.execute(operation);
    
    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('opens circuit breaker after threshold', async () => {
    const failingOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

    // Fail 5 times to open circuit
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Ignore
      }
    }

    expect(circuitBreaker.isOpen()).toBe(true);

    // Should reject immediately
    await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
    expect(failingOperation).toHaveBeenCalledTimes(5); // No additional call
  });

  it('combines all components for complete flow', async () => {
    const key = new KeyGenerator(mockRandom).uuid();
    const request = {
      method: 'POST',
      url: '/api/payment',
      headers: { 
        'Idempotency-Key': key,
        'Content-Type': 'application/json'
      },
      body: '{"amount": 100, "currency": "USD"}'
    };

    // Check deduplication
    const dedupResult = deduplicator.check(key);
    expect(dedupResult.isDuplicate).toBe(false);

    // Process through middleware
    const middlewareResult = await middleware['guard'].process(request);
    expect(middlewareResult.continue).toBe(true);

    // Simulate operation with retry and circuit breaker
    let operationAttempts = 0;
    const paymentOperation = async () => {
      operationAttempts++;
      
      // Use circuit breaker
      return await circuitBreaker.execute(async () => {
        // Simulate payment processing
        if (operationAttempts === 1) {
          throw new Error('Payment gateway timeout');
        }
        return { paymentId: 'pay_123', status: 'completed' };
      });
    };

    // Execute with retry
    const paymentResult = await retry.execute(paymentOperation);
    
    expect(paymentResult.success).toBe(true);
    expect(paymentResult.result).toEqual({
      paymentId: 'pay_123',
      status: 'completed'
    });

    // Record completion
    await middleware.recordCompletion(
      key,
      JSON.stringify(paymentResult.result),
      200,
      'application/json',
      middlewareResult.idempotency.lockToken
    );

    // Verify record is stored
    const record = await store.get(key);
    expect(record?.status).toBe('COMPLETED');
    expect(record?.response).toBe(JSON.stringify(paymentResult.result));

    // Test replay
    const replayResult = await middleware['guard'].process(request);
    expect(replayResult.continue).toBe(false);
    expect(replayResult.idempotency.isReplay).toBe(true);
    expect(replayResult.response?.body).toBe(JSON.stringify(paymentResult.result));
  });

  it('handles request hash mismatches', async () => {
    const key = 'hash-mismatch-key';
    const keyEntry = new KeyEntry();

    // Create record with different request hash
    const record = keyEntry.createRecord(key, 'old-hash', 60000, mockClock.now());
    await store.create(record);

    // Process request with different body
    const request = {
      method: 'POST',
      url: '/api/test',
      headers: { 'Idempotency-Key': key },
      body: '{"different": "body"}'
    };

    const result = await middleware['guard'].process(request);
    
    // Should still process but indicate mismatch
    expect(result.continue).toBe(true);
  });

  it('properly cleans up expired records', async () => {
    // Create expired record
    const expiredRecord = new KeyEntry().createRecord(
      'expired-key',
      'hash',
      -1000, // Negative TTL = already expired
      new Date('2023-01-01T00:00:00.000Z')
    );

    await store.create(expiredRecord);

    // Try to retrieve
    const retrieved = await store.get('expired-key');
    expect(retrieved).toBeNull();

    // Stats should show no records
    const stats = store.stats();
    expect(stats.records).toBe(0);
  });
});
