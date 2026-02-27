/**
 * CacheManager: ISL spec cache with prompt hash as key
 * Stores: { promptHash, islSpec, parsedAST, timestamp, modelUsed }
 * On re-run with same prompt: skip Stage 1 (NL→ISL), load cached spec
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { sha256 } from './hash.js';
import { parse } from '@isl-lang/parser';
import type { ISLSpecCacheEntry, CacheStats } from './types.js';

const CACHE_DIR = '.isl-cache';
const SPEC_CACHE_FILE = 'spec-cache.json';
const LAST_RUN_FILE = 'last-run.json';

export interface CacheManagerOptions {
  /** Project root (default: process.cwd()) */
  projectRoot?: string;
  /** Disable cache (e.g. --no-cache) */
  noCache?: boolean;
}

export interface CacheLookupResult {
  hit: boolean;
  entry?: ISLSpecCacheEntry;
  stats?: CacheStats;
}

export interface LastRunEntry {
  promptHash: string;
  islSpec: string;
  parsedAST: unknown;
  timestamp: number;
  modelUsed: string;
}

/**
 * Manages ISL spec cache and last-run state for incremental codegen
 */
export class CacheManager {
  private readonly cacheDir: string;
  private readonly specCachePath: string;
  private readonly lastRunPath: string;
  private readonly noCache: boolean;

  constructor(options: CacheManagerOptions = {}) {
    const root = options.projectRoot ?? process.cwd();
    this.cacheDir = join(root, CACHE_DIR);
    this.specCachePath = join(this.cacheDir, SPEC_CACHE_FILE);
    this.lastRunPath = join(this.cacheDir, LAST_RUN_FILE);
    this.noCache = options.noCache ?? false;
  }

  /**
   * Compute cache key from NL prompt (and options that affect generation)
   */
  getPromptHash(prompt: string, options?: { framework?: string; database?: string; frontend?: boolean }): string {
    const normalized = JSON.stringify({
      prompt: prompt.trim(),
      framework: options?.framework ?? 'nextjs',
      database: options?.database ?? 'sqlite',
      frontend: options?.frontend ?? true,
    });
    return sha256(normalized);
  }

  /**
   * Look up cached ISL spec by prompt hash
   */
  async lookupSpec(
    promptHash: string,
    estimatedSaveMs = 8000,
    estimatedSaveTokens = 2000
  ): Promise<CacheLookupResult> {
    if (this.noCache) {
      return { hit: false };
    }

    try {
      const data = await readFile(this.specCachePath, 'utf-8');
      const cache = JSON.parse(data) as Record<string, ISLSpecCacheEntry>;
      const entry = cache[promptHash];

      if (entry) {
        return {
          hit: true,
          entry,
          stats: {
            hit: true,
            stage: 'nl-to-isl',
            savedMs: estimatedSaveMs,
            savedTokens: estimatedSaveTokens,
            message: `Cache hit: skipped Stage 1 (saved ~${(estimatedSaveMs / 1000).toFixed(0)}s, ~${(estimatedSaveTokens / 1000).toFixed(1)}k tokens)`,
          },
        };
      }
    } catch {
      // Cache file missing or invalid
    }

    return { hit: false };
  }

  /**
   * Store ISL spec in cache
   */
  async storeSpec(
    promptHash: string,
    islSpec: string,
    modelUsed: string,
    parsedAST?: unknown
  ): Promise<void> {
    if (this.noCache) return;

    try {
      await mkdir(this.cacheDir, { recursive: true });

      let cache: Record<string, ISLSpecCacheEntry> = {};
      try {
        const data = await readFile(this.specCachePath, 'utf-8');
        cache = JSON.parse(data);
      } catch {
        // Start fresh
      }

      const ast = parsedAST ?? this.parseSpec(islSpec);

      cache[promptHash] = {
        promptHash,
        islSpec,
        parsedAST: ast,
        timestamp: Date.now(),
        modelUsed,
      };

      await writeFile(this.specCachePath, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (err) {
      // Non-fatal: log but don't fail pipeline
      if (process.env.DEBUG) {
        console.warn('[isl-cache] Failed to store spec:', err);
      }
    }
  }

  /**
   * Get last-run spec for incremental diff
   */
  async getLastRun(): Promise<LastRunEntry | null> {
    try {
      const data = await readFile(this.lastRunPath, 'utf-8');
      return JSON.parse(data) as LastRunEntry;
    } catch {
      return null;
    }
  }

  /**
   * Store current run as last-run for next incremental diff
   */
  async storeLastRun(entry: LastRunEntry): Promise<void> {
    if (this.noCache) return;

    try {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(this.lastRunPath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch {
      // Non-fatal
    }
  }

  /**
   * Clear entire cache (--clear-cache)
   */
  async clearCache(): Promise<void> {
    try {
      if (existsSync(this.cacheDir)) {
        await rm(this.cacheDir, { recursive: true });
      }
    } catch (err) {
      throw new Error(`Failed to clear cache: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Get cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir;
  }

  /**
   * Get templates directory path
   */
  getTemplatesDir(): string {
    return join(this.cacheDir, 'templates');
  }

  private parseSpec(islSpec: string): unknown {
    try {
      const result = parse(islSpec, 'cached.isl');
      return result.domain ?? result;
    } catch {
      return null;
    }
  }
}
