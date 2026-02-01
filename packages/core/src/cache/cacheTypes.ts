/**
 * Cache types for fingerprint-based caching in ISL
 */

/**
 * A fingerprint uniquely identifies a spec or content
 */
export type Fingerprint = string;

/**
 * Cache entry metadata
 */
export interface CacheEntryMeta {
  /** Unix timestamp when entry was created */
  createdAt: number;
  /** Unix timestamp when entry expires (undefined = never) */
  expiresAt?: number;
  /** The fingerprint key */
  fingerprint: Fingerprint;
}

/**
 * A cached entry with data and metadata
 */
export interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** Entry metadata */
  meta: CacheEntryMeta;
}

/**
 * Options for setting cache entries
 */
export interface CacheSetOptions {
  /** Time-to-live in milliseconds (undefined = never expires) */
  ttl?: number;
}

/**
 * Result of a cache get operation
 */
export interface CacheGetResult<T = unknown> {
  /** Whether the entry was found and not expired */
  hit: boolean;
  /** The cached data (undefined if miss) */
  data?: T;
  /** Entry metadata (undefined if miss) */
  meta?: CacheEntryMeta;
}

/**
 * Options for initializing a file cache
 */
export interface FileCacheOptions {
  /** Directory to store cache files */
  cacheDir: string;
  /** Default TTL for entries in milliseconds */
  defaultTtl?: number;
}

/**
 * Statistics about the cache
 */
export interface CacheStats {
  /** Number of entries in cache */
  entryCount: number;
  /** Total size in bytes */
  totalSizeBytes: number;
  /** Number of expired entries */
  expiredCount: number;
}

/**
 * Interface for a cache implementation
 */
export interface Cache<T = unknown> {
  /** Get an entry by fingerprint */
  get(fingerprint: Fingerprint): Promise<CacheGetResult<T>>;
  /** Set an entry by fingerprint */
  set(fingerprint: Fingerprint, data: T, options?: CacheSetOptions): Promise<void>;
  /** Delete an entry by fingerprint */
  delete(fingerprint: Fingerprint): Promise<boolean>;
  /** Check if an entry exists and is valid */
  has(fingerprint: Fingerprint): Promise<boolean>;
  /** Clear all entries */
  clear(): Promise<void>;
  /** Get cache statistics */
  stats(): Promise<CacheStats>;
}
