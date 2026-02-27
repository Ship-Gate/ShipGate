// ============================================================================
// NPM Registry Checker with Caching and Rate Limiting
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Registry check cache entry
 */
interface CacheEntry {
  exists: boolean;
  timestamp: number;
}

/**
 * Registry checker with caching and rate limiting
 */
export class RegistryChecker {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDir: string;
  private cacheFile: string;
  private checkCount = 0;
  private maxChecks: number;
  private timeout: number;
  private pendingChecks: Map<string, Promise<boolean>> = new Map();

  constructor(options: {
    cacheDir: string;
    maxChecks: number;
    timeout: number;
  }) {
    this.cacheDir = options.cacheDir;
    this.cacheFile = path.join(this.cacheDir, 'registry-cache.json');
    this.maxChecks = options.maxChecks;
    this.timeout = options.timeout;
  }

  /**
   * Load cache from disk
   */
  async loadCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const content = await fs.readFile(this.cacheFile, 'utf-8');
      const data = JSON.parse(content) as Record<string, CacheEntry>;
      this.cache = new Map(Object.entries(data));
    } catch {
      // Cache doesn't exist or is invalid, start fresh
      this.cache = new Map();
    }
  }

  /**
   * Save cache to disk
   */
  async saveCache(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const data = Object.fromEntries(this.cache);
      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore cache save errors
    }
  }

  /**
   * Check if package exists on npm registry
   * Returns cached result if available, otherwise checks registry
   */
  async packageExists(packageName: string): Promise<boolean> {
    // Check if we've exceeded max checks
    if (this.checkCount >= this.maxChecks) {
      return false; // Don't block, assume it doesn't exist
    }

    // Check cache first (24 hour TTL)
    const cacheKey = this.getCacheKey(packageName);
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    const ttl = 24 * 60 * 60 * 1000; // 24 hours

    if (cached && now - cached.timestamp < ttl) {
      return cached.exists;
    }

    // Check if there's already a pending check for this package
    const pending = this.pendingChecks.get(packageName);
    if (pending) {
      return pending;
    }

    // Create new check promise
    const checkPromise = this.performCheck(packageName);
    this.pendingChecks.set(packageName, checkPromise);

    try {
      const result = await checkPromise;
      return result;
    } finally {
      this.pendingChecks.delete(packageName);
    }
  }

  /**
   * Perform actual registry check
   */
  private async performCheck(packageName: string): Promise<boolean> {
    this.checkCount++;

    const cacheKey = this.getCacheKey(packageName);

    try {
      // Use npm registry API
      const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(registryUrl, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        clearTimeout(timeoutId);

        const exists = response.status === 200;

        // Cache result
        this.cache.set(cacheKey, {
          exists,
          timestamp: Date.now(),
        });

        return exists;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          // Timeout - don't cache, return false to avoid blocking
          return false;
        }
        throw error;
      }
    } catch {
      // Network error or other issue - don't cache, return false
      return false;
    }
  }

  /**
   * Get cache key for package name
   */
  private getCacheKey(packageName: string): string {
    return createHash('sha256').update(packageName).digest('hex');
  }

  /**
   * Get number of registry checks made
   */
  getCheckCount(): number {
    return this.checkCount;
  }
}
