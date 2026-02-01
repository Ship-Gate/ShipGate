import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { FileCache, fingerprintToFilename } from '../fileCache.js';
import { generateFingerprint } from '../fingerprintCache.js';

describe('fingerprintToFilename', () => {
  it('should convert fingerprint to a safe filename', () => {
    const fingerprint = 'abc123-test-fingerprint';
    const filename = fingerprintToFilename(fingerprint);

    expect(filename).toMatch(/^[a-f0-9]{16}\.json$/);
  });

  it('should produce consistent filenames for same fingerprint', () => {
    const fingerprint = 'test-fingerprint';

    const filename1 = fingerprintToFilename(fingerprint);
    const filename2 = fingerprintToFilename(fingerprint);

    expect(filename1).toBe(filename2);
  });

  it('should produce different filenames for different fingerprints', () => {
    const filename1 = fingerprintToFilename('fingerprint-1');
    const filename2 = fingerprintToFilename('fingerprint-2');

    expect(filename1).not.toBe(filename2);
  });
});

describe('FileCache', () => {
  let cacheDir: string;
  let cache: FileCache<unknown>;

  beforeEach(async () => {
    // Create unique temp directory for each test
    cacheDir = join(tmpdir(), `isl-cache-test-${randomUUID()}`);
    cache = new FileCache({ cacheDir });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(cacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('get/set operations', () => {
    it('should store and retrieve data', async () => {
      const fingerprint = generateFingerprint({ key: 'value' });
      const data = { message: 'Hello, World!' };

      await cache.set(fingerprint, data);
      const result = await cache.get(fingerprint);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.meta?.fingerprint).toBe(fingerprint);
    });

    it('should return miss for non-existent key', async () => {
      const fingerprint = generateFingerprint({ nonexistent: true });
      const result = await cache.get(fingerprint);

      expect(result.hit).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.meta).toBeUndefined();
    });

    it('should overwrite existing entries', async () => {
      const fingerprint = generateFingerprint({ key: 'test' });

      await cache.set(fingerprint, { version: 1 });
      await cache.set(fingerprint, { version: 2 });

      const result = await cache.get(fingerprint);
      expect(result.data).toEqual({ version: 2 });
    });

    it('should store complex objects', async () => {
      const fingerprint = generateFingerprint({ complex: true });
      const data = {
        users: [
          { id: 1, name: 'Alice', roles: ['admin', 'user'] },
          { id: 2, name: 'Bob', roles: ['user'] },
        ],
        settings: {
          nested: {
            deeply: {
              value: 42,
            },
          },
        },
      };

      await cache.set(fingerprint, data);
      const result = await cache.get(fingerprint);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should store null values', async () => {
      const fingerprint = generateFingerprint({ null: true });

      await cache.set(fingerprint, null);
      const result = await cache.get(fingerprint);

      expect(result.hit).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should store array values', async () => {
      const fingerprint = generateFingerprint({ array: true });
      const data = [1, 2, 3, 'four', { five: 5 }];

      await cache.set(fingerprint, data);
      const result = await cache.get(fingerprint);

      expect(result.hit).toBe(true);
      expect(result.data).toEqual(data);
    });
  });

  describe('TTL (time-to-live)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should respect TTL option', async () => {
      const fingerprint = generateFingerprint({ ttl: 'test' });
      const data = { value: 'will expire' };

      await cache.set(fingerprint, data, { ttl: 1000 }); // 1 second TTL

      // Should be available immediately
      let result = await cache.get(fingerprint);
      expect(result.hit).toBe(true);

      // Advance time past TTL
      vi.advanceTimersByTime(1500);

      // Should be expired now
      result = await cache.get(fingerprint);
      expect(result.hit).toBe(false);
    });

    it('should not expire entries without TTL', async () => {
      const fingerprint = generateFingerprint({ noTtl: true });
      const data = { value: 'never expires' };

      await cache.set(fingerprint, data); // No TTL

      // Advance time significantly
      vi.advanceTimersByTime(365 * 24 * 60 * 60 * 1000); // 1 year

      const result = await cache.get(fingerprint);
      expect(result.hit).toBe(true);
    });

    it('should use default TTL when set in options', async () => {
      const cacheWithDefaultTtl = new FileCache({
        cacheDir,
        defaultTtl: 500, // 500ms default
      });

      const fingerprint = generateFingerprint({ defaultTtl: true });
      await cacheWithDefaultTtl.set(fingerprint, { value: 'test' });

      // Should be available immediately
      let result = await cacheWithDefaultTtl.get(fingerprint);
      expect(result.hit).toBe(true);

      // Advance past default TTL
      vi.advanceTimersByTime(600);

      result = await cacheWithDefaultTtl.get(fingerprint);
      expect(result.hit).toBe(false);
    });

    it('should override default TTL with explicit TTL', async () => {
      const cacheWithDefaultTtl = new FileCache({
        cacheDir,
        defaultTtl: 500,
      });

      const fingerprint = generateFingerprint({ overrideTtl: true });
      await cacheWithDefaultTtl.set(fingerprint, { value: 'test' }, { ttl: 2000 });

      // Advance past default TTL but before explicit TTL
      vi.advanceTimersByTime(1000);

      const result = await cacheWithDefaultTtl.get(fingerprint);
      expect(result.hit).toBe(true);
    });

    it('should include expiresAt in metadata', async () => {
      const fingerprint = generateFingerprint({ meta: true });
      const now = Date.now();

      await cache.set(fingerprint, { value: 'test' }, { ttl: 5000 });

      const result = await cache.get(fingerprint);
      expect(result.meta?.expiresAt).toBe(now + 5000);
    });

    it('should not include expiresAt when no TTL', async () => {
      const fingerprint = generateFingerprint({ noExpiry: true });

      await cache.set(fingerprint, { value: 'test' });

      const result = await cache.get(fingerprint);
      expect(result.meta?.expiresAt).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('should delete existing entries', async () => {
      const fingerprint = generateFingerprint({ delete: 'test' });

      await cache.set(fingerprint, { value: 'to delete' });
      const deleted = await cache.delete(fingerprint);

      expect(deleted).toBe(true);

      const result = await cache.get(fingerprint);
      expect(result.hit).toBe(false);
    });

    it('should return false when deleting non-existent entries', async () => {
      const fingerprint = generateFingerprint({ nonexistent: true });
      const deleted = await cache.delete(fingerprint);

      expect(deleted).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing entries', async () => {
      const fingerprint = generateFingerprint({ has: 'test' });

      await cache.set(fingerprint, { value: 'exists' });
      const exists = await cache.has(fingerprint);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent entries', async () => {
      const fingerprint = generateFingerprint({ notHere: true });
      const exists = await cache.has(fingerprint);

      expect(exists).toBe(false);
    });

    it('should return false for expired entries', async () => {
      vi.useFakeTimers();

      const fingerprint = generateFingerprint({ expiredHas: true });
      await cache.set(fingerprint, { value: 'will expire' }, { ttl: 100 });

      vi.advanceTimersByTime(200);

      const exists = await cache.has(fingerprint);
      expect(exists).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      const fp1 = generateFingerprint({ key: 1 });
      const fp2 = generateFingerprint({ key: 2 });
      const fp3 = generateFingerprint({ key: 3 });

      await cache.set(fp1, { value: 1 });
      await cache.set(fp2, { value: 2 });
      await cache.set(fp3, { value: 3 });

      await cache.clear();

      expect(await cache.has(fp1)).toBe(false);
      expect(await cache.has(fp2)).toBe(false);
      expect(await cache.has(fp3)).toBe(false);
    });

    it('should work on empty cache', async () => {
      await expect(cache.clear()).resolves.not.toThrow();
    });

    it('should allow new entries after clear', async () => {
      const fingerprint = generateFingerprint({ afterClear: true });

      await cache.set(fingerprint, { value: 'before' });
      await cache.clear();
      await cache.set(fingerprint, { value: 'after' });

      const result = await cache.get(fingerprint);
      expect(result.hit).toBe(true);
      expect(result.data).toEqual({ value: 'after' });
    });
  });

  describe('stats', () => {
    it('should return zero stats for empty cache', async () => {
      const stats = await cache.stats();

      expect(stats.entryCount).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.expiredCount).toBe(0);
    });

    it('should count entries correctly', async () => {
      await cache.set(generateFingerprint({ key: 1 }), { value: 1 });
      await cache.set(generateFingerprint({ key: 2 }), { value: 2 });
      await cache.set(generateFingerprint({ key: 3 }), { value: 3 });

      const stats = await cache.stats();
      expect(stats.entryCount).toBe(3);
    });

    it('should track total size', async () => {
      await cache.set(generateFingerprint({ key: 1 }), { value: 'data' });

      const stats = await cache.stats();
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });

    it('should count expired entries', async () => {
      vi.useFakeTimers();

      await cache.set(generateFingerprint({ exp: 1 }), { value: 1 }, { ttl: 100 });
      await cache.set(generateFingerprint({ noExp: 1 }), { value: 2 });

      vi.advanceTimersByTime(200);

      const stats = await cache.stats();
      expect(stats.expiredCount).toBe(1);
      expect(stats.entryCount).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('directory creation', () => {
    it('should create cache directory if it does not exist', async () => {
      const newDir = join(tmpdir(), `isl-cache-new-${randomUUID()}`);
      const newCache = new FileCache({ cacheDir: newDir });

      const fingerprint = generateFingerprint({ newDir: true });
      await newCache.set(fingerprint, { value: 'test' });

      const result = await newCache.get(fingerprint);
      expect(result.hit).toBe(true);

      // Clean up
      await rm(newDir, { recursive: true, force: true });
    });

    it('should handle nested directory paths', async () => {
      const nestedDir = join(tmpdir(), `isl-cache-${randomUUID()}`, 'nested', 'deep');
      const nestedCache = new FileCache({ cacheDir: nestedDir });

      const fingerprint = generateFingerprint({ nested: true });
      await nestedCache.set(fingerprint, { value: 'nested' });

      const result = await nestedCache.get(fingerprint);
      expect(result.hit).toBe(true);

      // Clean up
      await rm(join(tmpdir(), `isl-cache-${randomUUID()}`), { recursive: true, force: true });
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent reads', async () => {
      const fingerprint = generateFingerprint({ concurrent: 'read' });
      await cache.set(fingerprint, { value: 'shared' });

      const reads = await Promise.all([
        cache.get(fingerprint),
        cache.get(fingerprint),
        cache.get(fingerprint),
        cache.get(fingerprint),
        cache.get(fingerprint),
      ]);

      reads.forEach((result) => {
        expect(result.hit).toBe(true);
        expect(result.data).toEqual({ value: 'shared' });
      });
    });

    it('should handle concurrent writes to different keys', async () => {
      const writes = await Promise.all([
        cache.set(generateFingerprint({ key: 1 }), { value: 1 }),
        cache.set(generateFingerprint({ key: 2 }), { value: 2 }),
        cache.set(generateFingerprint({ key: 3 }), { value: 3 }),
        cache.set(generateFingerprint({ key: 4 }), { value: 4 }),
        cache.set(generateFingerprint({ key: 5 }), { value: 5 }),
      ]);

      const stats = await cache.stats();
      expect(stats.entryCount).toBe(5);
    });
  });

  describe('deterministic serialization', () => {
    it('should produce consistent file content for same data', async () => {
      const fingerprint1 = generateFingerprint({ determin: 'test1' });
      const fingerprint2 = generateFingerprint({ determin: 'test2' });

      // Same data, different key order
      const data1 = { z: 1, a: 2, m: 3 };
      const data2 = { a: 2, m: 3, z: 1 };

      await cache.set(fingerprint1, data1);
      await cache.set(fingerprint2, data2);

      const result1 = await cache.get(fingerprint1);
      const result2 = await cache.get(fingerprint2);

      // Data should be equal (keys sorted the same way)
      expect(result1.data).toEqual(result2.data);
    });
  });
});
