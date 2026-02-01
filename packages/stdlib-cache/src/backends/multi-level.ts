/**
 * Multi-Level Cache - Tiered caching with automatic population.
 */

import type {
  Cache,
  CacheEntry,
  CacheResult,
  CacheStats,
  SetOptions,
} from '../types';
import { InMemoryCache, type InMemoryCacheConfig } from './memory';
import { RedisCache, type RedisCacheConfig } from './redis';

/**
 * Cache level configuration
 */
export type CacheLevel =
  | { readonly type: 'memory' } & InMemoryCacheConfig
  | { readonly type: 'redis' } & RedisCacheConfig;

/**
 * Multi-level cache configuration
 */
export interface MultiLevelCacheConfig {
  /** Cache levels (L1 -> L2 -> ... -> LN) */
  readonly levels: readonly CacheLevel[];
  /** Populate lower levels on cache hit */
  readonly populateOnHit?: boolean;
}

/**
 * Multi-level cache with automatic tier population
 */
export class MultiLevelCache<T = unknown> implements Cache<T> {
  private readonly caches: Cache<T>[];
  private readonly config: MultiLevelCacheConfig;

  constructor(config: MultiLevelCacheConfig) {
    this.config = {
      populateOnHit: true,
      ...config,
    };

    this.caches = config.levels.map((level) => {
      if (level.type === 'memory') {
        return new InMemoryCache<T>(level);
      } else {
        return new RedisCache<T>(level);
      }
    });
  }

  async get(key: string): Promise<CacheResult<T>> {
    // Try each level from L1 to LN
    for (let i = 0; i < this.caches.length; i++) {
      const result = await this.caches[i].get(key);
      
      if (result.ok) {
        // Populate lower levels
        if (this.config.populateOnHit && i > 0) {
          await this.populateLowerLevels(key, result.data.value, i);
        }
        return result;
      }
    }

    // Miss on all levels
    return {
      ok: false,
      error: { code: 'KEY_NOT_FOUND', message: 'Key not found in any cache level' },
    };
  }

  async set(key: string, value: T, options?: SetOptions): Promise<void> {
    // Set in all levels
    await Promise.all(
      this.caches.map((cache) => cache.set(key, value, options))
    );
  }

  async delete(key: string): Promise<boolean> {
    // Delete from all levels
    const results = await Promise.all(
      this.caches.map((cache) => cache.delete(key))
    );
    return results.some(Boolean);
  }

  async has(key: string): Promise<boolean> {
    // Check all levels
    for (const cache of this.caches) {
      if (await cache.has(key)) {
        return true;
      }
    }
    return false;
  }

  async clear(): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.clear()));
  }

  async getOrSet(
    key: string,
    factory: () => Promise<T>,
    options?: SetOptions
  ): Promise<T> {
    const result = await this.get(key);
    
    if (result.ok) {
      return result.data.value;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async mget(keys: readonly string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const remainingKeys = [...keys];

    // Try each level
    for (let i = 0; i < this.caches.length && remainingKeys.length > 0; i++) {
      const levelResult = await this.caches[i].mget(remainingKeys);
      
      for (const [key, value] of levelResult) {
        result.set(key, value);
        
        // Remove from remaining keys
        const idx = remainingKeys.indexOf(key);
        if (idx !== -1) {
          remainingKeys.splice(idx, 1);
        }

        // Populate lower levels
        if (this.config.populateOnHit && i > 0) {
          await this.populateLowerLevels(key, value, i);
        }
      }
    }

    return result;
  }

  async mset(entries: Map<string, T>, options?: SetOptions): Promise<void> {
    await Promise.all(
      this.caches.map((cache) => cache.mset(entries, options))
    );
  }

  async stats(): Promise<CacheStats> {
    const allStats = await Promise.all(
      this.caches.map((cache) => cache.stats())
    );

    // Aggregate stats from all levels
    return allStats.reduce(
      (acc, stats) => ({
        hits: acc.hits + stats.hits,
        misses: acc.misses + stats.misses,
        sets: acc.sets + stats.sets,
        deletes: acc.deletes + stats.deletes,
        size: acc.size + stats.size,
        memoryUsage: (acc.memoryUsage ?? 0) + (stats.memoryUsage ?? 0),
        hitRate: 0, // Calculated below
      }),
      {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        size: 0,
        memoryUsage: 0,
        hitRate: 0,
      }
    );
  }

  async close(): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.close()));
  }

  /**
   * Get a specific cache level
   */
  getLevel(index: number): Cache<T> | undefined {
    return this.caches[index];
  }

  /**
   * Get the number of cache levels
   */
  get levelCount(): number {
    return this.caches.length;
  }

  private async populateLowerLevels(
    key: string,
    value: T,
    hitLevel: number
  ): Promise<void> {
    // Populate L1 through L(hitLevel-1)
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < hitLevel; i++) {
      promises.push(this.caches[i].set(key, value));
    }
    
    await Promise.all(promises);
  }
}

/**
 * Create a multi-level cache
 */
export function createMultiLevelCache<T = unknown>(
  config: MultiLevelCacheConfig
): MultiLevelCache<T> {
  return new MultiLevelCache<T>(config);
}
