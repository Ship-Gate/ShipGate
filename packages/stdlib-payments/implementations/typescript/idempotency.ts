// ============================================================================
// Idempotency Manager - Ensure At-Most-Once Processing
// ============================================================================

import { IdempotencyKey, PaymentId, IdempotencyRecord } from './types';

// ==========================================================================
// IDEMPOTENCY MANAGER INTERFACE
// ==========================================================================

export interface IdempotencyManager {
  get(key: IdempotencyKey): Promise<IdempotencyRecord | null>;
  
  set(
    key: IdempotencyKey,
    data: {
      requestHash: string;
      paymentId?: PaymentId;
      response: string;
    }
  ): Promise<void>;
  
  acquireLock(key: IdempotencyKey, ttlMs: number): Promise<boolean>;
  
  releaseLock(key: IdempotencyKey): Promise<void>;
}

// ==========================================================================
// IN-MEMORY IMPLEMENTATION (for testing)
// ==========================================================================

export class InMemoryIdempotencyManager implements IdempotencyManager {
  private readonly records = new Map<string, IdempotencyRecord>();
  private readonly locks = new Map<string, { expiresAt: number }>();
  private readonly expiryMs: number;
  
  constructor(expiryMs = 24 * 60 * 60 * 1000) { // 24 hours default
    this.expiryMs = expiryMs;
  }
  
  async get(key: IdempotencyKey): Promise<IdempotencyRecord | null> {
    const record = this.records.get(key);
    
    if (!record) {
      return null;
    }
    
    // Check expiry
    if (record.expiresAt < new Date()) {
      this.records.delete(key);
      return null;
    }
    
    return record;
  }
  
  async set(
    key: IdempotencyKey,
    data: {
      requestHash: string;
      paymentId?: PaymentId;
      response: string;
    }
  ): Promise<void> {
    const now = new Date();
    
    const record: IdempotencyRecord = {
      key,
      requestHash: data.requestHash,
      response: data.response,
      paymentId: data.paymentId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.expiryMs),
    };
    
    this.records.set(key, record);
  }
  
  async acquireLock(key: IdempotencyKey, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(key);
    
    if (existing && existing.expiresAt > now) {
      return false;
    }
    
    this.locks.set(key, { expiresAt: now + ttlMs });
    return true;
  }
  
  async releaseLock(key: IdempotencyKey): Promise<void> {
    this.locks.delete(key);
  }
  
  // Cleanup expired records
  cleanup(): void {
    const now = new Date();
    
    for (const [key, record] of this.records) {
      if (record.expiresAt < now) {
        this.records.delete(key);
      }
    }
    
    const nowMs = Date.now();
    for (const [key, lock] of this.locks) {
      if (lock.expiresAt < nowMs) {
        this.locks.delete(key);
      }
    }
  }
}

// ==========================================================================
// REDIS IMPLEMENTATION
// ==========================================================================

export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<string | null>;
  del(key: string): Promise<number>;
}

export class RedisIdempotencyManager implements IdempotencyManager {
  private readonly redis: RedisClient;
  private readonly prefix: string;
  private readonly expirySeconds: number;
  
  constructor(
    redis: RedisClient,
    options?: {
      prefix?: string;
      expirySeconds?: number;
    }
  ) {
    this.redis = redis;
    this.prefix = options?.prefix ?? 'idem:';
    this.expirySeconds = options?.expirySeconds ?? 86400; // 24 hours
  }
  
  async get(key: IdempotencyKey): Promise<IdempotencyRecord | null> {
    const data = await this.redis.get(this.prefix + key);
    
    if (!data) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(data);
      return {
        key,
        requestHash: parsed.requestHash,
        response: parsed.response,
        paymentId: parsed.paymentId,
        createdAt: new Date(parsed.createdAt),
        expiresAt: new Date(parsed.expiresAt),
      };
    } catch {
      return null;
    }
  }
  
  async set(
    key: IdempotencyKey,
    data: {
      requestHash: string;
      paymentId?: PaymentId;
      response: string;
    }
  ): Promise<void> {
    const now = new Date();
    
    const record = {
      requestHash: data.requestHash,
      response: data.response,
      paymentId: data.paymentId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.expirySeconds * 1000).toISOString(),
    };
    
    await this.redis.set(
      this.prefix + key,
      JSON.stringify(record),
      { EX: this.expirySeconds }
    );
  }
  
  async acquireLock(key: IdempotencyKey, ttlMs: number): Promise<boolean> {
    const lockKey = this.prefix + 'lock:' + key;
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    
    const result = await this.redis.set(
      lockKey,
      Date.now().toString(),
      { EX: ttlSeconds, NX: true }
    );
    
    return result === 'OK';
  }
  
  async releaseLock(key: IdempotencyKey): Promise<void> {
    const lockKey = this.prefix + 'lock:' + key;
    await this.redis.del(lockKey);
  }
}

// ==========================================================================
// IDEMPOTENCY DECORATOR
// ==========================================================================

export function withIdempotency<TInput extends { idempotencyKey: IdempotencyKey }, TOutput>(
  manager: IdempotencyManager,
  hashFn: (input: TInput) => string,
  lockTtlMs = 10000
) {
  return function decorator(
    target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(input: TInput) => Promise<TOutput>>
  ) {
    const originalMethod = descriptor.value!;
    
    descriptor.value = async function(input: TInput): Promise<TOutput> {
      const { idempotencyKey } = input;
      
      // Check for existing record
      const existing = await manager.get(idempotencyKey);
      if (existing) {
        const requestHash = hashFn(input);
        if (existing.requestHash === requestHash) {
          return JSON.parse(existing.response) as TOutput;
        }
        throw new Error('Idempotency key already used with different parameters');
      }
      
      // Try to acquire lock
      const lockAcquired = await manager.acquireLock(idempotencyKey, lockTtlMs);
      if (!lockAcquired) {
        throw new Error('Concurrent request with same idempotency key');
      }
      
      try {
        // Execute the method
        const result = await originalMethod.call(this, input);
        
        // Store the result
        await manager.set(idempotencyKey, {
          requestHash: hashFn(input),
          response: JSON.stringify(result),
        });
        
        return result;
      } finally {
        await manager.releaseLock(idempotencyKey);
      }
    };
    
    return descriptor;
  };
}
