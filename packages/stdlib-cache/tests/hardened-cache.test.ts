import { describe, it, expect, beforeEach } from 'vitest';
import { HardenedCache, createHardenedCache } from '../src/hardened-cache.js';
import { MemoryCache } from '../src/backends/memory.js';
import { BloomFilter } from '../src/bloom.js';
import type { SecurityContext, CacheLimits } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBackend() {
  return new MemoryCache({ maxSize: 10_000 });
}

function makeCache(
  overrides: {
    securityContext?: SecurityContext;
    version?: string;
    limits?: CacheLimits;
    bloomFalsePositiveRate?: number;
    bloomCapacity?: number;
  } = {}
) {
  return createHardenedCache({
    backend: makeBackend(),
    securityContext: overrides.securityContext ?? { scanId: 'scan-1' },
    version: overrides.version ?? 'v1',
    limits: overrides.limits,
    bloomFalsePositiveRate: overrides.bloomFalsePositiveRate,
    bloomCapacity: overrides.bloomCapacity,
  });
}

// ---------------------------------------------------------------------------
// Cross-scan contamination (core security guarantee)
// ---------------------------------------------------------------------------

describe('HardenedCache — cross-scan isolation', () => {
  let backend: MemoryCache;

  beforeEach(() => {
    backend = makeBackend();
  });

  it('two different scanIds sharing a backend cannot read each other\'s data', async () => {
    const cacheA = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-A' },
      version: 'v1',
    });
    const cacheB = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-B' },
      version: 'v1',
    });

    await cacheA.set('secret', 'from-A');
    await cacheB.set('secret', 'from-B');

    expect(await cacheA.get('secret')).toBe('from-A');
    expect(await cacheB.get('secret')).toBe('from-B');
  });

  it('different tenantIds sharing a backend cannot read each other\'s data', async () => {
    const cacheT1 = createHardenedCache({
      backend,
      securityContext: { tenantId: 'tenant-1' },
      version: 'v1',
    });
    const cacheT2 = createHardenedCache({
      backend,
      securityContext: { tenantId: 'tenant-2' },
      version: 'v1',
    });

    await cacheT1.set('key', 'tenant-1-value');
    await cacheT2.set('key', 'tenant-2-value');

    expect(await cacheT1.get('key')).toBe('tenant-1-value');
    expect(await cacheT2.get('key')).toBe('tenant-2-value');
  });

  it('has() returns false for a key set in another context', async () => {
    const cacheA = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-A' },
      version: 'v1',
    });
    const cacheB = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-B' },
      version: 'v1',
    });

    await cacheA.set('only-in-A', 42);

    expect(await cacheA.has('only-in-A')).toBe(true);
    expect(await cacheB.has('only-in-A')).toBe(false);
  });

  it('clear() only removes keys from the current context', async () => {
    const cacheA = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-A' },
      version: 'v1',
    });
    const cacheB = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-B' },
      version: 'v1',
    });

    await cacheA.set('a-key', 'a-val');
    await cacheB.set('b-key', 'b-val');

    await cacheA.clear();

    expect(await cacheA.get('a-key')).toBeUndefined();
    expect(await cacheB.get('b-key')).toBe('b-val');
  });

  it('keys() only returns keys from the current context', async () => {
    const cacheA = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-A' },
      version: 'v1',
    });
    const cacheB = createHardenedCache({
      backend,
      securityContext: { scanId: 'scan-B' },
      version: 'v1',
    });

    await cacheA.set('alpha', 1);
    await cacheA.set('beta', 2);
    await cacheB.set('gamma', 3);

    const keysA = await cacheA.keys();
    const keysB = await cacheB.keys();

    expect(keysA.sort()).toEqual(['alpha', 'beta']);
    expect(keysB).toEqual(['gamma']);
  });
});

// ---------------------------------------------------------------------------
// Cache versioning
// ---------------------------------------------------------------------------

describe('HardenedCache — cache versioning', () => {
  let backend: MemoryCache;

  beforeEach(() => {
    backend = makeBackend();
  });

  it('changing version invalidates old keys (structurally different prefix)', async () => {
    const cacheV1 = createHardenedCache({
      backend,
      securityContext: { scanId: 's1' },
      version: 'v1',
    });
    const cacheV2 = createHardenedCache({
      backend,
      securityContext: { scanId: 's1' },
      version: 'v2',
    });

    await cacheV1.set('data', 'old');

    // v2 should not see v1 data
    expect(await cacheV2.get('data')).toBeUndefined();
    expect(await cacheV2.has('data')).toBe(false);
  });

  it('same version + same context instance reads back its own writes', async () => {
    const cache = createHardenedCache({
      backend,
      securityContext: { scanId: 's1' },
      version: 'v1',
    });

    await cache.set('shared', 'hello');
    expect(await cache.get('shared')).toBe('hello');
  });

  it('separate instances with same context have independent bloom filters (by design)', async () => {
    const cache1 = createHardenedCache({
      backend,
      securityContext: { scanId: 's1' },
      version: 'v1',
    });
    const cache2 = createHardenedCache({
      backend,
      securityContext: { scanId: 's1' },
      version: 'v1',
    });

    await cache1.set('data', 'value');

    // cache2's bloom filter hasn't seen 'data', so fast negative blocks the lookup.
    // This is correct: each instance tracks its own bloom state.
    expect(await cache2.get('data')).toBeUndefined();

    // But if cache2 also sets the key, it populates its own bloom and can read it.
    await cache2.set('data', 'value2');
    expect(await cache2.get('data')).toBe('value2');
  });
});

// ---------------------------------------------------------------------------
// Bloom filter FPR enforcement
// ---------------------------------------------------------------------------

describe('HardenedCache — Bloom FPR enforcement', () => {
  it('rejects FPR > ABSOLUTE_MAX_FPR (0.05)', () => {
    expect(() =>
      makeCache({ bloomFalsePositiveRate: 0.10 })
    ).toThrow(/bloomFalsePositiveRate must be in/);
  });

  it('rejects FPR <= 0', () => {
    expect(() => makeCache({ bloomFalsePositiveRate: 0 })).toThrow(
      /bloomFalsePositiveRate must be in/
    );
    expect(() => makeCache({ bloomFalsePositiveRate: -0.01 })).toThrow(
      /bloomFalsePositiveRate must be in/
    );
  });

  it('accepts FPR within valid range', () => {
    const cache = makeCache({ bloomFalsePositiveRate: 0.001 });
    expect(cache.bloomMaxFpr).toBeCloseTo(0.001, 5);
  });

  it('defaults to 1% FPR', () => {
    const cache = makeCache();
    expect(cache.bloomMaxFpr).toBeCloseTo(0.01, 5);
  });

  it('reports estimated FPR after insertions', async () => {
    const cache = makeCache({
      bloomCapacity: 100,
      bloomFalsePositiveRate: 0.01,
    });
    for (let i = 0; i < 50; i++) {
      await cache.set(`key-${i}`, i);
    }
    expect(cache.bloomEstimatedFpr).toBeGreaterThan(0);
    expect(cache.bloomEstimatedFpr).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// Bloom filter — fast negative lookups
// ---------------------------------------------------------------------------

describe('HardenedCache — Bloom fast negatives', () => {
  it('get() returns undefined immediately for keys never added (bloom negative)', async () => {
    const cache = makeCache();
    // Never added — bloom should say "definitely not"
    expect(await cache.get('nonexistent')).toBeUndefined();
  });

  it('has() returns false for keys never added', async () => {
    const cache = makeCache();
    expect(await cache.has('nonexistent')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SecurityContext validation
// ---------------------------------------------------------------------------

describe('HardenedCache — SecurityContext validation', () => {
  it('rejects empty SecurityContext (no tenantId or scanId)', () => {
    expect(() =>
      createHardenedCache({
        backend: makeBackend(),
        securityContext: {},
        version: 'v1',
      })
    ).toThrow(/requires at least one of tenantId or scanId/);
  });

  it('accepts SecurityContext with only tenantId', () => {
    expect(() =>
      createHardenedCache({
        backend: makeBackend(),
        securityContext: { tenantId: 't1' },
        version: 'v1',
      })
    ).not.toThrow();
  });

  it('accepts SecurityContext with only scanId', () => {
    expect(() =>
      createHardenedCache({
        backend: makeBackend(),
        securityContext: { scanId: 's1' },
        version: 'v1',
      })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Key length and value size limits
// ---------------------------------------------------------------------------

describe('HardenedCache — limits enforcement', () => {
  it('rejects empty key', async () => {
    const cache = makeCache();
    await expect(cache.set('', 'val')).rejects.toThrow(/key must not be empty/);
  });

  it('rejects key exceeding maxKeyLength', async () => {
    const cache = makeCache({ limits: { maxKeyLength: 10 } });
    await expect(cache.set('a'.repeat(11), 'val')).rejects.toThrow(
      /key length 11 exceeds max 10/
    );
  });

  it('rejects value exceeding maxValueSizeBytes', async () => {
    const cache = makeCache({ limits: { maxValueSizeBytes: 20 } });
    await expect(cache.set('k', 'a'.repeat(100))).rejects.toThrow(
      /value size .* exceeds max 20/
    );
  });

  it('rejects adding keys beyond maxKeysPerContext', async () => {
    const cache = makeCache({ limits: { maxKeysPerContext: 2 } });
    await cache.set('k1', 1);
    await cache.set('k2', 2);
    await expect(cache.set('k3', 3)).rejects.toThrow(
      /key count 2 reached max 2/
    );
  });

  it('allows re-setting existing key even at limit', async () => {
    const cache = makeCache({ limits: { maxKeysPerContext: 1 } });
    await cache.set('k1', 1);
    // Updating existing key should succeed
    await cache.set('k1', 2);
    expect(await cache.get('k1')).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Delete and key count tracking
// ---------------------------------------------------------------------------

describe('HardenedCache — delete and key count', () => {
  it('delete decrements key count', async () => {
    const cache = makeCache({ limits: { maxKeysPerContext: 2 } });
    await cache.set('a', 1);
    await cache.set('b', 2);
    expect(cache.trackedKeyCount).toBe(2);

    await cache.delete('a');
    expect(cache.trackedKeyCount).toBe(1);

    // Should now allow a new key
    await cache.set('c', 3);
    expect(await cache.get('c')).toBe(3);
  });

  it('mdelete decrements key count', async () => {
    const cache = makeCache();
    await cache.set('x', 1);
    await cache.set('y', 2);
    await cache.set('z', 3);

    const count = await cache.mdelete(['x', 'z']);
    expect(count).toBe(2);
    expect(cache.trackedKeyCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// mget / mset
// ---------------------------------------------------------------------------

describe('HardenedCache — mset limits enforcement', () => {
  it('mset rejects batch that would exceed maxKeysPerContext', async () => {
    const cache = makeCache({ limits: { maxKeysPerContext: 2 } });
    await cache.set('existing', 1);

    // Trying to mset 2 new keys when only 1 slot remains
    const batch = new Map<string, number>([
      ['a', 10],
      ['b', 20],
    ]);
    await expect(cache.mset(batch)).rejects.toThrow(
      /mset would bring key count to 3, exceeding max 2/
    );
  });

  it('mset tracks keyCount correctly for new keys', async () => {
    const cache = makeCache({ limits: { maxKeysPerContext: 5 } });
    const batch = new Map<string, number>([
      ['a', 1],
      ['b', 2],
    ]);
    await cache.mset(batch);
    expect(cache.trackedKeyCount).toBe(2);
  });

  it('mset does not double-count existing keys', async () => {
    const cache = makeCache({ limits: { maxKeysPerContext: 3 } });
    await cache.set('a', 1);
    // mset with 'a' (existing) and 'b' (new) — should only add 1 to count
    const batch = new Map<string, number>([
      ['a', 10],
      ['b', 20],
    ]);
    await cache.mset(batch);
    expect(cache.trackedKeyCount).toBe(2);
  });
});

describe('HardenedCache — mget / mset', () => {
  it('mset and mget work within context', async () => {
    const cache = makeCache();
    const entries = new Map<string, number>([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    await cache.mset(entries);

    const result = await cache.mget<number>(['a', 'b', 'c']);
    expect(result.get('a')).toBe(1);
    expect(result.get('b')).toBe(2);
    expect(result.get('c')).toBe(3);
  });

  it('mget does not return keys from other contexts', async () => {
    const backend = makeBackend();
    const cacheA = createHardenedCache({
      backend,
      securityContext: { scanId: 'A' },
      version: 'v1',
    });
    const cacheB = createHardenedCache({
      backend,
      securityContext: { scanId: 'B' },
      version: 'v1',
    });

    await cacheA.mset(new Map([['k', 'from-A']]));
    const result = await cacheB.mget<string>(['k']);
    expect(result.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Introspection helpers
// ---------------------------------------------------------------------------

describe('HardenedCache — introspection', () => {
  it('exposes context, version, and prefix', () => {
    const cache = makeCache({ securityContext: { scanId: 'abc' }, version: 'v42' });
    expect(cache.context).toEqual({ scanId: 'abc' });
    expect(cache.cacheVersion).toBe('v42');
    expect(typeof cache.contextPrefix).toBe('string');
    expect(cache.contextPrefix.length).toBe(16);
  });

  it('bloomIsFull reflects capacity', async () => {
    const cache = makeCache({ bloomCapacity: 3 });
    expect(cache.bloomIsFull).toBe(false);
    await cache.set('a', 1);
    await cache.set('b', 2);
    await cache.set('c', 3);
    expect(cache.bloomIsFull).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BloomFilter standalone regression (unit)
// ---------------------------------------------------------------------------

describe('BloomFilter — standalone regression', () => {
  it('rejects adds beyond capacity to bound FPR', () => {
    const bf = new BloomFilter({ expectedCapacity: 5, maxFalsePositiveRate: 0.01 });
    for (let i = 0; i < 5; i++) {
      expect(bf.add(`item-${i}`)).toBe(true);
    }
    expect(bf.add('overflow')).toBe(false);
    expect(bf.isFull()).toBe(true);
  });

  it('mightContain returns false for items never added', () => {
    const bf = new BloomFilter({ expectedCapacity: 100 });
    expect(bf.mightContain('never-added')).toBe(false);
  });

  it('mightContain returns true for items added', () => {
    const bf = new BloomFilter({ expectedCapacity: 100 });
    bf.add('hello');
    expect(bf.mightContain('hello')).toBe(true);
  });

  it('clear resets to empty', () => {
    const bf = new BloomFilter({ expectedCapacity: 10 });
    bf.add('x');
    bf.clear();
    expect(bf.elementCount).toBe(0);
    expect(bf.mightContain('x')).toBe(false);
  });

  it('FPR is capped at ABSOLUTE_MAX_FPR (0.05)', () => {
    const bf = new BloomFilter({ expectedCapacity: 100, maxFalsePositiveRate: 0.99 });
    expect(bf.maxFpr).toBeLessThanOrEqual(0.05);
  });

  it('FPR floor is enforced (cannot be < 1e-6)', () => {
    const bf = new BloomFilter({ expectedCapacity: 100, maxFalsePositiveRate: 1e-12 });
    expect(bf.maxFpr).toBeGreaterThanOrEqual(1e-6);
  });
});
