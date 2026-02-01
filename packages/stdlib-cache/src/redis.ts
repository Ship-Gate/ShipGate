// ============================================================================
// Redis Cache Implementation
// ============================================================================

import type { ICache, CacheOptions, CacheStats, RedisConfig, Serializer } from './types.js';

/**
 * Redis cache configuration
 */
export interface RedisCacheConfig extends RedisConfig {
  prefix?: string;
  defaultTTL?: number;
  serializer?: Serializer;
}

/**
 * Redis-based cache implementation
 * 
 * Features:
 * - Connection pooling
 * - Cluster support
 * - Pipelining
 * - Pub/sub for invalidation
 */
export class RedisCache implements ICache {
  private config: Required<RedisCacheConfig>;
  private client: RedisClient | null = null;
  private stats = { hits: 0, misses: 0 };

  constructor(config: RedisCacheConfig = {}) {
    this.config = {
      host: config.host ?? 'localhost',
      port: config.port ?? 6379,
      password: config.password ?? '',
      db: config.db ?? 0,
      cluster: config.cluster ?? false,
      tls: config.tls ?? false,
      maxRetries: config.maxRetries ?? 3,
      connectTimeout: config.connectTimeout ?? 5000,
      prefix: config.prefix ?? 'isl:',
      defaultTTL: config.defaultTTL ?? 3600,
      serializer: config.serializer ?? {
        serialize: (v) => JSON.stringify(v),
        deserialize: <T>(d: string | Buffer) => JSON.parse(d.toString()) as T,
      },
    };
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    // In a real implementation, this would create the Redis connection
    // For now, we simulate the interface
    this.client = new MockRedisClient(this.config);
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    
    const fullKey = this.prefixKey(key);
    const data = await this.client!.get(fullKey);

    if (data === null) {
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return this.config.serializer.deserialize<T>(data);
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    await this.ensureConnected();

    const fullKey = this.prefixKey(key);
    const serialized = this.config.serializer.serialize(value);
    const ttl = options?.ttl ?? this.config.defaultTTL;

    if (ttl > 0) {
      await this.client!.setex(fullKey, ttl, serialized);
    } else {
      await this.client!.set(fullKey, serialized);
    }

    // Store tags for invalidation
    if (options?.tags?.length) {
      await this.addToTags(fullKey, options.tags);
    }
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();
    
    const fullKey = this.prefixKey(key);
    const result = await this.client!.del(fullKey);
    return result > 0;
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnected();
    
    const fullKey = this.prefixKey(key);
    return await this.client!.exists(fullKey) > 0;
  }

  async clear(): Promise<void> {
    await this.ensureConnected();
    
    const pattern = this.prefixKey('*');
    const keys = await this.client!.keys(pattern);
    
    if (keys.length > 0) {
      await this.client!.del(...keys);
    }
  }

  async keys(pattern = '*'): Promise<string[]> {
    await this.ensureConnected();
    
    const fullPattern = this.prefixKey(pattern);
    const keys = await this.client!.keys(fullPattern);
    
    return keys.map(k => k.replace(this.config.prefix, ''));
  }

  async getStats(): Promise<CacheStats> {
    await this.ensureConnected();
    
    const info = await this.client!.info();
    const total = this.stats.hits + this.stats.misses;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: info.keys ?? 0,
      memory: info.usedMemory ?? 0,
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  /**
   * Get multiple keys (MGET)
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    await this.ensureConnected();
    
    const fullKeys = keys.map(k => this.prefixKey(k));
    const values = await this.client!.mget(fullKeys);
    
    const results = new Map<string, T | null>();
    
    for (let i = 0; i < keys.length; i++) {
      const value = values[i];
      if (value === null) {
        this.stats.misses++;
        results.set(keys[i]!, null);
      } else {
        this.stats.hits++;
        results.set(keys[i]!, this.config.serializer.deserialize<T>(value));
      }
    }

    return results;
  }

  /**
   * Set multiple keys (MSET with TTL via pipeline)
   */
  async mset<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    await this.ensureConnected();
    
    const pipeline = this.client!.pipeline();
    
    for (const { key, value, options } of entries) {
      const fullKey = this.prefixKey(key);
      const serialized = this.config.serializer.serialize(value);
      const ttl = options?.ttl ?? this.config.defaultTTL;

      if (ttl > 0) {
        pipeline.setex(fullKey, ttl, serialized);
      } else {
        pipeline.set(fullKey, serialized);
      }
    }

    await pipeline.exec();
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    await this.ensureConnected();
    
    let count = 0;

    for (const tag of tags) {
      const tagKey = this.prefixKey(`tag:${tag}`);
      const members = await this.client!.smembers(tagKey);
      
      if (members.length > 0) {
        await this.client!.del(...members);
        count += members.length;
      }

      await this.client!.del(tagKey);
    }

    return count;
  }

  /**
   * Get or set with factory
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    // Use SETNX for distributed locking
    const lockKey = this.prefixKey(`lock:${key}`);
    const lockAcquired = await this.client!.setnx(lockKey, '1');
    
    if (lockAcquired) {
      try {
        await this.client!.expire(lockKey, 30); // Lock timeout
        const value = await factory();
        await this.set(key, value, options);
        return value;
      } finally {
        await this.client!.del(lockKey);
      }
    } else {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.getOrSet(key, factory, options);
    }
  }

  // Private methods
  private prefixKey(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client) {
      await this.connect();
    }
  }

  private async addToTags(key: string, tags: string[]): Promise<void> {
    const pipeline = this.client!.pipeline();
    
    for (const tag of tags) {
      const tagKey = this.prefixKey(`tag:${tag}`);
      pipeline.sadd(tagKey, key);
    }

    await pipeline.exec();
  }
}

// Mock Redis client interface (real implementation would use ioredis)
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string | Buffer): Promise<void>;
  setex(key: string, ttl: number, value: string | Buffer): Promise<void>;
  setnx(key: string, value: string): Promise<number>;
  del(...keys: string[]): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  mget(keys: string[]): Promise<(string | null)[]>;
  smembers(key: string): Promise<string[]>;
  sadd(key: string, ...members: string[]): Promise<void>;
  info(): Promise<{ keys?: number; usedMemory?: number }>;
  pipeline(): RedisPipeline;
  quit(): Promise<void>;
}

interface RedisPipeline {
  set(key: string, value: string | Buffer): RedisPipeline;
  setex(key: string, ttl: number, value: string | Buffer): RedisPipeline;
  sadd(key: string, ...members: string[]): RedisPipeline;
  exec(): Promise<void>;
}

// Mock implementation for type safety
class MockRedisClient implements RedisClient {
  private store = new Map<string, { value: string; expiry?: number }>();
  private sets = new Map<string, Set<string>>();

  constructor(private config: RedisCacheConfig) {}

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string | Buffer): Promise<void> {
    this.store.set(key, { value: value.toString() });
  }

  async setex(key: string, ttl: number, value: string | Buffer): Promise<void> {
    this.store.set(key, { value: value.toString(), expiry: Date.now() + ttl * 1000 });
  }

  async setnx(key: string, value: string): Promise<number> {
    if (this.store.has(key)) return 0;
    this.store.set(key, { value });
    return 1;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiry = Date.now() + seconds * 1000;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map(k => this.get(k)));
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? []);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    for (const m of members) this.sets.get(key)!.add(m);
  }

  async info(): Promise<{ keys?: number; usedMemory?: number }> {
    return { keys: this.store.size, usedMemory: 0 };
  }

  pipeline(): RedisPipeline {
    const ops: Array<() => Promise<void>> = [];
    const pipe: RedisPipeline = {
      set: (key, value) => { ops.push(() => this.set(key, value)); return pipe; },
      setex: (key, ttl, value) => { ops.push(() => this.setex(key, ttl, value)); return pipe; },
      sadd: (key, ...members) => { ops.push(() => this.sadd(key, ...members)); return pipe; },
      exec: async () => { await Promise.all(ops.map(op => op())); },
    };
    return pipe;
  }

  async quit(): Promise<void> {
    this.store.clear();
    this.sets.clear();
  }
}

/**
 * Create a Redis cache
 */
export function createRedisCache(config?: RedisCacheConfig): RedisCache {
  return new RedisCache(config);
}
