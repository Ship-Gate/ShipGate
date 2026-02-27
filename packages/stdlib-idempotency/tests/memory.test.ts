// ============================================================================
// ISL Standard Library - Memory Store Tests
// @stdlib/idempotency/tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MemoryIdempotencyStore,
  createMemoryStore,
  RecordStatus,
  IdempotencyException,
} from '../implementations/typescript';

describe('MemoryIdempotencyStore', () => {
  let store: MemoryIdempotencyStore;

  beforeEach(() => {
    store = createMemoryStore({
      defaultTtl: 60000, // 1 minute
      lockTimeout: 5000, // 5 seconds
      cleanupInterval: 0, // Disable auto cleanup
    });
  });

  afterEach(async () => {
    await store.close();
  });

  describe('check', () => {
    it('should return not found for new key', async () => {
      const result = await store.check({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(result.found).toBe(false);
      expect(result.requestMismatch).toBe(false);
    });

    it('should return found for existing key', async () => {
      // First, start processing
      await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      // Record completion
      await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{"result": "success"}',
      });

      // Check
      const result = await store.check({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe(RecordStatus.COMPLETED);
      expect(result.response).toBe('{"result": "success"}');
      expect(result.requestMismatch).toBe(false);
    });

    it('should detect request mismatch', async () => {
      await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{"result": "success"}',
      });

      const result = await store.check({
        key: 'test-key',
        requestHash: 'different-hash',
      });

      expect(result.found).toBe(true);
      expect(result.requestMismatch).toBe(true);
      expect(result.response).toBeUndefined();
    });
  });

  describe('startProcessing', () => {
    it('should acquire lock for new key', async () => {
      const result = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(result.acquired).toBe(true);
      expect(result.lockToken).toBeDefined();
      expect(result.lockExpiresAt).toBeDefined();
    });

    it('should reject duplicate concurrent request', async () => {
      const first = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(first.acquired).toBe(true);

      const second = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(second.acquired).toBe(false);
      expect(second.existingStatus).toBe(RecordStatus.PROCESSING);
    });

    it('should return cached response for completed request', async () => {
      await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{"done": true}',
        httpStatusCode: 200,
      });

      const result = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(result.acquired).toBe(false);
      expect(result.existingStatus).toBe(RecordStatus.COMPLETED);
      expect(result.existingResponse).toBe('{"done": true}');
      expect(result.existingHttpStatusCode).toBe(200);
    });

    it('should detect request mismatch', async () => {
      await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{}',
      });

      const result = await store.startProcessing({
        key: 'test-key',
        requestHash: 'different-hash',
      });

      expect(result.acquired).toBe(false);
      expect(result.requestMismatch).toBe(true);
    });

    it('should allow retry after failure', async () => {
      const first = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });
      expect(first.acquired).toBe(true);

      await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{"error": "failed"}',
        markAsFailed: true,
      });

      const retry = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(retry.acquired).toBe(true);
    });
  });

  describe('record', () => {
    it('should record completed response', async () => {
      const lock = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      const record = await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{"id": "123"}',
        httpStatusCode: 201,
        contentType: 'application/json',
        lockToken: lock.lockToken,
      });

      expect(record.status).toBe(RecordStatus.COMPLETED);
      expect(record.response).toBe('{"id": "123"}');
      expect(record.httpStatusCode).toBe(201);
      expect(record.completedAt).toBeDefined();
    });

    it('should record failed response', async () => {
      const lock = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      const record = await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{"error": "validation failed"}',
        httpStatusCode: 400,
        markAsFailed: true,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Invalid input',
        lockToken: lock.lockToken,
      });

      expect(record.status).toBe(RecordStatus.FAILED);
      expect(record.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid lock token', async () => {
      await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      await expect(
        store.record({
          key: 'test-key',
          requestHash: 'hash123',
          response: '{}',
          lockToken: 'wrong-token',
        })
      ).rejects.toThrow(IdempotencyException);
    });
  });

  describe('releaseLock', () => {
    it('should delete record when releasing lock', async () => {
      const lock = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      const result = await store.releaseLock({
        key: 'test-key',
        lockToken: lock.lockToken!,
      });

      expect(result.released).toBe(true);
      expect(result.recordDeleted).toBe(true);

      const check = await store.check({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(check.found).toBe(false);
    });

    it('should mark as failed instead of deleting', async () => {
      const lock = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      const result = await store.releaseLock({
        key: 'test-key',
        lockToken: lock.lockToken!,
        markFailed: true,
        errorCode: 'TIMEOUT',
        errorMessage: 'Request timed out',
      });

      expect(result.released).toBe(true);
      expect(result.recordMarkedFailed).toBe(true);

      const record = await store.get('test-key');
      expect(record?.status).toBe(RecordStatus.FAILED);
      expect(record?.errorCode).toBe('TIMEOUT');
    });
  });

  describe('extendLock', () => {
    it('should extend lock timeout', async () => {
      const lock = await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
        lockTimeout: 1000,
      });

      const originalExpiry = lock.lockExpiresAt!;

      // Wait a bit
      await new Promise((r) => setTimeout(r, 100));

      const result = await store.extendLock({
        key: 'test-key',
        lockToken: lock.lockToken!,
        extension: 5000,
      });

      expect(result.extended).toBe(true);
      expect(result.newExpiresAt.getTime()).toBeGreaterThan(originalExpiry.getTime());
    });
  });

  describe('cleanup', () => {
    it('should delete expired records', async () => {
      // Create some records
      await store.startProcessing({
        key: 'key-1',
        requestHash: 'hash1',
      });
      await store.record({
        key: 'key-1',
        requestHash: 'hash1',
        response: '{}',
        ttl: 1, // Expires immediately
      });

      await store.startProcessing({
        key: 'key-2',
        requestHash: 'hash2',
      });
      await store.record({
        key: 'key-2',
        requestHash: 'hash2',
        response: '{}',
        ttl: 60000, // Expires later
      });

      // Wait for first to expire
      await new Promise((r) => setTimeout(r, 10));

      const result = await store.cleanup({});

      expect(result.deletedCount).toBe(1);
    });

    it('should support dry run', async () => {
      await store.startProcessing({
        key: 'key-1',
        requestHash: 'hash1',
      });
      await store.record({
        key: 'key-1',
        requestHash: 'hash1',
        response: '{}',
        ttl: 1,
      });

      await new Promise((r) => setTimeout(r, 10));

      const result = await store.cleanup({ dryRun: true });

      expect(result.deletedCount).toBe(1);
      expect(store.size).toBe(1); // Still exists
    });
  });

  describe('admin operations', () => {
    it('should get record by key', async () => {
      await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      await store.record({
        key: 'test-key',
        requestHash: 'hash123',
        response: '{"data": true}',
      });

      const record = await store.get('test-key');

      expect(record).toBeDefined();
      expect(record?.response).toBe('{"data": true}');
    });

    it('should delete record by key', async () => {
      await store.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      const deleted = await store.delete('test-key');

      expect(deleted).toBe(true);
      expect(await store.get('test-key')).toBeNull();
    });

    it('should pass health check', async () => {
      const healthy = await store.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('key prefixing', () => {
    it('should apply key prefix', async () => {
      const prefixedStore = createMemoryStore({
        keyPrefix: 'myapp',
        cleanupInterval: 0,
      });

      await prefixedStore.startProcessing({
        key: 'test-key',
        requestHash: 'hash123',
      });

      expect(prefixedStore.keys).toContain('myapp:test-key');

      await prefixedStore.close();
    });
  });

  describe('max records eviction', () => {
    it('should evict oldest record when at capacity', async () => {
      const limitedStore = createMemoryStore({
        maxRecords: 2,
        cleanupInterval: 0,
      });

      await limitedStore.startProcessing({ key: 'key-1', requestHash: 'h1' });
      await limitedStore.record({ key: 'key-1', requestHash: 'h1', response: '1' });

      await new Promise((r) => setTimeout(r, 10));

      await limitedStore.startProcessing({ key: 'key-2', requestHash: 'h2' });
      await limitedStore.record({ key: 'key-2', requestHash: 'h2', response: '2' });

      await new Promise((r) => setTimeout(r, 10));

      // This should evict key-1
      await limitedStore.startProcessing({ key: 'key-3', requestHash: 'h3' });

      expect(limitedStore.size).toBe(2);
      expect(await limitedStore.get('key-1')).toBeNull();

      await limitedStore.close();
    });
  });
});
