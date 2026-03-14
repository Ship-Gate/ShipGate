/**
 * Verification result cache backed by JSON files.
 *
 * Each verified file's result is stored as a JSON file keyed by its content
 * hash, allowing instant cache lookups on subsequent runs when a file hasn't
 * changed.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface CachedResult {
  /** The verification verdict for this file */
  verdict: 'PROVEN' | 'INCOMPLETE_PROOF' | 'FAILED';
  /** Findings/clause results for this file */
  findings: CachedFinding[];
  /** When this result was cached (ISO 8601) */
  timestamp: string;
  /** Hash of the spec that was used during verification */
  specHash: string;
  /** Score at time of caching */
  score: number;
}

export interface CachedFinding {
  clauseId: string;
  status: 'proven' | 'violated' | 'not_proven' | 'skipped';
  expression?: string;
  message?: string;
}

const CACHE_VERSION = 1;

interface CacheEnvelope {
  version: number;
  fileHash: string;
  result: CachedResult;
}

export class VerificationCache {
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? path.join('.shipgate', 'cache', 'incremental');
  }

  /**
   * Look up a cached verification result by file content hash.
   * Returns null on miss or if the cache entry is corrupt/stale.
   */
  async get(fileHash: string): Promise<CachedResult | null> {
    const filePath = this.entryPath(fileHash);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const envelope: CacheEnvelope = JSON.parse(raw);

      if (envelope.version !== CACHE_VERSION) return null;
      if (envelope.fileHash !== fileHash) return null;

      return envelope.result;
    } catch {
      return null;
    }
  }

  /**
   * Store a verification result in the cache.
   */
  async set(fileHash: string, result: CachedResult): Promise<void> {
    const filePath = this.entryPath(fileHash);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const envelope: CacheEnvelope = {
      version: CACHE_VERSION,
      fileHash,
      result,
    };

    await fs.writeFile(filePath, JSON.stringify(envelope, null, 2), 'utf-8');
  }

  /**
   * Remove a cached entry by hash.
   */
  async invalidate(fileHash: string): Promise<void> {
    const filePath = this.entryPath(fileHash);
    try {
      await fs.unlink(filePath);
    } catch {
      // Entry may not exist — that's fine
    }
  }

  /**
   * Remove all cached entries.
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  }

  /**
   * Return the number of cached entries.
   */
  async size(): Promise<number> {
    try {
      const entries = await fs.readdir(this.cacheDir);
      return entries.filter((e: string) => e.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  private entryPath(hash: string): string {
    // Shard into subdirectories by first 2 hex chars to avoid huge flat dirs
    const shard = hash.slice(0, 2);
    return path.join(this.cacheDir, shard, `${hash}.json`);
  }
}
