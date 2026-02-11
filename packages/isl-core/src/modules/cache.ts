/**
 * ISL AST Cache
 *
 * Caches parsed ASTs per module to avoid repeated parsing.
 * Uses file modification time (mtime) for cache invalidation.
 */

import * as fs from 'fs';
import type { DomainDeclaration } from '../ast/types.js';
import type { ModuleId } from './types.js';
import { createModuleId } from './types.js';

// ============================================================================
// Cache Entry Types
// ============================================================================

/**
 * A single cache entry containing the parsed AST and metadata.
 */
interface CacheEntry {
  /** The parsed AST */
  ast: DomainDeclaration;

  /** File modification time when cached */
  mtime: number;

  /** When the entry was added to cache */
  cachedAt: number;

  /** Number of times this entry has been accessed */
  accessCount: number;

  /** Last access time */
  lastAccessedAt: number;

  /** Monotonic order of last access (get or set); used for LRU eviction */
  accessOrder: number;
}

/**
 * Cache statistics for monitoring.
 */
export interface CacheStats {
  /** Number of entries in cache */
  size: number;

  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Total invalidations */
  invalidations: number;

  /** Hit rate as percentage */
  hitRate: number;

  /** Entries by access count */
  topEntries: Array<{ id: ModuleId; accessCount: number }>;
}

// ============================================================================
// AST Cache Implementation
// ============================================================================

/**
 * Configuration options for the cache.
 */
export interface ASTCacheOptions {
  /** Maximum number of entries (default: 1000) */
  maxSize?: number;

  /** Time-to-live in milliseconds (default: no expiry) */
  ttl?: number;

  /** Whether to automatically check mtime on get (default: true) */
  autoCheckMtime?: boolean;
}

/**
 * In-memory cache for parsed ISL ASTs.
 *
 * Features:
 * - File modification time based invalidation
 * - LRU eviction when max size is reached
 * - Optional TTL for entries
 * - Statistics tracking
 */
export class ASTCache {
  private cache: Map<ModuleId, CacheEntry> = new Map();
  private options: Required<ASTCacheOptions>;
  private stats = { hits: 0, misses: 0, invalidations: 0 };
  /** Monotonic counter for access order; ensures LRU is unambiguous when timestamps coincide */
  private accessCounter = 0;

  constructor(options: ASTCacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 1000,
      ttl: options.ttl ?? Infinity,
      autoCheckMtime: options.autoCheckMtime ?? true,
    };
  }

  /**
   * Get a cached AST if valid.
   *
   * @param id - Module identifier
   * @param mtime - Current file modification time (optional if autoCheckMtime is true)
   * @returns The cached AST or null if not cached/invalid
   */
  get(id: ModuleId, mtime?: number): DomainDeclaration | null {
    const entry = this.cache.get(id);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(id);
      this.stats.misses++;
      this.stats.invalidations++;
      return null;
    }

    // Check mtime if provided
    if (mtime !== undefined && entry.mtime !== mtime) {
      this.cache.delete(id);
      this.stats.misses++;
      this.stats.invalidations++;
      return null;
    }

    // Update access stats and recency for LRU
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    entry.accessOrder = ++this.accessCounter;

    this.stats.hits++;
    return entry.ast;
  }

  /**
   * Get a cached AST, automatically checking the file's mtime.
   *
   * @param id - Module identifier
   * @param filePath - Path to the file for mtime check
   * @returns The cached AST or null if not cached/invalid
   */
  getWithPath(id: ModuleId, filePath: string): DomainDeclaration | null {
    if (!this.options.autoCheckMtime) {
      return this.get(id);
    }

    const mtime = this.getFileMtime(filePath);
    if (mtime === null) {
      // File doesn't exist, invalidate cache
      this.invalidate(id);
      return null;
    }

    return this.get(id, mtime);
  }

  /**
   * Store an AST in the cache.
   *
   * @param id - Module identifier
   * @param ast - The parsed AST
   * @param mtime - File modification time
   */
  set(id: ModuleId, ast: DomainDeclaration, mtime: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.options.maxSize && !this.cache.has(id)) {
      this.evictLRU();
    }

    this.cache.set(id, {
      ast,
      mtime,
      cachedAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
      accessOrder: ++this.accessCounter,
    });
  }

  /**
   * Store an AST, automatically getting the file's mtime.
   *
   * @param id - Module identifier
   * @param ast - The parsed AST
   * @param filePath - Path to the file
   */
  setWithPath(id: ModuleId, ast: DomainDeclaration, filePath: string): void {
    const mtime = this.getFileMtime(filePath);
    if (mtime !== null) {
      this.set(id, ast, mtime);
    }
  }

  /**
   * Invalidate a specific cache entry.
   *
   * @param id - Module identifier to invalidate
   */
  invalidate(id: ModuleId): void {
    if (this.cache.delete(id)) {
      this.stats.invalidations++;
    }
  }

  /**
   * Invalidate all entries matching a predicate.
   *
   * @param predicate - Function to test each entry
   */
  invalidateWhere(predicate: (id: ModuleId, ast: DomainDeclaration) => boolean): void {
    const toDelete: ModuleId[] = [];

    for (const [id, entry] of this.cache) {
      if (predicate(id, entry.ast)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.cache.delete(id);
      this.stats.invalidations++;
    }
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += size;
  }

  /**
   * Check if a module is in the cache.
   */
  has(id: ModuleId): boolean {
    return this.cache.has(id);
  }

  /**
   * Get the number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    // Get top entries by access count
    const entries = Array.from(this.cache.entries())
      .map(([id, entry]) => ({ id, accessCount: entry.accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      invalidations: this.stats.invalidations,
      hitRate: Math.round(hitRate * 100) / 100,
      topEntries: entries,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
  }

  /**
   * Get all cached module IDs.
   */
  keys(): ModuleId[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Prune expired entries.
   */
  prune(): number {
    if (this.options.ttl === Infinity) {
      return 0;
    }

    let pruned = 0;
    for (const [id, entry] of this.cache) {
      if (this.isExpired(entry)) {
        this.cache.delete(id);
        this.stats.invalidations++;
        pruned++;
      }
    }
    return pruned;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Check if an entry is expired based on TTL.
   */
  private isExpired(entry: CacheEntry): boolean {
    if (this.options.ttl === Infinity) {
      return false;
    }
    return Date.now() - entry.cachedAt > this.options.ttl;
  }

  /**
   * Evict the least recently used entry (by access order; get and set both refresh).
   */
  private evictLRU(): void {
    let lruKey: ModuleId | null = null;
    let minOrder = Infinity;

    for (const [id, entry] of this.cache) {
      if (entry.accessOrder < minOrder) {
        minOrder = entry.accessOrder;
        lruKey = id;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.invalidations++;
    }
  }

  /**
   * Get file modification time.
   */
  private getFileMtime(filePath: string): number | null {
    try {
      const stats = fs.statSync(filePath);
      return stats.mtimeMs;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new AST cache with default options.
 */
export function createCache(options?: ASTCacheOptions): ASTCache {
  return new ASTCache(options);
}

/**
 * Global singleton cache for convenience.
 */
let globalCache: ASTCache | null = null;

/**
 * Get the global AST cache instance.
 */
export function getGlobalCache(): ASTCache {
  if (!globalCache) {
    globalCache = new ASTCache();
  }
  return globalCache;
}

/**
 * Reset the global cache (mainly for testing).
 */
export function resetGlobalCache(): void {
  globalCache?.clear();
  globalCache = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a cache key from a file path.
 */
export function cacheKeyFromPath(filePath: string): ModuleId {
  // Normalize the path
  const normalized = filePath.replace(/\\/g, '/');
  return createModuleId(normalized);
}

/**
 * Warm up the cache by pre-parsing files.
 *
 * @param cache - The cache to warm
 * @param files - Array of file paths to cache
 * @param parser - Function to parse ISL source
 * @param readFile - Function to read file contents
 */
export function warmCache(
  cache: ASTCache,
  files: string[],
  parser: (source: string, file?: string) => { ast: DomainDeclaration | null },
  readFile: (path: string) => string
): void {
  for (const filePath of files) {
    try {
      const source = readFile(filePath);
      const { ast } = parser(source, filePath);
      if (ast) {
        const id = cacheKeyFromPath(filePath);
        cache.setWithPath(id, ast, filePath);
      }
    } catch {
      // Skip files that can't be read or parsed
    }
  }
}
