/**
 * In-Memory Cache Backend
 * 
 * LRU/LFU cache with TTL support.
 */

import type {
  CacheBackend,
  CacheEntry,
  CacheStats,
  SetOptions,
  GetOptions,
  MemoryCacheConfig,
  CacheEvent,
  CacheEventHandler,
  EvictionReason,
  Serializer,
} from '../types.js';

import { JsonSerializer } from '../types.js';

/**
 * In-memory cache with LRU eviction
 */
export class MemoryCache implements CacheBackend {
  name = 'memory';
  
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<MemoryCacheConfig>;
  private stats: CacheStats;
  private cleanupTimer?: NodeJS.Timeout;
  private eventHandlers: CacheEventHandler[] = [];
  private serializer: Serializer;
  
  constructor(config: MemoryCacheConfig = {}) {
    this.config = {
      defaultTtl: config.defaultTtl ?? 0, // 0 = no expiry
      maxSize: config.maxSize ?? 10000,
      prefix: config.prefix ?? '',
      serializer: config.serializer ?? new JsonSerializer(),
      stats: config.stats ?? true,
      staleWhileRevalidate: config.staleWhileRevalidate ?? 0,
      evictionPolicy: config.evictionPolicy ?? 'lru',
      cleanupInterval: config.cleanupInterval ?? 60000,
      maxMemory: config.maxMemory ?? 0,
    };
    
    this.serializer = this.config.serializer;
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      maxSize: this.config.maxSize,
      hitRate: 0,
      evictions: 0,
    };
    
    // Start cleanup interval
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.cleanup(),
        this.config.cleanupInterval
      );
    }
  }
  
  async get<T = unknown>(key: string, options?: GetOptions): Promise<T | undefined> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.cache.get(prefixedKey);
    
    if (!entry) {
      this.recordMiss(key);
      return undefined;
    }
    
    // Check expiry
    if (this.isExpired(entry)) {
      // Check stale-while-revalidate
      if (options?.stale && this.config.staleWhileRevalidate > 0) {
        const staleDeadline = entry.expiresAt! + this.config.staleWhileRevalidate;
        if (Date.now() < staleDeadline) {
          this.recordHit(key);
          return entry.value as T;
        }
      }
      
      this.cache.delete(prefixedKey);
      this.emit({ type: 'expire', key });
      this.recordMiss(key);
      return undefined;
    }
    
    // Update access info
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    
    // Touch TTL if requested
    if (options?.touch && entry.expiresAt) {
      const remainingTtl = entry.expiresAt - entry.createdAt;
      entry.expiresAt = Date.now() + remainingTtl;
    }
    
    this.recordHit(key);
    return entry.value as T;
  }
  
  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    
    // Handle NX (only if not exists)
    if (options?.nx && this.cache.has(prefixedKey)) {
      return false;
    }
    
    // Handle XX (only if exists)
    if (options?.xx && !this.cache.has(prefixedKey)) {
      return false;
    }
    
    // Evict if needed
    if (this.cache.size >= this.config.maxSize) {
      await this.evict();
    }
    
    const ttl = options?.ttl ?? this.config.defaultTtl;
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: ttl > 0 ? now + ttl : undefined,
      lastAccessedAt: now,
      accessCount: 0,
      tags: options?.tags,
      size: this.estimateSize(value),
    };
    
    this.cache.set(prefixedKey, entry);
    this.stats.sets++;
    this.stats.size = this.cache.size;
    
    this.emit({ type: 'set', key, ttl });
    
    return true;
  }
  
  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const deleted = this.cache.delete(prefixedKey);
    
    if (deleted) {
      this.stats.deletes++;
      this.stats.size = this.cache.size;
      this.emit({ type: 'delete', key });
    }
    
    return deleted;
  }
  
  async has(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.cache.get(prefixedKey);
    
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(prefixedKey);
      return false;
    }
    
    return true;
  }
  
  async mget<T = unknown>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    
    return result;
  }
  
  async mset<T = unknown>(entries: Map<string, T>, options?: SetOptions): Promise<boolean> {
    for (const [key, value] of entries) {
      await this.set(key, value, options);
    }
    return true;
  }
  
  async mdelete(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        count++;
      }
    }
    return count;
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
    this.emit({ type: 'clear' });
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys())
      .map(k => this.unprefixKey(k))
      .filter(k => {
        const entry = this.cache.get(this.prefixKey(k));
        return entry && !this.isExpired(entry);
      });
    
    if (!pattern) return allKeys;
    
    // Simple glob pattern matching
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    
    return allKeys.filter(k => regex.test(k));
  }
  
  async stats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }
  
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cache.clear();
  }
  
  async deleteByTag(tag: string): Promise<number> {
    let count = 0;
    
    for (const [key, entry] of this.cache) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    this.stats.size = this.cache.size;
    return count;
  }
  
  async ttl(key: string): Promise<number> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.cache.get(prefixedKey);
    
    if (!entry || !entry.expiresAt) return -1;
    
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -1;
  }
  
  async expire(key: string, ttl: number): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.cache.get(prefixedKey);
    
    if (!entry) return false;
    
    entry.expiresAt = Date.now() + ttl;
    return true;
  }
  
  // Event handling
  
  on(handler: CacheEventHandler): void {
    this.eventHandlers.push(handler);
  }
  
  off(handler: CacheEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }
  
  // Private methods
  
  private prefixKey(key: string): string {
    return this.config.prefix ? `${this.config.prefix}:${key}` : key;
  }
  
  private unprefixKey(key: string): string {
    if (this.config.prefix && key.startsWith(`${this.config.prefix}:`)) {
      return key.slice(this.config.prefix.length + 1);
    }
    return key;
  }
  
  private isExpired(entry: CacheEntry): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }
  
  private async evict(): Promise<void> {
    let keyToEvict: string | null = null;
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.findLruKey();
        break;
      case 'lfu':
        keyToEvict = this.findLfuKey();
        break;
      case 'fifo':
        keyToEvict = this.findFifoKey();
        break;
      case 'random':
        keyToEvict = this.findRandomKey();
        break;
    }
    
    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      this.emit({ 
        type: 'evict', 
        key: this.unprefixKey(keyToEvict), 
        reason: this.config.evictionPolicy as EvictionReason 
      });
    }
  }
  
  private findLruKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
  
  private findLfuKey(): string | null {
    let leastKey: string | null = null;
    let leastCount = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.accessCount < leastCount) {
        leastCount = entry.accessCount;
        leastKey = key;
      }
    }
    
    return leastKey;
  }
  
  private findFifoKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
  
  private findRandomKey(): string | null {
    const keys = Array.from(this.cache.keys());
    if (keys.length === 0) return null;
    return keys[Math.floor(Math.random() * keys.length)];
  }
  
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        this.emit({ type: 'expire', key: this.unprefixKey(key) });
      }
    }
    
    this.stats.size = this.cache.size;
  }
  
  private estimateSize(value: unknown): number {
    // Rough estimation of value size in bytes
    const str = JSON.stringify(value);
    return str.length * 2; // Approximate UTF-16 size
  }
  
  private recordHit(key: string): void {
    this.stats.hits++;
    this.emit({ type: 'get', key, hit: true });
  }
  
  private recordMiss(key: string): void {
    this.stats.misses++;
    this.emit({ type: 'get', key, hit: false });
  }
  
  private emit(event: CacheEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }
}

/**
 * Create memory cache instance
 */
export function createMemoryCache(config?: MemoryCacheConfig): MemoryCache {
  return new MemoryCache(config);
}
