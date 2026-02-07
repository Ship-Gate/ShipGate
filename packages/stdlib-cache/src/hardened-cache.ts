/**
 * Hardened Cache - Security-scoped cache with Bloom filter, versioning, and limits.
 *
 * Guarantees:
 * - Cross-scan contamination is structurally impossible (keys prefixed by security context hash)
 * - Cache version changes invalidate all prior entries
 * - Configurable Bloom FPR is enforced (capped at ABSOLUTE_MAX_FPR)
 * - Key length and value size limits are enforced
 * - Per-context Bloom filter provides fast negative lookups
 * - clear() only removes keys belonging to the current security context
 */

import { createHash } from 'node:crypto';
import type {
  CacheBackend,
  SetOptions,
  GetOptions,
  CacheStats,
  SecurityContext,
  CacheVersion,
  CacheLimits,
} from './types.js';
import { BloomFilter, type BloomFilterOptions } from './bloom.js';

/** Absolute maximum FPR we allow for the Bloom filter */
const ABSOLUTE_MAX_FPR = 0.05;

/** Default FPR for the Bloom filter (1%) */
const DEFAULT_BLOOM_FPR = 0.01;

/** Default expected capacity for the Bloom filter */
const DEFAULT_BLOOM_CAPACITY = 10_000;

/** Default max key length */
const DEFAULT_MAX_KEY_LENGTH = 2048;

/** Separator used in composite keys — chosen to be unlikely in user keys */
const SEP = '\x00';

export interface HardenedCacheOptions {
  /** The underlying cache backend (memory, redis, etc.) */
  backend: CacheBackend;
  /** Security context — at least one of tenantId or scanId is required */
  securityContext: SecurityContext;
  /** Cache version string — changing this invalidates all prior entries */
  version: CacheVersion;
  /** Limits for key length, value size, and max keys per context */
  limits?: CacheLimits;
  /** Bloom filter false-positive rate (default 0.01, capped at 0.05) */
  bloomFalsePositiveRate?: number;
  /** Bloom filter expected capacity (default 10000) */
  bloomCapacity?: number;
}

/**
 * Compute a deterministic, collision-resistant prefix from the security context + version.
 * Uses SHA-256 truncated to 16 hex chars for brevity while retaining uniqueness.
 */
function computeContextPrefix(ctx: SecurityContext, version: CacheVersion): string {
  const parts = [
    version,
    ctx.tenantId ?? '',
    ctx.scanId ?? '',
    ctx.userId ?? '',
    ctx.namespace ?? '',
  ];
  const digest = createHash('sha256').update(parts.join(SEP)).digest('hex');
  return digest.slice(0, 16);
}

/**
 * Validate a SecurityContext — at least one of tenantId or scanId must be set.
 */
function validateSecurityContext(ctx: SecurityContext): void {
  if (!ctx.tenantId && !ctx.scanId) {
    throw new Error(
      'HardenedCache: SecurityContext requires at least one of tenantId or scanId to prevent cross-scan contamination'
    );
  }
}

/**
 * Validate and clamp the Bloom FPR to allowed bounds.
 */
function resolveBloomFpr(fpr: number | undefined): number {
  const requested = fpr ?? DEFAULT_BLOOM_FPR;
  if (requested <= 0 || requested > ABSOLUTE_MAX_FPR) {
    throw new Error(
      `HardenedCache: bloomFalsePositiveRate must be in (0, ${ABSOLUTE_MAX_FPR}], got ${requested}`
    );
  }
  return requested;
}

/**
 * HardenedCache wraps any CacheBackend with:
 * - Security-context-scoped key prefixing
 * - Cache versioning
 * - Per-context Bloom filter for fast negative lookups
 * - Key length and value size enforcement
 */
export class HardenedCache {
  private readonly backend: CacheBackend;
  private readonly prefix: string;
  private readonly bloom: BloomFilter;
  private readonly limits: Required<CacheLimits>;
  private readonly securityContext: SecurityContext;
  private readonly version: CacheVersion;
  private keyCount = 0;

  constructor(options: HardenedCacheOptions) {
    validateSecurityContext(options.securityContext);
    const fpr = resolveBloomFpr(options.bloomFalsePositiveRate);

    this.backend = options.backend;
    this.securityContext = options.securityContext;
    this.version = options.version;
    this.prefix = computeContextPrefix(options.securityContext, options.version);

    this.limits = {
      maxKeyLength: options.limits?.maxKeyLength ?? DEFAULT_MAX_KEY_LENGTH,
      maxValueSizeBytes: options.limits?.maxValueSizeBytes ?? 0,
      maxKeysPerContext: options.limits?.maxKeysPerContext ?? 0,
    };

    this.bloom = new BloomFilter({
      maxFalsePositiveRate: fpr,
      expectedCapacity: options.bloomCapacity ?? DEFAULT_BLOOM_CAPACITY,
      seed: `bloom-${this.prefix}`,
    });
  }

  // ---- Key management ----

  /**
   * Build the full backend key from a user-facing key.
   * Format: `hc:{contextHash}:{userKey}`
   */
  private scopedKey(key: string): string {
    return `hc:${this.prefix}:${key}`;
  }

  /**
   * Strip the scoped prefix to recover the user-facing key.
   */
  private unscopedKey(fullKey: string): string {
    const expectedPrefix = `hc:${this.prefix}:`;
    if (fullKey.startsWith(expectedPrefix)) {
      return fullKey.slice(expectedPrefix.length);
    }
    return fullKey;
  }

  /**
   * Validate a user-facing key against configured limits.
   */
  private validateKey(key: string): void {
    if (!key || key.length === 0) {
      throw new Error('HardenedCache: key must not be empty');
    }
    if (key.length > this.limits.maxKeyLength) {
      throw new Error(
        `HardenedCache: key length ${key.length} exceeds max ${this.limits.maxKeyLength}`
      );
    }
  }

  /**
   * Validate value size against configured limits (approximate JSON size).
   */
  private validateValueSize(value: unknown): void {
    if (this.limits.maxValueSizeBytes <= 0) return;
    const approxSize = JSON.stringify(value).length * 2; // UTF-16 rough estimate
    if (approxSize > this.limits.maxValueSizeBytes) {
      throw new Error(
        `HardenedCache: value size ~${approxSize} bytes exceeds max ${this.limits.maxValueSizeBytes}`
      );
    }
  }

  /**
   * Validate that adding another key won't exceed per-context limits.
   */
  private validateKeyCount(): void {
    if (this.limits.maxKeysPerContext > 0 && this.keyCount >= this.limits.maxKeysPerContext) {
      throw new Error(
        `HardenedCache: key count ${this.keyCount} reached max ${this.limits.maxKeysPerContext} for this context`
      );
    }
  }

  // ---- Public API ----

  /**
   * Get a value. Bloom filter provides fast negative lookup.
   */
  async get<T = unknown>(key: string, options?: GetOptions): Promise<T | undefined> {
    this.validateKey(key);

    // Fast negative: if the Bloom filter says "definitely not", skip backend
    if (!this.bloom.mightContain(key)) {
      return undefined;
    }

    return this.backend.get<T>(this.scopedKey(key), options);
  }

  /**
   * Set a value. Enforces key length, value size, and per-context key count limits.
   */
  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<boolean> {
    this.validateKey(key);
    this.validateValueSize(value);

    const scopedK = this.scopedKey(key);
    const existed = await this.backend.has(scopedK);

    if (!existed) {
      this.validateKeyCount();
    }

    const result = await this.backend.set(scopedK, value, options);

    if (result) {
      this.bloom.add(key);
      if (!existed) {
        this.keyCount++;
      }
    }

    return result;
  }

  /**
   * Delete a value from this context.
   */
  async delete(key: string): Promise<boolean> {
    this.validateKey(key);
    const deleted = await this.backend.delete(this.scopedKey(key));
    if (deleted) {
      this.keyCount = Math.max(0, this.keyCount - 1);
    }
    return deleted;
  }

  /**
   * Check if key exists in this context. Bloom filter provides fast negative.
   */
  async has(key: string): Promise<boolean> {
    this.validateKey(key);
    if (!this.bloom.mightContain(key)) {
      return false;
    }
    return this.backend.has(this.scopedKey(key));
  }

  /**
   * Get multiple values (only from this context).
   */
  async mget<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    for (const k of keys) this.validateKey(k);
    const scopedKeys = keys.map((k) => this.scopedKey(k));
    const raw = await this.backend.mget<T>(scopedKeys);

    const result = new Map<string, T>();
    for (const [fullKey, value] of raw) {
      result.set(this.unscopedKey(fullKey), value);
    }
    return result;
  }

  /**
   * Set multiple values (in this context).
   */
  async mset<T = unknown>(entries: Map<string, T>, options?: SetOptions): Promise<boolean> {
    const scoped = new Map<string, T>();
    for (const [key, value] of entries) {
      this.validateKey(key);
      this.validateValueSize(value);
      scoped.set(this.scopedKey(key), value);
      this.bloom.add(key);
    }
    return this.backend.mset(scoped, options);
  }

  /**
   * Delete multiple values (in this context).
   */
  async mdelete(keys: string[]): Promise<number> {
    for (const k of keys) this.validateKey(k);
    const scopedKeys = keys.map((k) => this.scopedKey(k));
    const count = await this.backend.mdelete(scopedKeys);
    this.keyCount = Math.max(0, this.keyCount - count);
    return count;
  }

  /**
   * Clear only keys belonging to this security context.
   * Does NOT wipe the entire backend — prevents cross-context data loss.
   */
  async clear(): Promise<void> {
    const allKeys = await this.backend.keys();
    const contextPrefix = `hc:${this.prefix}:`;
    const toDelete = allKeys.filter((k) => k.startsWith(contextPrefix));
    if (toDelete.length > 0) {
      await this.backend.mdelete(toDelete);
    }
    this.bloom.clear();
    this.keyCount = 0;
  }

  /**
   * Get keys belonging to this context (optionally matching a pattern).
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = await this.backend.keys();
    const contextPrefix = `hc:${this.prefix}:`;
    let contextKeys = allKeys
      .filter((k) => k.startsWith(contextPrefix))
      .map((k) => k.slice(contextPrefix.length));

    if (pattern) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      contextKeys = contextKeys.filter((k) => regex.test(k));
    }
    return contextKeys;
  }

  /**
   * Get cache statistics from the backend.
   */
  async stats(): Promise<CacheStats> {
    return this.backend.stats();
  }

  /**
   * Close the backend connection.
   */
  async close(): Promise<void> {
    return this.backend.close();
  }

  // ---- Introspection ----

  /** Current Bloom filter estimated FPR */
  get bloomEstimatedFpr(): number {
    return this.bloom.estimatedFpr;
  }

  /** Configured max Bloom FPR */
  get bloomMaxFpr(): number {
    return this.bloom.maxFpr;
  }

  /** Whether the Bloom filter has reached capacity */
  get bloomIsFull(): boolean {
    return this.bloom.isFull();
  }

  /** Number of keys tracked in this context */
  get trackedKeyCount(): number {
    return this.keyCount;
  }

  /** The security context this cache is bound to */
  get context(): Readonly<SecurityContext> {
    return this.securityContext;
  }

  /** The cache version */
  get cacheVersion(): CacheVersion {
    return this.version;
  }

  /** The computed context prefix (for diagnostics) */
  get contextPrefix(): string {
    return this.prefix;
  }
}

/**
 * Factory: create a HardenedCache with explicit security context and version.
 */
export function createHardenedCache(options: HardenedCacheOptions): HardenedCache {
  return new HardenedCache(options);
}
