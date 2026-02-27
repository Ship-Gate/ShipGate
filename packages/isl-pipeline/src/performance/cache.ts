/**
 * Performance Caching Layer
 * 
 * Caches parse results, gate results, and other expensive operations.
 * 
 * @module @isl-lang/pipeline/performance
 */

import { createHash } from 'crypto';
import type { DomainDeclaration } from '@isl-lang/isl-core';
import type { SemanticViolation } from '../semantic-rules.js';

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
}

// ============================================================================
// Parse Cache
// ============================================================================

export class ParseCache {
  private cache = new Map<string, CacheEntry<{ ast: DomainDeclaration; errors: unknown[] }>>();
  private maxSize: number;
  private ttl: number; // Time to live in ms
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(maxSize = 1000, ttl = 3600000) { // 1 hour default
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get cached parse result
   */
  get(source: string, filePath: string): { ast: DomainDeclaration; errors: unknown[] } | null {
    const key = this.computeKey(source, filePath);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set cached parse result
   */
  set(source: string, filePath: string, value: { ast: DomainDeclaration; errors: unknown[] }): void {
    const key = this.computeKey(source, filePath);

    // Evict if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Invalidate cache for a file
   */
  invalidate(filePath: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(filePath)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Compute cache key from source and file path
   */
  private computeKey(source: string, filePath: string): string {
    const hash = createHash('sha256');
    hash.update(source);
    hash.update(filePath);
    return hash.digest('hex');
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // Prefer entries with fewer hits and older timestamps
      if (entry.hits < lruHits || (entry.hits === lruHits && entry.timestamp < lruTime)) {
        lruHits = entry.hits;
        lruTime = entry.timestamp;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }
}

// ============================================================================
// Gate Cache (Semantic Rules Cache)
// ============================================================================

export class GateCache {
  private cache = new Map<string, CacheEntry<SemanticViolation[]>>();
  private maxSize: number;
  private ttl: number;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  constructor(maxSize = 2000, ttl = 1800000) { // 30 minutes default
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get cached gate violations
   */
  get(codeMap: Map<string, string>): SemanticViolation[] | null {
    const key = this.computeKey(codeMap);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set cached gate violations
   */
  set(codeMap: Map<string, string>, violations: SemanticViolation[]): void {
    const key = this.computeKey(codeMap);

    // Evict if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      value: violations,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * Invalidate cache for changed files
   */
  invalidateFiles(changedFiles: string[]): void {
    for (const file of changedFiles) {
      for (const [key] of this.cache.entries()) {
        if (key.includes(file)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Compute cache key from code map
   */
  private computeKey(codeMap: Map<string, string>): string {
    const hash = createHash('sha256');
    
    // Sort files for consistent hashing
    const sortedFiles = Array.from(codeMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [file, content] of sortedFiles) {
      hash.update(file);
      hash.update(content);
    }
    
    return hash.digest('hex');
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < lruHits || (entry.hits === lruHits && entry.timestamp < lruTime)) {
        lruHits = entry.hits;
        lruTime = entry.timestamp;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }
}

// ============================================================================
// Global Cache Instances
// ============================================================================

let parseCacheInstance: ParseCache | null = null;
let gateCacheInstance: GateCache | null = null;

export function getParseCache(): ParseCache {
  if (!parseCacheInstance) {
    parseCacheInstance = new ParseCache();
  }
  return parseCacheInstance;
}

export function getGateCache(): GateCache {
  if (!gateCacheInstance) {
    gateCacheInstance = new GateCache();
  }
  return gateCacheInstance;
}

export function clearAllCaches(): void {
  parseCacheInstance?.clear();
  gateCacheInstance?.clear();
}
