/**
 * In-memory storage implementation for rate limiting
 * 
 * This implementation stores all data in memory and provides automatic
 * cleanup of expired entries. It's suitable for single-instance applications
 * or for testing purposes.
 */

import { 
  RateLimitBucket, 
  RateLimitBlock, 
  Violation, 
  BucketId, 
  RateLimitKey, 
  IdentifierType 
} from '../types';
import { 
  StorageProvider, 
  MemoryStoreConfig, 
  BatchOperation, 
  BatchResult, 
  Transaction, 
  TransactionOptions,
  HealthCheckResult
} from './types';
import { BaseStorageProvider, StorageUtilsImpl } from './store';
import { StorageError } from '../errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory storage provider
 */
export class MemoryStore extends BaseStorageProvider {
  private buckets = new Map<BucketId, RateLimitBucket>();
  private blocks = new Map<string, RateLimitBlock>();
  private violations = new Map<string, Violation>();
  private cleanupInterval?: NodeJS.Timeout;
  private utils: StorageUtilsImpl;
  
  constructor(config: MemoryStoreConfig = {}) {
    super(config);
    this.utils = new StorageUtilsImpl();
  }
  
  async initialize(config: MemoryStoreConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    this.config = { ...this.config, ...config };
    this.metrics.connectionStatus = 'connected';
    this.metrics.activeConnections = 1;
    
    // Start cleanup interval
    const cleanupIntervalMs = this.config.cleanupIntervalMs || 60000; // 1 minute
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, cleanupIntervalMs);
    
    this.isInitialized = true;
    this.events.connect?.();
    
    if (this.config.debug) {
      console.debug('[MemoryStore] Initialized');
    }
  }
  
  async close(): Promise<void> {
    if (this.isClosed) {
      return;
    }
    
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    // Clear all data
    this.buckets.clear();
    this.blocks.clear();
    this.violations.clear();
    
    this.metrics.connectionStatus = 'disconnected';
    this.metrics.activeConnections = 0;
    this.isClosed = true;
    
    this.events.disconnect?.();
    
    if (this.config.debug) {
      console.debug('[MemoryStore] Closed');
    }
  }
  
  async getBucket(bucketId: BucketId): Promise<RateLimitBucket | null> {
    return this.executeWithRetry(async () => {
      const bucket = this.buckets.get(bucketId);
      
      if (!bucket) {
        return null;
      }
      
      // Check if bucket has expired
      if (this.isBucketExpired(bucket)) {
        this.buckets.delete(bucketId);
        return null;
      }
      
      return { ...bucket };
    }, 'getBucket');
  }
  
  async setBucket(bucket: RateLimitBucket): Promise<void> {
    return this.executeWithRetry(async () => {
      // Check memory limits
      if (this.config.maxBuckets && this.buckets.size >= this.config.maxBuckets) {
        // Remove oldest bucket
        const oldestKey = this.findOldestBucket();
        if (oldestKey) {
          this.buckets.delete(oldestKey);
        }
      }
      
      const bucketToStore = {
        ...bucket,
        updatedAt: new Date(),
      };
      
      this.buckets.set(bucket.id, bucketToStore);
    }, 'setBucket');
  }
  
  async incrementBucket(bucketId: BucketId, amount: number): Promise<RateLimitBucket> {
    return this.executeWithRetry(async () => {
      let bucket = this.buckets.get(bucketId);
      
      if (!bucket) {
        throw new StorageError(`Bucket not found: ${bucketId}`, 'incrementBucket');
      }
      
      // Check if bucket has expired
      if (this.isBucketExpired(bucket)) {
        // Reset expired bucket
        bucket = {
          ...bucket,
          currentCount: amount,
          totalRequests: bucket.totalRequests + amount,
          windowStart: new Date(),
          updatedAt: new Date(),
        };
      } else {
        // Increment existing bucket
        bucket = {
          ...bucket,
          currentCount: bucket.currentCount + amount,
          totalRequests: bucket.totalRequests + amount,
          updatedAt: new Date(),
        };
      }
      
      this.buckets.set(bucketId, bucket);
      return { ...bucket };
    }, 'incrementBucket');
  }
  
  async deleteBucket(bucketId: BucketId): Promise<boolean> {
    return this.executeWithRetry(async () => {
      const deleted = this.buckets.delete(bucketId);
      return deleted;
    }, 'deleteBucket');
  }
  
  async getBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<RateLimitBlock | null> {
    return this.executeWithRetry(async () => {
      const blockKey = this.utils.generateBlockKey(key, identifierType);
      const block = this.blocks.get(blockKey);
      
      if (!block) {
        return null;
      }
      
      // Check if block has expired
      if (block.blockedUntil < new Date()) {
        this.blocks.delete(blockKey);
        return null;
      }
      
      return { ...block };
    }, 'getBlock');
  }
  
  async setBlock(block: RateLimitBlock): Promise<void> {
    return this.executeWithRetry(async () => {
      // Check memory limits
      if (this.config.maxBlocks && this.blocks.size >= this.config.maxBlocks) {
        // Remove expired blocks first
        this.removeExpiredBlocks();
        
        // Still at limit? Remove oldest
        if (this.blocks.size >= this.config.maxBlocks) {
          const oldestKey = this.findOldestBlock();
          if (oldestKey) {
            this.blocks.delete(oldestKey);
          }
        }
      }
      
      const blockKey = this.utils.generateBlockKey(block.key, block.identifierType);
      this.blocks.set(blockKey, { ...block });
    }, 'setBlock');
  }
  
  async removeBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<boolean> {
    return this.executeWithRetry(async () => {
      const blockKey = this.utils.generateBlockKey(key, identifierType);
      const deleted = this.blocks.delete(blockKey);
      return deleted;
    }, 'removeBlock');
  }
  
  async listBlocks(options: {
    identifierType?: IdentifierType;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ blocks: RateLimitBlock[]; total: number }> {
    return this.executeWithRetry(async () => {
      let blocks = Array.from(this.blocks.values());
      
      // Filter by identifier type
      if (options.identifierType) {
        blocks = blocks.filter(b => b.identifierType === options.identifierType);
      }
      
      // Filter expired blocks
      if (!options.includeExpired) {
        blocks = blocks.filter(b => b.blockedUntil >= new Date());
      }
      
      // Sort by blocked time (newest first)
      blocks.sort((a, b) => b.blockedAt.getTime() - a.blockedAt.getTime());
      
      const total = blocks.length;
      
      // Apply pagination
      if (options.offset) {
        blocks = blocks.slice(options.offset);
      }
      
      if (options.limit) {
        blocks = blocks.slice(0, options.limit);
      }
      
      return { blocks, total };
    }, 'listBlocks');
  }
  
  async recordViolation(violation: Violation): Promise<void> {
    return this.executeWithRetry(async () => {
      // Check memory limits
      if (this.config.maxViolations && this.violations.size >= this.config.maxViolations) {
        // Remove oldest violations
        this.removeOldestViolations(Math.floor(this.config.maxViolations * 0.1));
      }
      
      const violationKey = this.utils.generateViolationKey(violation.id);
      this.violations.set(violationKey, { ...violation });
    }, 'recordViolation');
  }
  
  async getViolations(options: {
    key?: RateLimitKey;
    identifierType?: IdentifierType;
    configName?: string;
    since?: Date;
    limit?: number;
  } = {}): Promise<{ violations: Violation[]; total: number }> {
    return this.executeWithRetry(async () => {
      let violations = Array.from(this.violations.values());
      
      // Apply filters
      if (options.key) {
        violations = violations.filter(v => v.key === options.key);
      }
      
      if (options.identifierType) {
        violations = violations.filter(v => v.identifierType === options.identifierType);
      }
      
      if (options.configName) {
        violations = violations.filter(v => v.configName === options.configName);
      }
      
      if (options.since) {
        violations = violations.filter(v => v.timestamp >= options.since);
      }
      
      // Sort by timestamp (newest first)
      violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      const total = violations.length;
      
      // Apply limit
      if (options.limit) {
        violations = violations.slice(0, options.limit);
      }
      
      return { violations, total };
    }, 'getViolations');
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      // Check if store is initialized and not closed
      if (!this.isInitialized || this.isClosed) {
        return false;
      }
      
      // Perform a simple operation
      const testKey = 'health-check';
      const testBucket: RateLimitBucket = {
        id: testKey,
        key: testKey,
        identifierType: 'IP' as IdentifierType,
        configName: 'health-check',
        currentCount: 0,
        totalRequests: 0,
        windowStart: new Date(),
        windowSizeMs: 60000,
        limit: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await this.setBucket(testBucket);
      const retrieved = await this.getBucket(testKey);
      await this.deleteBucket(testKey);
      
      return retrieved !== null;
    } catch (error) {
      this.events.error?.(error as Error, 'healthCheck');
      return false;
    }
  }
  
  async cleanup(olderThanMs: number): Promise<number> {
    return this.executeWithRetry(async () => {
      const cutoff = new Date(Date.now() - olderThanMs);
      let deletedCount = 0;
      
      // Clean up expired buckets
      for (const [key, bucket] of this.buckets.entries()) {
        if (bucket.updatedAt < cutoff || this.isBucketExpired(bucket)) {
          this.buckets.delete(key);
          deletedCount++;
        }
      }
      
      // Clean up expired blocks
      for (const [key, block] of this.blocks.entries()) {
        if (block.blockedUntil < new Date() || block.blockedAt < cutoff) {
          this.blocks.delete(key);
          deletedCount++;
        }
      }
      
      // Clean up old violations
      for (const [key, violation] of this.violations.entries()) {
        if (violation.timestamp < cutoff) {
          this.violations.delete(key);
          deletedCount++;
        }
      }
      
      this.events.cleanup?.(deletedCount);
      
      if (this.config.debug) {
        console.debug(`[MemoryStore] Cleanup removed ${deletedCount} entries`);
      }
      
      return deletedCount;
    }, 'cleanup');
  }
  
  // ============================================================================
  // PROTECTED METHODS
  // ============================================================================
  
  protected async performGet(key: string): Promise<any> {
    // Try to get as bucket first
    const bucket = this.buckets.get(key);
    if (bucket) {
      return bucket;
    }
    
    // Try to get as block
    const block = this.blocks.get(key);
    if (block) {
      return block;
    }
    
    // Try to get as violation
    const violation = this.violations.get(key);
    if (violation) {
      return violation;
    }
    
    return null;
  }
  
  protected async performSet(key: string, value: any): Promise<void> {
    // Determine type based on value structure
    if (this.isBucket(value)) {
      this.buckets.set(key, value);
    } else if (this.isBlock(value)) {
      this.blocks.set(key, value);
    } else if (this.isViolation(value)) {
      this.violations.set(key, value);
    } else {
      throw new StorageError(`Unknown value type for key: ${key}`);
    }
  }
  
  protected async performDelete(key: string): Promise<void> {
    this.buckets.delete(key);
    this.blocks.delete(key);
    this.violations.delete(key);
  }
  
  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================
  
  private isBucketExpired(bucket: RateLimitBucket): boolean {
    const now = new Date();
    const windowEnd = new Date(bucket.windowStart.getTime() + bucket.windowSizeMs);
    return now > windowEnd;
  }
  
  private findOldestBucket(): BucketId | null {
    let oldestKey: BucketId | null = null;
    let oldestTime = Date.now();
    
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.updatedAt.getTime() < oldestTime) {
        oldestTime = bucket.updatedAt.getTime();
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
  
  private findOldestBlock(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, block] of this.blocks.entries()) {
      if (block.blockedAt.getTime() < oldestTime) {
        oldestTime = block.blockedAt.getTime();
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }
  
  private removeExpiredBlocks(): void {
    const now = new Date();
    for (const [key, block] of this.blocks.entries()) {
      if (block.blockedUntil < now) {
        this.blocks.delete(key);
      }
    }
  }
  
  private removeOldestViolations(count: number): void {
    const violations = Array.from(this.violations.entries())
      .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
    
    for (let i = 0; i < Math.min(count, violations.length); i++) {
      this.violations.delete(violations[i][0]);
    }
  }
  
  private performCleanup(): void {
    // Clean up entries older than 1 hour by default
    this.cleanup(3600000).catch(error => {
      this.events.error?.(error, 'cleanup');
    });
  }
  
  private isBucket(value: any): value is RateLimitBucket {
    return value && typeof value === 'object' && 'id' in value && 'currentCount' in value;
  }
  
  private isBlock(value: any): value is RateLimitBlock {
    return value && typeof value === 'object' && 'key' in value && 'blockedUntil' in value;
  }
  
  private isViolation(value: any): value is Violation {
    return value && typeof value === 'object' && 'id' in value && 'actionTaken' in value;
  }
}

/**
 * Create a memory store instance
 */
export function createMemoryStore(config?: MemoryStoreConfig): MemoryStore {
  return new MemoryStore(config);
}
