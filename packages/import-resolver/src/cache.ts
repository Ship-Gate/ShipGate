// ============================================================================
// Import Resolver Cache - Fast cache keyed by tsconfig hash + lockfile hash + file mtime
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { ResolvedModule } from './types.js';

/**
 * Cache key components
 */
export interface CacheKey {
  tsconfigHash: string;
  lockfileHash: string;
  fileMtime: number;
  importPath: string;
  baseDir: string;
}

/**
 * Cache entry
 */
interface CacheEntry {
  key: string;
  module: ResolvedModule;
  timestamp: number;
}

/**
 * Fast in-memory cache for resolved modules
 */
export class ResolverCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Generate cache key from components
   */
  generateKey(key: CacheKey): string {
    const parts = [
      key.tsconfigHash,
      key.lockfileHash,
      key.fileMtime.toString(),
      key.importPath,
      key.baseDir,
    ];
    return createHash('sha256').update(parts.join('::')).digest('hex');
  }

  /**
   * Get cached module
   */
  get(key: CacheKey): ResolvedModule | null {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    // Verify file hasn't changed (check mtime)
    // Note: Cache invalidation based on mtime is handled by the key itself
    return entry.module;
  }

  /**
   * Set cached module
   */
  set(key: CacheKey, module: ResolvedModule): void {
    const cacheKey = this.generateKey(key);
    
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(cacheKey, {
      key: cacheKey,
      module,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Evict oldest entries (LRU eviction)
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        this.cache.delete(entry[0]);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

/**
 * Compute hash of lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml)
 */
export async function hashLockfile(projectRoot: string): Promise<string> {
  const lockfiles = [
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ];

  for (const lockfile of lockfiles) {
    const lockfilePath = path.join(projectRoot, lockfile);
    try {
      const content = await fs.readFile(lockfilePath, 'utf-8');
      return createHash('sha256').update(content).digest('hex').substring(0, 16);
    } catch {
      // Try next lockfile
    }
  }

  // No lockfile found
  return '';
}

/**
 * Get file modification time
 */
export async function getFileMtime(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtimeMs;
  } catch {
    return 0;
  }
}
