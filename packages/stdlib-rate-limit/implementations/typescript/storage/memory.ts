// ============================================================================
// ISL Standard Library - In-Memory Rate Limit Storage
// @stdlib/rate-limit/storage/memory
// Version: 1.0.0
// ============================================================================

import {
  type RateLimitStorage,
  type RateLimitBucket,
  type RateLimitBlock,
  type Violation,
  type BucketId,
  type RateLimitKey,
  type IdentifierType,
} from '../types';

// ============================================================================
// IN-MEMORY STORAGE
// ============================================================================

/**
 * In-memory storage implementation for rate limiting.
 * 
 * Suitable for:
 * - Single-server deployments
 * - Development and testing
 * - Low-traffic applications
 * 
 * NOT suitable for:
 * - Distributed systems (no shared state)
 * - High-availability requirements (state lost on restart)
 */
export class MemoryRateLimitStorage implements RateLimitStorage {
  private buckets = new Map<BucketId, RateLimitBucket>();
  private blocks = new Map<string, RateLimitBlock>();
  private violations: Violation[] = [];
  
  // Optional: Maximum entries to prevent memory leaks
  private maxBuckets: number;
  private maxViolations: number;

  constructor(options?: { maxBuckets?: number; maxViolations?: number }) {
    this.maxBuckets = options?.maxBuckets ?? 100000;
    this.maxViolations = options?.maxViolations ?? 10000;
  }

  // ==========================================================================
  // BUCKET OPERATIONS
  // ==========================================================================

  async getBucket(bucketId: BucketId): Promise<RateLimitBucket | null> {
    return this.buckets.get(bucketId) ?? null;
  }

  async setBucket(bucket: RateLimitBucket): Promise<void> {
    // Enforce max buckets
    if (this.buckets.size >= this.maxBuckets && !this.buckets.has(bucket.id)) {
      // Remove oldest bucket
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey) {
        this.buckets.delete(oldestKey);
      }
    }
    
    this.buckets.set(bucket.id, { ...bucket });
  }

  async incrementBucket(bucketId: BucketId, amount: number): Promise<RateLimitBucket> {
    const bucket = this.buckets.get(bucketId);
    
    if (!bucket) {
      throw new Error(`Bucket not found: ${bucketId}`);
    }

    // Check if window has expired
    const now = Date.now();
    const windowEnd = bucket.windowStart.getTime() + bucket.windowSizeMs;
    
    if (now > windowEnd) {
      // Reset window
      bucket.currentCount = amount;
      bucket.windowStart = new Date();
    } else {
      bucket.currentCount += amount;
    }
    
    bucket.totalRequests += amount;
    bucket.updatedAt = new Date();

    // Check for violation
    if (bucket.currentCount > bucket.limit) {
      bucket.violationCount += 1;
      bucket.lastViolation = new Date();
    }

    this.buckets.set(bucketId, bucket);
    return { ...bucket };
  }

  async deleteBucket(bucketId: BucketId): Promise<boolean> {
    return this.buckets.delete(bucketId);
  }

  // ==========================================================================
  // BLOCK OPERATIONS
  // ==========================================================================

  private blockKey(key: RateLimitKey, identifierType: IdentifierType): string {
    return `${identifierType}:${key}`;
  }

  async getBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<RateLimitBlock | null> {
    const block = this.blocks.get(this.blockKey(key, identifierType));
    
    // Check if block has expired
    if (block && block.blockedUntil <= new Date()) {
      if (block.autoUnblock) {
        this.blocks.delete(this.blockKey(key, identifierType));
        return null;
      }
    }
    
    return block ?? null;
  }

  async setBlock(block: RateLimitBlock): Promise<void> {
    this.blocks.set(this.blockKey(block.key, block.identifierType), { ...block });
  }

  async removeBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<boolean> {
    return this.blocks.delete(this.blockKey(key, identifierType));
  }

  async listBlocks(options?: {
    identifierType?: IdentifierType;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ blocks: RateLimitBlock[]; total: number }> {
    const now = new Date();
    let blocks = Array.from(this.blocks.values());
    
    // Filter by identifier type
    if (options?.identifierType) {
      blocks = blocks.filter(b => b.identifierType === options.identifierType);
    }
    
    // Filter expired
    if (!options?.includeExpired) {
      blocks = blocks.filter(b => b.blockedUntil > now);
    }
    
    const total = blocks.length;
    
    // Pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    blocks = blocks.slice(offset, offset + limit);
    
    return { blocks, total };
  }

  // ==========================================================================
  // VIOLATION OPERATIONS
  // ==========================================================================

  async recordViolation(violation: Violation): Promise<void> {
    // Enforce max violations
    if (this.violations.length >= this.maxViolations) {
      this.violations.shift(); // Remove oldest
    }
    
    this.violations.push({ ...violation });
  }

  async getViolations(options?: {
    key?: RateLimitKey;
    identifierType?: IdentifierType;
    configName?: string;
    since?: Date;
    limit?: number;
  }): Promise<{ violations: Violation[]; total: number }> {
    let violations = [...this.violations];
    
    // Filter by key
    if (options?.key) {
      violations = violations.filter(v => v.key === options.key);
    }
    
    // Filter by identifier type
    if (options?.identifierType) {
      violations = violations.filter(v => v.identifierType === options.identifierType);
    }
    
    // Filter by config name
    if (options?.configName) {
      violations = violations.filter(v => v.configName === options.configName);
    }
    
    // Filter by time
    if (options?.since) {
      const since = options.since;
      violations = violations.filter(v => v.timestamp >= since);
    }
    
    const total = violations.length;
    
    // Sort by timestamp descending
    violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Limit
    if (options?.limit) {
      violations = violations.slice(0, options.limit);
    }
    
    return { violations, total };
  }

  // ==========================================================================
  // HEALTH & CLEANUP
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async cleanup(olderThanMs: number): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    // Cleanup expired buckets
    for (const [id, bucket] of this.buckets) {
      const age = now - bucket.updatedAt.getTime();
      if (age > olderThanMs) {
        this.buckets.delete(id);
        cleaned++;
      }
    }
    
    // Cleanup expired blocks
    for (const [key, block] of this.blocks) {
      if (block.blockedUntil <= new Date()) {
        this.blocks.delete(key);
        cleaned++;
      }
    }
    
    // Cleanup old violations
    const cutoff = new Date(now - olderThanMs);
    const oldLength = this.violations.length;
    this.violations = this.violations.filter(v => v.timestamp >= cutoff);
    cleaned += oldLength - this.violations.length;
    
    return cleaned;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.buckets.clear();
    this.blocks.clear();
    this.violations = [];
  }

  /**
   * Get storage stats
   */
  getStats(): { buckets: number; blocks: number; violations: number } {
    return {
      buckets: this.buckets.size,
      blocks: this.blocks.size,
      violations: this.violations.length,
    };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createMemoryStorage(options?: {
  maxBuckets?: number;
  maxViolations?: number;
}): MemoryRateLimitStorage {
  return new MemoryRateLimitStorage(options);
}
