/**
 * @isl-lang/stdlib-cache
 * 
 * ISL Standard Library for caching with multiple backend support.
 * 
 * @example
 * ```typescript
 * import { createCache } from '@isl-lang/stdlib-cache';
 * 
 * // Create memory cache
 * const cache = createCache({
 *   backend: 'memory',
 *   defaultTtl: 60000, // 1 minute
 *   maxSize: 1000,
 * });
 * 
 * // Set value
 * await cache.set('user:123', { name: 'John' }, { ttl: 300000 });
 * 
 * // Get value
 * const user = await cache.get('user:123');
 * 
 * // Cache-aside pattern
 * const data = await cache.getOrSet('key', async () => {
 *   return fetchFromDatabase();
 * });
 * ```
 */

// Export types
export type {
  CacheOptions,
  CacheEntry,
  CacheStats,
  SetOptions,
  GetOptions,
  CacheBackend,
  Serializer,
  CacheAside,
  WriteThrough,
  WriteBehind,
  CacheEvent,
  EvictionReason,
  CacheEventHandler,
  MemoryCacheConfig,
  RedisCacheConfig,
  CacheableOptions,
  CacheEvictOptions,
} from './types.js';

export { JsonSerializer, MsgPackSerializer } from './types.js';

// Export backends
export {
  MemoryCache,
  createMemoryCache,
  RedisCache,
  createRedisCache,
} from './backends/index.js';

import type {
  CacheBackend,
  CacheOptions,
  SetOptions,
  GetOptions,
  CacheStats,
  MemoryCacheConfig,
  RedisCacheConfig,
} from './types.js';

import { createMemoryCache } from './backends/memory.js';
import { createRedisCache } from './backends/redis.js';

export interface CacheConfig extends CacheOptions {
  backend: 'memory' | 'redis';
  memory?: MemoryCacheConfig;
  redis?: RedisCacheConfig;
}

/**
 * Cache client with convenience methods
 */
export class Cache {
  private backend: CacheBackend;
  
  constructor(backend: CacheBackend) {
    this.backend = backend;
  }
  
  /**
   * Get a value from cache
   */
  async get<T = unknown>(key: string, options?: GetOptions): Promise<T | undefined> {
    return this.backend.get<T>(key, options);
  }
  
  /**
   * Set a value in cache
   */
  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<boolean> {
    return this.backend.set(key, value, options);
  }
  
  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    return this.backend.delete(key);
  }
  
  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    return this.backend.has(key);
  }
  
  /**
   * Get or set value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: SetOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const value = await fetcher();
    await this.set(key, value, options);
    return value;
  }
  
  /**
   * Get multiple values
   */
  async mget<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    return this.backend.mget<T>(keys);
  }
  
  /**
   * Set multiple values
   */
  async mset<T = unknown>(entries: Map<string, T>, options?: SetOptions): Promise<boolean> {
    return this.backend.mset(entries, options);
  }
  
  /**
   * Delete multiple values
   */
  async mdelete(keys: string[]): Promise<number> {
    return this.backend.mdelete(keys);
  }
  
  /**
   * Clear all values
   */
  async clear(): Promise<void> {
    return this.backend.clear();
  }
  
  /**
   * Get all keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    return this.backend.keys(pattern);
  }
  
  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    return this.backend.stats();
  }
  
  /**
   * Close connection
   */
  async close(): Promise<void> {
    return this.backend.close();
  }
  
  /**
   * Delete by tag
   */
  async deleteByTag(tag: string): Promise<number> {
    if (this.backend.deleteByTag) {
      return this.backend.deleteByTag(tag);
    }
    return 0;
  }
  
  /**
   * Get remaining TTL
   */
  async ttl(key: string): Promise<number> {
    if (this.backend.ttl) {
      return this.backend.ttl(key);
    }
    return -1;
  }
  
  /**
   * Update TTL
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (this.backend.expire) {
      return this.backend.expire(key, ttl);
    }
    return false;
  }
  
  /**
   * Wrap a function with caching
   */
  wrap<T, A extends unknown[]>(
    fn: (...args: A) => Promise<T>,
    options?: {
      keyGenerator?: (...args: A) => string;
      ttl?: number;
      condition?: (...args: A) => boolean;
    }
  ): (...args: A) => Promise<T> {
    const keyGen = options?.keyGenerator || ((...args: A) => 
      `fn:${fn.name}:${JSON.stringify(args)}`
    );
    
    return async (...args: A): Promise<T> => {
      // Check condition
      if (options?.condition && !options.condition(...args)) {
        return fn(...args);
      }
      
      const key = keyGen(...args);
      return this.getOrSet(key, () => fn(...args), { ttl: options?.ttl });
    };
  }
}

/**
 * Create cache instance
 */
export function createCache(config: CacheConfig): Cache {
  let backend: CacheBackend;
  
  switch (config.backend) {
    case 'redis':
      if (!config.redis) {
        throw new Error('Redis configuration required');
      }
      backend = createRedisCache({
        ...config,
        ...config.redis,
      });
      break;
    
    case 'memory':
    default:
      backend = createMemoryCache({
        ...config,
        ...config.memory,
      });
      break;
  }
  
  return new Cache(backend);
}

/**
 * Create a memoized function with caching
 */
export function memoize<T, A extends unknown[]>(
  fn: (...args: A) => Promise<T>,
  options?: {
    cache?: Cache;
    keyGenerator?: (...args: A) => string;
    ttl?: number;
    maxSize?: number;
  }
): (...args: A) => Promise<T> {
  const cache = options?.cache || createCache({
    backend: 'memory',
    maxSize: options?.maxSize || 100,
  });
  
  return cache.wrap(fn, {
    keyGenerator: options?.keyGenerator,
    ttl: options?.ttl,
  });
}
