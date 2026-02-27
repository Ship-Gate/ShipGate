/**
 * SMT Query Cache
 * 
 * Provides deterministic caching for SMT queries using SHA-256 hashing.
 * Same input formula always produces the same query hash, ensuring
 * deterministic behavior across runs.
 */

import { createHash } from 'crypto';
import type { SMTExpr, SMTDecl } from '@isl-lang/prover';
import { toSMTLib, declToSMTLib } from '@isl-lang/prover';
import type { SMTCheckResult } from './types.js';

/**
 * Cache entry with timestamp and hit count
 */
interface CacheEntry {
  result: SMTCheckResult;
  timestamp: number;
  hits: number;
  queryHash: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Maximum number of entries (default: 1000) */
  maxEntries?: number;
  /** TTL in milliseconds (default: 1 hour) */
  ttlMs?: number;
  /** Enable cache (default: true) */
  enabled?: boolean;
}

/**
 * SMT Query Cache
 * 
 * Uses LRU eviction with TTL expiration.
 */
export class SMTCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: Required<CacheConfig>;
  
  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };
  
  constructor(config: CacheConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      ttlMs: config.ttlMs ?? 60 * 60 * 1000, // 1 hour
      enabled: config.enabled ?? true,
    };
  }
  
  /**
   * Generate deterministic hash for a query
   * 
   * The hash is computed from the normalized SMT-LIB representation,
   * ensuring that semantically identical queries produce the same hash.
   */
  hashQuery(formula: SMTExpr, declarations: SMTDecl[]): string {
    // Generate canonical SMT-LIB representation
    const parts: string[] = [];
    
    // Sort declarations by name for determinism
    const sortedDecls = [...declarations].sort((a, b) => {
      const nameA = this.getDeclName(a);
      const nameB = this.getDeclName(b);
      return nameA.localeCompare(nameB);
    });
    
    for (const decl of sortedDecls) {
      parts.push(declToSMTLib(decl));
    }
    
    parts.push(toSMTLib(formula));
    
    const canonical = parts.join('\n');
    
    // SHA-256 hash for deterministic, collision-resistant hashing
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
  
  /**
   * Get declaration name for sorting
   */
  private getDeclName(decl: SMTDecl): string {
    switch (decl.kind) {
      case 'DeclareConst':
      case 'DeclareFun':
      case 'DeclareSort':
      case 'DeclareDatatype':
      case 'DefineFun':
        return decl.name;
      case 'Assert':
        return '__assert__';
      default:
        return '';
    }
  }
  
  /**
   * Get cached result
   */
  get(queryHash: string): SMTCheckResult | null {
    if (!this.config.enabled) {
      return null;
    }
    
    const entry = this.cache.get(queryHash);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > this.config.ttlMs) {
      this.cache.delete(queryHash);
      this.stats.expirations++;
      this.stats.misses++;
      return null;
    }
    
    // Update hit count and move to front (LRU)
    entry.hits++;
    this.cache.delete(queryHash);
    this.cache.set(queryHash, entry);
    
    this.stats.hits++;
    return entry.result;
  }
  
  /**
   * Store result in cache
   */
  set(queryHash: string, result: SMTCheckResult): void {
    if (!this.config.enabled) {
      return;
    }
    
    // Don't cache errors (they might be transient)
    if (result.status === 'error') {
      return;
    }
    
    // Evict if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }
    
    this.cache.set(queryHash, {
      result,
      timestamp: Date.now(),
      hits: 0,
      queryHash,
    });
  }
  
  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    // Map maintains insertion order, so first key is oldest
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }
  
  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    expirations: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
  }
  
  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Enable or disable cache
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

/**
 * Global cache instance
 */
let globalCache: SMTCache | null = null;

/**
 * Get or create global cache instance
 */
export function getGlobalCache(): SMTCache {
  if (!globalCache) {
    globalCache = new SMTCache();
  }
  return globalCache;
}

/**
 * Reset global cache
 */
export function resetGlobalCache(): void {
  if (globalCache) {
    globalCache.clear();
  }
}
