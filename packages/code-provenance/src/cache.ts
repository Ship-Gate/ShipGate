/**
 * Commit Metadata Cache
 *
 * Caches commit metadata lookups so we only query git once per commit hash,
 * even when that commit touches hundreds of lines across many files.
 *
 * @module @isl-lang/code-provenance
 */

import type { CommitMetadata, AgentInfo } from './types.js';
import { getCommitMetadata } from './commit-parser.js';
import { classifyCommit, type ClassifierContext } from './classifier.js';

export interface CachedCommit {
  meta: CommitMetadata;
  agent: AgentInfo | null;
}

export class CommitCache {
  private cache = new Map<string, CachedCommit>();
  private ctx: ClassifierContext;

  constructor(ctx: ClassifierContext) {
    this.ctx = ctx;
  }

  /**
   * Get commit metadata and agent classification for a hash.
   * Returns from cache if available, otherwise fetches from git.
   */
  get(hash: string): CachedCommit | null {
    const cached = this.cache.get(hash);
    if (cached) return cached;

    const meta = getCommitMetadata(hash, this.ctx.cwd);
    if (!meta) return null;

    const agent = classifyCommit(meta, this.ctx);
    const entry: CachedCommit = { meta, agent };
    this.cache.set(hash, entry);
    return entry;
  }

  get size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
  }
}
