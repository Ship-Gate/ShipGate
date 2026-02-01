/**
 * File-based cache implementation
 * Stores cache entries as JSON files on disk
 */

import { mkdir, readFile, writeFile, unlink, readdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type {
  Cache,
  CacheEntry,
  CacheGetResult,
  CacheSetOptions,
  CacheStats,
  FileCacheOptions,
  Fingerprint,
} from './cacheTypes.js';
import { stableStringify } from './fingerprintCache.js';

/**
 * Convert a fingerprint to a safe filename
 * Uses SHA-256 hash to ensure consistent, filesystem-safe names
 */
export function fingerprintToFilename(fingerprint: Fingerprint): string {
  const hash = createHash('sha256').update(fingerprint).digest('hex');
  return `${hash.slice(0, 16)}.json`;
}

/**
 * File-based cache implementation
 */
export class FileCache<T = unknown> implements Cache<T> {
  private readonly cacheDir: string;
  private readonly defaultTtl?: number;
  private initialized = false;

  constructor(options: FileCacheOptions) {
    this.cacheDir = options.cacheDir;
    this.defaultTtl = options.defaultTtl;
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.cacheDir, { recursive: true });
    this.initialized = true;
  }

  /**
   * Get the file path for a fingerprint
   */
  private getFilePath(fingerprint: Fingerprint): string {
    return join(this.cacheDir, fingerprintToFilename(fingerprint));
  }

  /**
   * Check if an entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (entry.meta.expiresAt === undefined) return false;
    return Date.now() > entry.meta.expiresAt;
  }

  /**
   * Get an entry by fingerprint
   */
  async get(fingerprint: Fingerprint): Promise<CacheGetResult<T>> {
    await this.ensureDir();
    const filePath = this.getFilePath(fingerprint);

    try {
      const content = await readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      if (this.isExpired(entry)) {
        // Clean up expired entry
        await this.delete(fingerprint);
        return { hit: false };
      }

      return {
        hit: true,
        data: entry.data,
        meta: entry.meta,
      };
    } catch (error) {
      // File doesn't exist or is invalid
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { hit: false };
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Set an entry by fingerprint
   */
  async set(fingerprint: Fingerprint, data: T, options?: CacheSetOptions): Promise<void> {
    await this.ensureDir();
    const filePath = this.getFilePath(fingerprint);

    const now = Date.now();
    const ttl = options?.ttl ?? this.defaultTtl;

    const entry: CacheEntry<T> = {
      data,
      meta: {
        fingerprint,
        createdAt: now,
        expiresAt: ttl !== undefined ? now + ttl : undefined,
      },
    };

    // Use stable stringify for deterministic serialization
    const content = stableStringify(entry);
    await writeFile(filePath, content, 'utf-8');
  }

  /**
   * Delete an entry by fingerprint
   */
  async delete(fingerprint: Fingerprint): Promise<boolean> {
    await this.ensureDir();
    const filePath = this.getFilePath(fingerprint);

    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Check if an entry exists and is valid
   */
  async has(fingerprint: Fingerprint): Promise<boolean> {
    const result = await this.get(fingerprint);
    return result.hit;
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.ensureDir();

    try {
      await rm(this.cacheDir, { recursive: true, force: true });
      this.initialized = false;
      await this.ensureDir();
    } catch {
      // Directory might not exist, that's fine
    }
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    await this.ensureDir();

    let entryCount = 0;
    let totalSizeBytes = 0;
    let expiredCount = 0;

    try {
      const files = await readdir(this.cacheDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.cacheDir, file);

        try {
          const fileStat = await stat(filePath);
          totalSizeBytes += fileStat.size;
          entryCount++;

          // Check if expired
          const content = await readFile(filePath, 'utf-8');
          const entry: CacheEntry<T> = JSON.parse(content);
          if (this.isExpired(entry)) {
            expiredCount++;
          }
        } catch {
          // Skip invalid files
        }
      }
    } catch {
      // Directory might not exist
    }

    return {
      entryCount,
      totalSizeBytes,
      expiredCount,
    };
  }
}
