// ============================================================================
// In-Memory Cache Implementation
// ============================================================================

import type { ICache, SetOptions, CacheStats, CacheEntry } from './types.js';

/**
 * Memory cache configuration
 */
export interface MemoryCacheConfig {
  maxSize?: number;
  defaultTTL?: number;
  cleanupInterval?: number;
  onEvict?: (key: string, value: unknown) => void;
}

/**
 * LRU-based in-memory cache
 * 
 * Features:
 * - LRU eviction
 * - TTL support
 * - Automatic cleanup
 * - Stats tracking
 */
export class MemoryCache implements ICache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private accessOrder: string[] = [];
  private config: Required<MemoryCacheConfig>;
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: MemoryCacheConfig = {}) {
    this.config = {
      maxSize: config.maxSize ?? 10000,
      defaultTTL: config.defaultTTL ?? 3600,
      cleanupInterval: config.cleanupInterval ?? 60000,
      onEvict: config.onEvict ?? (() => {}),
    };

    // Start cleanup timer
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => this.cleanup(), this.config.cleanupInterval);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() > entry.createdAt + entry.ttl * 1000) {
      await this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);
    this.stats.hits++;

    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: SetOptions): Promise<void> {
    // Evict if at capacity
    while (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      ttl: options?.ttl ?? this.config.defaultTTL,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      tags: options?.tags,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.stats.sets++;
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.cache.has(key);
    
    if (existed) {
      const entry = this.cache.get(key);
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.deletes++;
      
      if (entry) {
        this.config.onEvict(key, entry.value);
      }
    }

    return existed;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    if (entry.ttl && Date.now() > entry.createdAt + entry.ttl * 1000) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
  }

  async keys(pattern?: string): Promise<string[]> {
    let keys = Array.from(this.cache.keys());
    
    if (pattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      keys = keys.filter(k => regex.test(k));
    }

    return keys;
  }

  async getStats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      deletes: this.stats.deletes,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      evictions: this.stats.evictions,
      memory: this.estimateMemoryUsage(),
    };
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get multiple keys
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    for (const key of keys) {
      results.set(key, await this.get<T>(key));
    }

    return results;
  }

  /**
   * Set multiple keys
   */
  async mset<T>(entries: Array<{ key: string; value: T; options?: SetOptions }>): Promise<void> {
    for (const { key, value, options } of entries) {
      await this.set(key, value, options);
    }
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: SetOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.some(t => tags.includes(t))) {
        await this.delete(key);
        count++;
      }
    }

    return count;
  }

  // Private methods
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    const lruKey = this.accessOrder.shift();
    
    if (lruKey) {
      const entry = this.cache.get(lruKey);
      this.cache.delete(lruKey);
      this.stats.evictions++;
      
      if (entry) {
        this.config.onEvict(lruKey, entry.value);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now > entry.createdAt + entry.ttl * 1000) {
        this.delete(key);
      }
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimate
    let size = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // UTF-16
      size += JSON.stringify(entry.value).length * 2;
      size += 50; // Overhead
    }

    return size;
  }
}

/**
 * Create a memory cache
 */
export function createMemoryCache(config?: MemoryCacheConfig): MemoryCache {
  return new MemoryCache(config);
}
