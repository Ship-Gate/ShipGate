/**
 * Cache Standard Library Types
 */

// ============================================
// Core Types
// ============================================

export interface CacheOptions {
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Maximum number of items (for memory cache) */
  maxSize?: number;
  /** Key prefix */
  prefix?: string;
  /** Serializer for values */
  serializer?: Serializer;
  /** Enable statistics collection */
  stats?: boolean;
  /** Stale-while-revalidate time in ms */
  staleWhileRevalidate?: number;
}

export interface CacheEntry<T = unknown> {
  /** The cache key (optional, for verification) */
  key?: string;
  value: T;
  createdAt: number;
  expiresAt?: number;
  lastAccessedAt: number;
  accessCount: number;
  size?: number;
  tags?: string[];
  /** TTL in seconds (alternative to expiresAt) */
  ttl?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  maxSize?: number;
  hitRate: number;
  evictions: number;
  /** Memory usage in bytes */
  memory?: number;
  /** Memory usage in bytes (alias) */
  memoryUsage?: number;
}

export interface SetOptions {
  /** TTL in milliseconds */
  ttl?: number;
  /** Tags for grouping */
  tags?: string[];
  /** Only set if key doesn't exist */
  nx?: boolean;
  /** Only set if key exists */
  xx?: boolean;
  /** Return old value */
  get?: boolean;
}

export interface GetOptions {
  /** Update TTL on access */
  touch?: boolean;
  /** Return stale value while revalidating */
  stale?: boolean;
}

// ============================================
// Simple Cache Interface (ICache)
// ============================================

/**
 * Simple cache interface for basic operations
 */
export interface ICache {
  /** Get a value */
  get<T>(key: string): Promise<T | null>;
  /** Set a value */
  set<T>(key: string, value: T, options?: SetOptions): Promise<void>;
  /** Delete a value */
  delete(key: string): Promise<boolean>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Clear all values */
  clear(): Promise<void>;
  /** Get all keys matching pattern */
  keys(pattern?: string): Promise<string[]>;
  /** Get cache statistics */
  getStats(): Promise<CacheStats>;
  /** Close connection */
  close(): Promise<void>;
}

// ============================================
// Result-based Cache Interface
// ============================================

/**
 * Cache error type
 */
export interface CacheError {
  code: string;
  message: string;
}

/**
 * Cache result type for operations that may fail
 */
export type CacheResult<T> = 
  | { ok: true; data: CacheEntry<T> }
  | { ok: false; error: CacheError };

/**
 * Result-based cache interface with explicit success/failure
 */
export interface Cache<T = unknown> {
  /** Get a value with result */
  get(key: string): Promise<CacheResult<T>>;
  /** Set a value */
  set(key: string, value: T, options?: SetOptions): Promise<void>;
  /** Delete a value */
  delete(key: string): Promise<boolean>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Clear all values */
  clear(): Promise<void>;
  /** Get or set with factory function */
  getOrSet(key: string, factory: () => Promise<T>, options?: SetOptions): Promise<T>;
  /** Get multiple values */
  mget(keys: readonly string[]): Promise<Map<string, T>>;
  /** Set multiple values */
  mset(entries: Map<string, T>, options?: SetOptions): Promise<void>;
  /** Get cache statistics */
  stats(): Promise<CacheStats>;
  /** Close connection */
  close(): Promise<void>;
}

// ============================================
// Redis Configuration
// ============================================

/**
 * Redis connection configuration
 */
export interface RedisConfig {
  /** Redis host */
  host?: string;
  /** Redis port */
  port?: number;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** Enable cluster mode */
  cluster?: boolean;
  /** Enable TLS */
  tls?: boolean;
  /** Maximum retries */
  maxRetries?: number;
  /** Connection timeout in ms */
  connectTimeout?: number;
}

// ============================================
// Cache Backend Interface
// ============================================

export interface CacheBackend {
  /** Backend name */
  name: string;
  
  /** Get a value */
  get<T = unknown>(key: string, options?: GetOptions): Promise<T | undefined>;
  
  /** Set a value */
  set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<boolean>;
  
  /** Delete a value */
  delete(key: string): Promise<boolean>;
  
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  
  /** Get multiple values */
  mget<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  
  /** Set multiple values */
  mset<T = unknown>(entries: Map<string, T>, options?: SetOptions): Promise<boolean>;
  
  /** Delete multiple values */
  mdelete(keys: string[]): Promise<number>;
  
  /** Clear all values */
  clear(): Promise<void>;
  
  /** Get all keys matching pattern */
  keys(pattern?: string): Promise<string[]>;
  
  /** Get cache statistics */
  stats(): Promise<CacheStats>;
  
  /** Close connection */
  close(): Promise<void>;
  
  /** Delete by tag */
  deleteByTag?(tag: string): Promise<number>;
  
  /** Get remaining TTL */
  ttl?(key: string): Promise<number>;
  
  /** Update TTL */
  expire?(key: string, ttl: number): Promise<boolean>;
}

// ============================================
// Serialization
// ============================================

export interface Serializer {
  serialize(value: unknown): string | Buffer;
  deserialize<T>(data: string | Buffer): T;
}

export class JsonSerializer implements Serializer {
  serialize(value: unknown): string {
    return JSON.stringify(value);
  }
  
  deserialize<T>(data: string | Buffer): T {
    const str = typeof data === 'string' ? data : data.toString();
    return JSON.parse(str);
  }
}

export class MsgPackSerializer implements Serializer {
  serialize(value: unknown): Buffer {
    // Would use msgpack library in real implementation
    return Buffer.from(JSON.stringify(value));
  }
  
  deserialize<T>(data: string | Buffer): T {
    const str = typeof data === 'string' ? data : data.toString();
    return JSON.parse(str);
  }
}

// ============================================
// Cache Patterns
// ============================================

export interface CacheAside<T> {
  /** Get from cache or fetch */
  get(key: string, fetcher: () => Promise<T>, options?: SetOptions): Promise<T>;
  /** Invalidate cache */
  invalidate(key: string): Promise<void>;
  /** Refresh cache */
  refresh(key: string, fetcher: () => Promise<T>, options?: SetOptions): Promise<T>;
}

export interface WriteThrough<T> {
  /** Write to cache and backend */
  write(key: string, value: T, writer: (value: T) => Promise<void>): Promise<void>;
  /** Read from cache or backend */
  read(key: string, reader: () => Promise<T | undefined>): Promise<T | undefined>;
}

export interface WriteBehind<T> {
  /** Queue write for later */
  write(key: string, value: T): Promise<void>;
  /** Flush pending writes */
  flush(): Promise<void>;
}

// ============================================
// Event Types
// ============================================

export type CacheEvent = 
  | { type: 'set'; key: string; ttl?: number }
  | { type: 'get'; key: string; hit: boolean }
  | { type: 'delete'; key: string }
  | { type: 'expire'; key: string }
  | { type: 'evict'; key: string; reason: EvictionReason }
  | { type: 'clear' };

export type EvictionReason = 'expired' | 'lru' | 'size' | 'manual';

export type CacheEventHandler = (event: CacheEvent) => void;

// ============================================
// Configuration Types
// ============================================

export interface MemoryCacheConfig extends CacheOptions {
  /** Eviction policy */
  evictionPolicy?: 'lru' | 'lfu' | 'fifo' | 'random';
  /** Check interval for expired items (ms) */
  cleanupInterval?: number;
  /** Maximum memory usage in bytes */
  maxMemory?: number;
}

export interface RedisCacheConfig extends CacheOptions {
  /** Redis URL */
  url?: string;
  /** Redis host */
  host?: string;
  /** Redis port */
  port?: number;
  /** Redis password */
  password?: string;
  /** Redis database number */
  db?: number;
  /** TLS options */
  tls?: boolean | object;
  /** Connection timeout */
  connectTimeout?: number;
  /** Command timeout */
  commandTimeout?: number;
  /** Cluster mode */
  cluster?: boolean;
  /** Cluster nodes */
  clusterNodes?: Array<{ host: string; port: number }>;
  /** Enable keyspace notifications */
  keyspaceNotifications?: boolean;
}

// ============================================
// Decorator Types
// ============================================

export interface CacheableOptions extends SetOptions {
  /** Key generator function */
  keyGenerator?: (...args: unknown[]) => string;
  /** Condition for caching */
  condition?: (...args: unknown[]) => boolean;
  /** Skip cache read */
  unless?: (result: unknown) => boolean;
}

export interface CacheEvictOptions {
  /** Keys to evict */
  keys?: string[];
  /** Tags to evict */
  tags?: string[];
  /** Evict all */
  allEntries?: boolean;
  /** Evict before or after method */
  beforeInvocation?: boolean;
}
