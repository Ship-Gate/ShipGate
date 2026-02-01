// ============================================================================
// ISL Standard Library - Manager Tests
// @stdlib/idempotency/tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  IdempotencyManager,
  createIdempotencyManager,
  createMemoryStore,
  MemoryIdempotencyStore,
  RecordStatus,
  IdempotencyErrorCode,
} from '../implementations/typescript';

describe('IdempotencyManager', () => {
  let store: MemoryIdempotencyStore;
  let manager: IdempotencyManager;

  beforeEach(() => {
    store = createMemoryStore({
      defaultTtl: 60000,
      lockTimeout: 5000,
      cleanupInterval: 0,
    });

    manager = createIdempotencyManager({
      store,
      maxRetries: 3,
      baseRetryDelay: 10,
    });
  });

  afterEach(async () => {
    await manager.close();
  });

  describe('execute', () => {
    it('should execute operation and cache result', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return { id: 'result-123' };
      };

      const result1 = await manager.execute('key-1', { input: 'data' }, operation);

      expect(result1.success).toBe(true);
      expect(result1.replayed).toBe(false);
      if (result1.success) {
        expect(result1.data).toEqual({ id: 'result-123' });
      }
      expect(callCount).toBe(1);

      // Second call should return cached result
      const result2 = await manager.execute('key-1', { input: 'data' }, operation);

      expect(result2.success).toBe(true);
      expect(result2.replayed).toBe(true);
      if (result2.success) {
        expect(result2.data).toEqual({ id: 'result-123' });
      }
      expect(callCount).toBe(1); // Operation not called again
    });

    it('should detect request mismatch', async () => {
      await manager.execute('key-1', { amount: 100 }, async () => ({ ok: true }));

      const result = await manager.execute(
        'key-1',
        { amount: 200 }, // Different payload
        async () => ({ ok: true })
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(IdempotencyErrorCode.REQUEST_MISMATCH);
      }
    });

    it('should handle operation failure', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };

      await expect(
        manager.execute('key-1', { input: 'data' }, operation)
      ).rejects.toThrow('Operation failed');

      // Record should be released, allowing retry
      const retryResult = await manager.execute(
        'key-1',
        { input: 'data' },
        async () => ({ recovered: true })
      );

      expect(retryResult.success).toBe(true);
    });

    it('should use custom serializer', async () => {
      const serialize = vi.fn((data: { value: number }) => `custom:${data.value}`);
      const deserialize = vi.fn((str: string) => ({
        value: parseInt(str.replace('custom:', ''), 10),
      }));

      await manager.execute(
        'key-1',
        { input: 1 },
        async () => ({ value: 42 }),
        { serialize, deserialize }
      );

      expect(serialize).toHaveBeenCalledWith({ value: 42 });

      // Replay should use deserializer
      const result = await manager.execute(
        'key-1',
        { input: 1 },
        async () => ({ value: 0 }),
        { serialize, deserialize }
      );

      expect(deserialize).toHaveBeenCalled();
      if (result.success) {
        expect(result.data).toEqual({ value: 42 });
      }
    });
  });

  describe('executeWithRetry', () => {
    it('should retry on concurrent request', async () => {
      // Simulate concurrent request by manually creating processing record
      await store.startProcessing({
        key: 'busy-key',
        requestHash: manager.computeHash({ input: 1 }),
        lockTimeout: 50, // Short timeout
      });

      // This should fail initially but succeed after lock expires
      const result = await manager.executeWithRetry(
        'busy-key',
        { input: 1 },
        async () => ({ result: 'success' }),
        { maxRetries: 5 }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('low-level API', () => {
    it('should check for existing records', async () => {
      const result1 = await manager.check({
        key: 'new-key',
        requestHash: 'hash123',
      });

      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.found).toBe(false);
      }
    });

    it('should start processing', async () => {
      const result = await manager.startProcessing({
        key: 'proc-key',
        requestHash: 'hash123',
      });

      expect(result.acquired).toBe(true);
      expect(result.lockToken).toBeDefined();
    });

    it('should record response', async () => {
      const lock = await manager.startProcessing({
        key: 'rec-key',
        requestHash: 'hash123',
      });

      const result = await manager.record({
        key: 'rec-key',
        requestHash: 'hash123',
        response: '{"data": true}',
        lockToken: lock.lockToken,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(RecordStatus.COMPLETED);
      }
    });

    it('should release lock', async () => {
      const lock = await manager.startProcessing({
        key: 'rel-key',
        requestHash: 'hash123',
      });

      const result = await manager.releaseLock({
        key: 'rel-key',
        lockToken: lock.lockToken!,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.released).toBe(true);
      }
    });

    it('should extend lock', async () => {
      const lock = await manager.startProcessing({
        key: 'ext-key',
        requestHash: 'hash123',
        lockTimeout: 1000,
      });

      const result = await manager.extendLock({
        key: 'ext-key',
        lockToken: lock.lockToken!,
        extension: 5000,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.extended).toBe(true);
      }
    });

    it('should cleanup expired records', async () => {
      // Create expired record
      await store.startProcessing({
        key: 'expired-key',
        requestHash: 'hash123',
      });
      await store.record({
        key: 'expired-key',
        requestHash: 'hash123',
        response: '{}',
        ttl: 1,
      });

      await new Promise((r) => setTimeout(r, 10));

      const result = await manager.cleanup();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deletedCount).toBe(1);
      }
    });
  });

  describe('utility methods', () => {
    it('should compute consistent hash', () => {
      const hash1 = manager.computeHash({ a: 1, b: 2 });
      const hash2 = manager.computeHash({ b: 2, a: 1 });

      expect(hash1).toBe(hash2);
    });

    it('should compute HTTP hash', () => {
      const hash = manager.computeHttpHash(
        'POST',
        '/api/users',
        { name: 'John' }
      );

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('admin operations', () => {
    it('should get record', async () => {
      await manager.execute('get-test', { x: 1 }, async () => ({ done: true }));

      const record = await manager.get('get-test');

      expect(record).toBeDefined();
      expect(record?.status).toBe(RecordStatus.COMPLETED);
    });

    it('should delete record', async () => {
      await manager.execute('del-test', { x: 1 }, async () => ({ done: true }));

      const deleted = await manager.delete('del-test');

      expect(deleted).toBe(true);
      expect(await manager.get('del-test')).toBeNull();
    });

    it('should check health', async () => {
      const healthy = await manager.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error result when throwOnError is false', async () => {
      const manager = createIdempotencyManager({
        store,
        throwOnError: false,
      });

      // Try to release non-existent lock
      const result = await manager.releaseLock({
        key: 'nonexistent',
        lockToken: 'fake-token',
      });

      expect(result.success).toBe(false);

      await manager.close();
    });
  });
});
