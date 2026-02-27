// ============================================================================
// ISL Standard Library - Redis Rate Limit Storage
// @stdlib/rate-limit/storage/redis
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
// REDIS STORAGE INTERFACE
// ============================================================================

/**
 * Redis client interface (compatible with ioredis)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode?: string, time?: number): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(...keys: string[]): Promise<number>;
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  multi(): RedisMulti;
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
  ping(): Promise<string>;
}

export interface RedisMulti {
  get(key: string): RedisMulti;
  set(key: string, value: string): RedisMulti;
  incr(key: string): RedisMulti;
  expire(key: string, seconds: number): RedisMulti;
  exec(): Promise<Array<[Error | null, unknown]>>;
}

// ============================================================================
// REDIS STORAGE OPTIONS
// ============================================================================

export interface RedisStorageOptions {
  client: RedisClient;
  keyPrefix?: string;
  defaultTtlSeconds?: number;
  violationTtlSeconds?: number;
  maxViolationsPerKey?: number;
}

// ============================================================================
// LUA SCRIPTS
// ============================================================================

// Atomic check-and-increment script
const CHECK_AND_INCREMENT_SCRIPT = `
local bucket_key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local increment = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

-- Get current bucket data
local data = redis.call('GET', bucket_key)
local bucket = {}

if data then
  bucket = cjson.decode(data)
  
  -- Check if window expired
  local window_end = bucket.window_start + window_ms
  if now > window_end then
    bucket.current_count = 0
    bucket.window_start = now
  end
else
  bucket = {
    current_count = 0,
    total_requests = 0,
    window_start = now,
    violation_count = 0
  }
end

-- Check if would exceed limit
local new_count = bucket.current_count + increment
local allowed = new_count <= limit

if allowed then
  bucket.current_count = new_count
  bucket.total_requests = (bucket.total_requests or 0) + increment
  bucket.updated_at = now
  
  -- Save bucket
  local ttl = math.ceil(window_ms / 1000) + 60
  redis.call('SETEX', bucket_key, ttl, cjson.encode(bucket))
else
  bucket.violation_count = (bucket.violation_count or 0) + 1
  bucket.last_violation = now
  bucket.updated_at = now
  
  local ttl = math.ceil(window_ms / 1000) + 60
  redis.call('SETEX', bucket_key, ttl, cjson.encode(bucket))
end

return cjson.encode({
  allowed = allowed,
  current_count = bucket.current_count,
  remaining = math.max(0, limit - bucket.current_count),
  violation_count = bucket.violation_count
})
`;

// ============================================================================
// REDIS STORAGE IMPLEMENTATION
// ============================================================================

export class RedisRateLimitStorage implements RateLimitStorage {
  private client: RedisClient;
  private keyPrefix: string;
  private defaultTtlSeconds: number;
  private violationTtlSeconds: number;
  private maxViolationsPerKey: number;

  constructor(options: RedisStorageOptions) {
    this.client = options.client;
    this.keyPrefix = options.keyPrefix ?? 'ratelimit:';
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 3600;
    this.violationTtlSeconds = options.violationTtlSeconds ?? 86400 * 7; // 7 days
    this.maxViolationsPerKey = options.maxViolationsPerKey ?? 1000;
  }

  // ==========================================================================
  // KEY HELPERS
  // ==========================================================================

  private bucketKey(id: BucketId): string {
    return `${this.keyPrefix}bucket:${id}`;
  }

  private blockKey(key: RateLimitKey, type: IdentifierType): string {
    return `${this.keyPrefix}block:${type}:${key}`;
  }

  private violationKey(key: RateLimitKey): string {
    return `${this.keyPrefix}violation:${key}`;
  }

  private violationIndexKey(): string {
    return `${this.keyPrefix}violations`;
  }

  // ==========================================================================
  // BUCKET OPERATIONS
  // ==========================================================================

  async getBucket(bucketId: BucketId): Promise<RateLimitBucket | null> {
    const data = await this.client.get(this.bucketKey(bucketId));
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      return this.deserializeBucket(parsed);
    } catch {
      return null;
    }
  }

  async setBucket(bucket: RateLimitBucket): Promise<void> {
    const ttl = Math.ceil(bucket.windowSizeMs / 1000) + 60;
    await this.client.setex(
      this.bucketKey(bucket.id),
      ttl,
      JSON.stringify(this.serializeBucket(bucket))
    );
  }

  async incrementBucket(bucketId: BucketId, amount: number): Promise<RateLimitBucket> {
    // Get bucket first
    const bucket = await this.getBucket(bucketId);
    if (!bucket) {
      throw new Error(`Bucket not found: ${bucketId}`);
    }

    // Check if window expired
    const now = Date.now();
    const windowEnd = bucket.windowStart.getTime() + bucket.windowSizeMs;

    if (now > windowEnd) {
      bucket.currentCount = amount;
      bucket.windowStart = new Date();
    } else {
      bucket.currentCount += amount;
    }

    bucket.totalRequests += amount;
    bucket.updatedAt = new Date();

    if (bucket.currentCount > bucket.limit) {
      bucket.violationCount += 1;
      bucket.lastViolation = new Date();
    }

    await this.setBucket(bucket);
    return bucket;
  }

  async deleteBucket(bucketId: BucketId): Promise<boolean> {
    const result = await this.client.del(this.bucketKey(bucketId));
    return result > 0;
  }

  // ==========================================================================
  // BLOCK OPERATIONS
  // ==========================================================================

  async getBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<RateLimitBlock | null> {
    const data = await this.client.get(this.blockKey(key, identifierType));
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      const block = this.deserializeBlock(parsed);
      
      // Check if expired
      if (block.blockedUntil <= new Date()) {
        if (block.autoUnblock) {
          await this.removeBlock(key, identifierType);
          return null;
        }
      }
      
      return block;
    } catch {
      return null;
    }
  }

  async setBlock(block: RateLimitBlock): Promise<void> {
    const ttl = Math.ceil((block.blockedUntil.getTime() - Date.now()) / 1000) + 60;
    await this.client.setex(
      this.blockKey(block.key, block.identifierType),
      Math.max(ttl, 60),
      JSON.stringify(this.serializeBlock(block))
    );
  }

  async removeBlock(key: RateLimitKey, identifierType: IdentifierType): Promise<boolean> {
    const result = await this.client.del(this.blockKey(key, identifierType));
    return result > 0;
  }

  async listBlocks(options?: {
    identifierType?: IdentifierType;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ blocks: RateLimitBlock[]; total: number }> {
    const pattern = options?.identifierType
      ? `${this.keyPrefix}block:${options.identifierType}:*`
      : `${this.keyPrefix}block:*`;

    const keys = await this.client.keys(pattern);
    const blocks: RateLimitBlock[] = [];
    const now = new Date();

    for (const key of keys) {
      const data = await this.client.get(key);
      if (!data) continue;

      try {
        const block = this.deserializeBlock(JSON.parse(data));
        
        if (!options?.includeExpired && block.blockedUntil <= now) {
          continue;
        }
        
        blocks.push(block);
      } catch {
        // Skip invalid entries
      }
    }

    const total = blocks.length;
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;

    return {
      blocks: blocks.slice(offset, offset + limit),
      total,
    };
  }

  // ==========================================================================
  // VIOLATION OPERATIONS
  // ==========================================================================

  async recordViolation(violation: Violation): Promise<void> {
    const key = this.violationKey(violation.key);
    
    // Store as JSON in a list
    const data = JSON.stringify(this.serializeViolation(violation));
    
    // Use multi for atomic operation
    const multi = this.client.multi();
    // @ts-expect-error Redis multi commands
    multi.lpush(key, data);
    // @ts-expect-error Redis multi commands
    multi.ltrim(key, 0, this.maxViolationsPerKey - 1);
    multi.expire(key, this.violationTtlSeconds);
    await multi.exec();
  }

  async getViolations(options?: {
    key?: RateLimitKey;
    identifierType?: IdentifierType;
    configName?: string;
    since?: Date;
    limit?: number;
  }): Promise<{ violations: Violation[]; total: number }> {
    const violations: Violation[] = [];
    let keys: string[];

    if (options?.key) {
      keys = [this.violationKey(options.key)];
    } else {
      keys = await this.client.keys(`${this.keyPrefix}violation:*`);
    }

    for (const key of keys) {
      // @ts-expect-error Redis lrange command
      const items: string[] = await this.client.lrange(key, 0, -1);
      
      for (const item of items) {
        try {
          const violation = this.deserializeViolation(JSON.parse(item));
          
          // Apply filters
          if (options?.identifierType && violation.identifierType !== options.identifierType) {
            continue;
          }
          if (options?.configName && violation.configName !== options.configName) {
            continue;
          }
          if (options?.since && violation.timestamp < options.since) {
            continue;
          }
          
          violations.push(violation);
        } catch {
          // Skip invalid entries
        }
      }
    }

    // Sort by timestamp descending
    violations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = violations.length;
    const limited = options?.limit ? violations.slice(0, options.limit) : violations;

    return { violations: limited, total };
  }

  // ==========================================================================
  // HEALTH & CLEANUP
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async cleanup(olderThanMs: number): Promise<number> {
    // Redis handles TTL automatically
    // This method can be used for explicit cleanup if needed
    return 0;
  }

  // ==========================================================================
  // SERIALIZATION HELPERS
  // ==========================================================================

  private serializeBucket(bucket: RateLimitBucket): Record<string, unknown> {
    return {
      ...bucket,
      windowStart: bucket.windowStart.getTime(),
      blockedUntil: bucket.blockedUntil?.getTime(),
      lastViolation: bucket.lastViolation?.getTime(),
      createdAt: bucket.createdAt.getTime(),
      updatedAt: bucket.updatedAt.getTime(),
    };
  }

  private deserializeBucket(data: Record<string, unknown>): RateLimitBucket {
    return {
      ...data,
      windowStart: new Date(data.windowStart as number),
      blockedUntil: data.blockedUntil ? new Date(data.blockedUntil as number) : undefined,
      lastViolation: data.lastViolation ? new Date(data.lastViolation as number) : undefined,
      createdAt: new Date(data.createdAt as number),
      updatedAt: new Date(data.updatedAt as number),
    } as RateLimitBucket;
  }

  private serializeBlock(block: RateLimitBlock): Record<string, unknown> {
    return {
      ...block,
      blockedAt: block.blockedAt.getTime(),
      blockedUntil: block.blockedUntil.getTime(),
    };
  }

  private deserializeBlock(data: Record<string, unknown>): RateLimitBlock {
    return {
      ...data,
      blockedAt: new Date(data.blockedAt as number),
      blockedUntil: new Date(data.blockedUntil as number),
    } as RateLimitBlock;
  }

  private serializeViolation(violation: Violation): Record<string, unknown> {
    return {
      ...violation,
      timestamp: violation.timestamp.getTime(),
    };
  }

  private deserializeViolation(data: Record<string, unknown>): Violation {
    return {
      ...data,
      timestamp: new Date(data.timestamp as number),
    } as Violation;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createRedisStorage(options: RedisStorageOptions): RedisRateLimitStorage {
  return new RedisRateLimitStorage(options);
}
