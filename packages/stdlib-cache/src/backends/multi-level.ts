/**
 * Multi-Level Cache - Tiered caching with automatic population.
 */

import type {
  CacheBackend,
  CacheStats,
  SetOptions,
  MemoryCacheConfig,
  RedisCacheConfig,
} from '../types.js';
import { MemoryCache } from './memory.js';
import { RedisCache } from './redis.js';

/**
 * Cache level configuration
 */
export type CacheLevel =
  | ({ readonly type: 'memory' } & MemoryCacheConfig)
  | ({ readonly type: 'redis' } & RedisCacheConfig);

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
export class MultiLevelCache implements CacheBackend {
  name = 'multi-level';
  
  private readonly caches: CacheBackend[];
  private readonly config: MultiLevelCacheConfig;

  constructor(config: MultiLevelCacheConfig) {
    this.config = {
      populateOnHit: true,
      ...config,
    };

    this.caches = config.levels.map((level) => {
      if (level.type === 'memory') {
        return new MemoryCache(level);
      } else {
        return new RedisCache(level);
      }
    });
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    // Try each level from L1 to LN
    for (let i = 0; i < this.caches.length; i++) {
      const value = await this.caches[i].get<T>(key);
      
      if (value !== undefined) {
        // Populate lower levels
        if (this.config.populateOnHit && i > 0) {
          await this.populateLowerLevels(key, value, i);
        }
        return value;
      }
    }

    return undefined;
  }

  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<boolean> {
    // Set in all levels
    const results = await Promise.all(
      this.caches.map((cache) => cache.set(key, value, options))
    );
    return results.every(Boolean);
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

  async mget<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const remainingKeys = [...keys];

    // Try each level
    for (let i = 0; i < this.caches.length && remainingKeys.length > 0; i++) {
      const levelResult = await this.caches[i].mget<T>(remainingKeys);
      
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

  async mset<T = unknown>(entries: Map<string, T>, options?: SetOptions): Promise<boolean> {
    const results = await Promise.all(
      this.caches.map((cache) => cache.mset(entries, options))
    );
    return results.every(Boolean);
  }

  async mdelete(keys: string[]): Promise<number> {
    let maxDeleted = 0;
    for (const cache of this.caches) {
      const deleted = await cache.mdelete(keys);
      maxDeleted = Math.max(maxDeleted, deleted);
    }
    return maxDeleted;
  }

  async keys(pattern?: string): Promise<string[]> {
    // Get keys from all levels and deduplicate
    const allKeysArrays = await Promise.all(
      this.caches.map((cache) => cache.keys(pattern))
    );
    return [...new Set(allKeysArrays.flat())];
  }

  async stats(): Promise<CacheStats> {
    const allStats = await Promise.all(
      this.caches.map((cache) => cache.stats())
    );

    // Aggregate stats from all levels
    const aggregated = allStats.reduce<CacheStats>(
      (acc: CacheStats, stats: CacheStats) => ({
        hits: acc.hits + stats.hits,
        misses: acc.misses + stats.misses,
        sets: acc.sets + stats.sets,
        deletes: acc.deletes + stats.deletes,
        size: acc.size + stats.size,
        evictions: acc.evictions + stats.evictions,
        memoryUsage: (acc.memoryUsage ?? 0) + (stats.memoryUsage ?? 0),
        hitRate: 0, // Calculated below
      }),
      {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        size: 0,
        evictions: 0,
        memoryUsage: 0,
        hitRate: 0,
      }
    );

    const total = aggregated.hits + aggregated.misses;
    aggregated.hitRate = total > 0 ? aggregated.hits / total : 0;
    return aggregated;
  }

  async close(): Promise<void> {
    await Promise.all(this.caches.map((cache) => cache.close()));
  }

  /**
   * Get a specific cache level
   */
  getLevel(index: number): CacheBackend | undefined {
    return this.caches[index];
  }

  /**
   * Get the number of cache levels
   */
  get levelCount(): number {
    return this.caches.length;
  }

  private async populateLowerLevels<T>(
    key: string,
    value: T,
    hitLevel: number
  ): Promise<void> {
    // Populate L1 through L(hitLevel-1)
    const promises: Promise<boolean>[] = [];
    
    for (let i = 0; i < hitLevel; i++) {
      promises.push(this.caches[i].set(key, value));
    }
    
    await Promise.all(promises);
  }
}

/**
 * Create a multi-level cache
 */
export function createMultiLevelCache(
  config: MultiLevelCacheConfig
): MultiLevelCache {
  return new MultiLevelCache(config);
}
