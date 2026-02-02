// ============================================================================
// ISL Standard Library - Redis Idempotency Store
// @stdlib/idempotency/store/redis
// ============================================================================

import {
  IdempotencyStore,
  IdempotencyRecord,
  IdempotencyKey,
  RequestHash,
  LockToken,
  RecordStatus,
  IdempotencyErrorCode,
  IdempotencyException,
  CheckInput,
  CheckResult,
  StartProcessingInput,
  LockResult,
  RecordInput,
  ReleaseLockInput,
  ReleaseResult,
  ExtendLockInput,
  ExtendResult,
  CleanupInput,
  CleanupResult,
  IdempotencyConfig,
  DEFAULT_CONFIG,
} from '../types';
import {
  validateKey,
  generateLockToken,
  validateResponseSize,
} from '../utils';

// Redis client types (compatible with ioredis and @redis/client)
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { PX?: number; NX?: boolean }): Promise<string | null>;
  setex?(key: string, seconds: number, value: string): Promise<string>;
  del(key: string | string[]): Promise<number>;
  exists(key: string | string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  scan(cursor: number | string, options?: { MATCH?: string; COUNT?: number }): Promise<[string, string[]]>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
  evalsha?(sha: string, keys: string[], args: string[]): Promise<unknown>;
  scriptLoad?(script: string): Promise<string>;
  ping(): Promise<string>;
  quit(): Promise<string>;
}

export interface RedisStoreOptions extends IdempotencyConfig {
  /** Redis client instance */
  client: RedisClient;
  
  /** Key prefix for namespacing (default: 'idempotency') */
  keyPrefix?: string;
  
  /** Script caching for performance */
  cacheScripts?: boolean;
}

// Lua scripts for atomic operations
const SCRIPTS = {
  // Atomic check and start processing
  startProcessing: `
    local key = KEYS[1]
    local requestHash = ARGV[1]
    local lockToken = ARGV[2]
    local lockTimeoutMs = tonumber(ARGV[3])
    local ttlMs = tonumber(ARGV[4])
    local metadata = ARGV[5]
    local now = tonumber(ARGV[6])
    
    -- Check if record exists
    local existing = redis.call('GET', key)
    
    if existing then
      local record = cjson.decode(existing)
      
      -- Check for request mismatch
      if record.requestHash ~= requestHash then
        return cjson.encode({
          acquired = false,
          existingStatus = record.status,
          requestMismatch = true
        })
      end
      
      -- If completed, return cached response
      if record.status == 'COMPLETED' then
        return cjson.encode({
          acquired = false,
          existingStatus = record.status,
          existingResponse = record.response,
          existingHttpStatusCode = record.httpStatusCode
        })
      end
      
      -- If processing, check lock expiration
      if record.status == 'PROCESSING' then
        if record.lockExpiresAt and record.lockExpiresAt > now then
          return cjson.encode({
            acquired = false,
            existingStatus = record.status
          })
        end
        -- Lock expired, allow takeover
      end
      
      -- If failed, allow retry (fall through)
    end
    
    -- Create new record
    local lockExpiresAt = now + lockTimeoutMs
    local expiresAt = now + ttlMs
    
    local meta = cjson.decode(metadata)
    local record = {
      key = meta.key,
      requestHash = requestHash,
      status = 'PROCESSING',
      createdAt = now,
      updatedAt = now,
      expiresAt = expiresAt,
      endpoint = meta.endpoint,
      method = meta.method,
      clientId = meta.clientId,
      lockToken = lockToken,
      lockExpiresAt = lockExpiresAt
    }
    
    redis.call('SET', key, cjson.encode(record), 'PX', ttlMs)
    
    return cjson.encode({
      acquired = true,
      lockToken = lockToken,
      lockExpiresAt = lockExpiresAt
    })
  `,

  // Atomic record with lock verification
  record: `
    local key = KEYS[1]
    local response = ARGV[1]
    local httpStatusCode = tonumber(ARGV[2])
    local contentType = ARGV[3]
    local lockToken = ARGV[4]
    local ttlMs = tonumber(ARGV[5])
    local status = ARGV[6]
    local errorCode = ARGV[7]
    local errorMessage = ARGV[8]
    local now = tonumber(ARGV[9])
    
    local existing = redis.call('GET', key)
    
    if not existing then
      return cjson.encode({ error = 'RECORD_NOT_FOUND' })
    end
    
    local record = cjson.decode(existing)
    
    -- Verify lock token if provided
    if lockToken ~= '' and record.lockToken ~= lockToken then
      return cjson.encode({ error = 'LOCK_MISMATCH' })
    end
    
    -- Update record
    record.response = response
    record.status = status
    record.httpStatusCode = httpStatusCode ~= 0 and httpStatusCode or nil
    record.contentType = contentType ~= '' and contentType or nil
    record.errorCode = errorCode ~= '' and errorCode or nil
    record.errorMessage = errorMessage ~= '' and errorMessage or nil
    record.updatedAt = now
    record.completedAt = now
    record.expiresAt = now + ttlMs
    record.lockToken = nil
    record.lockExpiresAt = nil
    
    redis.call('SET', key, cjson.encode(record), 'PX', ttlMs)
    
    return cjson.encode({ success = true, record = record })
  `,

  // Atomic lock release
  releaseLock: `
    local key = KEYS[1]
    local lockToken = ARGV[1]
    local markFailed = ARGV[2] == 'true'
    local errorCode = ARGV[3]
    local errorMessage = ARGV[4]
    local now = tonumber(ARGV[5])
    
    local existing = redis.call('GET', key)
    
    if not existing then
      return cjson.encode({ error = 'RECORD_NOT_FOUND' })
    end
    
    local record = cjson.decode(existing)
    
    if record.lockToken ~= lockToken then
      return cjson.encode({ error = 'LOCK_MISMATCH' })
    end
    
    if markFailed then
      record.status = 'FAILED'
      record.errorCode = errorCode ~= '' and errorCode or nil
      record.errorMessage = errorMessage ~= '' and errorMessage or nil
      record.updatedAt = now
      record.lockToken = nil
      record.lockExpiresAt = nil
      
      local ttl = redis.call('PTTL', key)
      if ttl > 0 then
        redis.call('SET', key, cjson.encode(record), 'PX', ttl)
      end
      
      return cjson.encode({
        released = true,
        recordDeleted = false,
        recordMarkedFailed = true
      })
    end
    
    redis.call('DEL', key)
    
    return cjson.encode({
      released = true,
      recordDeleted = true,
      recordMarkedFailed = false
    })
  `,

  // Atomic lock extension
  extendLock: `
    local key = KEYS[1]
    local lockToken = ARGV[1]
    local extensionMs = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    
    local existing = redis.call('GET', key)
    
    if not existing then
      return cjson.encode({ error = 'RECORD_NOT_FOUND' })
    end
    
    local record = cjson.decode(existing)
    
    if record.lockToken ~= lockToken then
      return cjson.encode({ error = 'LOCK_MISMATCH' })
    end
    
    if record.lockExpiresAt and record.lockExpiresAt <= now then
      return cjson.encode({ error = 'LOCK_EXPIRED' })
    end
    
    local newExpiresAt = now + extensionMs
    record.lockExpiresAt = newExpiresAt
    record.updatedAt = now
    
    local ttl = redis.call('PTTL', key)
    if ttl > 0 then
      redis.call('SET', key, cjson.encode(record), 'PX', ttl)
    end
    
    return cjson.encode({
      extended = true,
      newExpiresAt = newExpiresAt
    })
  `,
};

/**
 * Redis implementation of IdempotencyStore
 * 
 * Suitable for:
 * - Multi-instance deployments
 * - High availability requirements
 * - Production environments
 * 
 * Features:
 * - Atomic operations via Lua scripts
 * - Automatic TTL-based cleanup
 * - Distributed locking
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  private client: RedisClient;
  private config: Required<Omit<RedisStoreOptions, 'client' | 'cacheScripts'>> & { cacheScripts: boolean };
  private scriptShas: Map<string, string> = new Map();

  constructor(options: RedisStoreOptions) {
    this.client = options.client;
    this.config = {
      defaultTtl: options.defaultTtl ?? DEFAULT_CONFIG.defaultTtl,
      lockTimeout: options.lockTimeout ?? DEFAULT_CONFIG.lockTimeout,
      maxResponseSize: options.maxResponseSize ?? DEFAULT_CONFIG.maxResponseSize,
      maxKeyLength: options.maxKeyLength ?? DEFAULT_CONFIG.maxKeyLength,
      keyPrefix: options.keyPrefix ?? 'idempotency',
      fingerprintHeaders: options.fingerprintHeaders ?? [],
      throwOnError: options.throwOnError ?? false,
      cacheScripts: options.cacheScripts ?? true,
    };
  }

  // ============================================================================
  // CHECK
  // ============================================================================

  async check(input: CheckInput): Promise<CheckResult> {
    const redisKey = this.getRedisKey(input.key);
    const data = await this.client.get(redisKey);

    if (!data) {
      return {
        found: false,
        requestMismatch: false,
      };
    }

    try {
      const record = JSON.parse(data) as IdempotencyRecord;
      const requestMismatch = record.requestHash !== input.requestHash;

      return {
        found: true,
        status: record.status,
        response: requestMismatch ? undefined : record.response,
        httpStatusCode: requestMismatch ? undefined : record.httpStatusCode,
        contentType: requestMismatch ? undefined : record.contentType,
        requestMismatch,
        createdAt: record.createdAt ? new Date(record.createdAt) : undefined,
        completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
      };
    } catch {
      throw new IdempotencyException(
        IdempotencyErrorCode.SERIALIZATION_ERROR,
        'Failed to parse stored record'
      );
    }
  }

  // ============================================================================
  // START PROCESSING
  // ============================================================================

  async startProcessing(input: StartProcessingInput): Promise<LockResult> {
    const validatedKey = validateKey(input.key, this.config.maxKeyLength);
    const redisKey = this.getRedisKey(input.key);
    const lockToken = generateLockToken();
    const lockTimeout = input.lockTimeout ?? this.config.lockTimeout;
    const now = Date.now();

    const metadata = JSON.stringify({
      key: validatedKey,
      endpoint: input.endpoint,
      method: input.method,
      clientId: input.clientId,
    });

    const result = await this.runScript('startProcessing', [redisKey], [
      input.requestHash,
      lockToken,
      lockTimeout.toString(),
      this.config.defaultTtl.toString(),
      metadata,
      now.toString(),
    ]);

    const parsed = JSON.parse(result as string);

    if (parsed.acquired) {
      return {
        acquired: true,
        lockToken: parsed.lockToken as LockToken,
        lockExpiresAt: new Date(parsed.lockExpiresAt),
      };
    }

    return {
      acquired: false,
      existingStatus: parsed.existingStatus as RecordStatus,
      existingResponse: parsed.existingResponse,
      existingHttpStatusCode: parsed.existingHttpStatusCode,
      requestMismatch: parsed.requestMismatch,
    };
  }

  // ============================================================================
  // RECORD
  // ============================================================================

  async record(input: RecordInput): Promise<IdempotencyRecord> {
    const redisKey = this.getRedisKey(input.key);
    const now = Date.now();

    // Validate response size
    validateResponseSize(input.response, this.config.maxResponseSize);

    const ttl = input.ttl ?? this.config.defaultTtl;
    const status = input.markAsFailed ? RecordStatus.FAILED : RecordStatus.COMPLETED;

    const result = await this.runScript('record', [redisKey], [
      input.response,
      (input.httpStatusCode ?? 0).toString(),
      input.contentType ?? '',
      input.lockToken ?? '',
      ttl.toString(),
      status,
      input.errorCode ?? '',
      input.errorMessage ?? '',
      now.toString(),
    ]);

    const parsed = JSON.parse(result as string);

    if (parsed.error === 'RECORD_NOT_FOUND') {
      throw new IdempotencyException(
        IdempotencyErrorCode.RECORD_NOT_FOUND,
        `Record not found for key: ${input.key}`
      );
    }

    if (parsed.error === 'LOCK_MISMATCH') {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock token mismatch'
      );
    }

    return this.parseRecord(parsed.record);
  }

  // ============================================================================
  // RELEASE LOCK
  // ============================================================================

  async releaseLock(input: ReleaseLockInput): Promise<ReleaseResult> {
    const redisKey = this.getRedisKey(input.key);
    const now = Date.now();

    const result = await this.runScript('releaseLock', [redisKey], [
      input.lockToken,
      (input.markFailed ?? false).toString(),
      input.errorCode ?? '',
      input.errorMessage ?? '',
      now.toString(),
    ]);

    const parsed = JSON.parse(result as string);

    if (parsed.error === 'RECORD_NOT_FOUND') {
      throw new IdempotencyException(
        IdempotencyErrorCode.RECORD_NOT_FOUND,
        `Record not found for key: ${input.key}`
      );
    }

    if (parsed.error === 'LOCK_MISMATCH') {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock token mismatch'
      );
    }

    return {
      released: parsed.released,
      recordDeleted: parsed.recordDeleted,
      recordMarkedFailed: parsed.recordMarkedFailed,
    };
  }

  // ============================================================================
  // EXTEND LOCK
  // ============================================================================

  async extendLock(input: ExtendLockInput): Promise<ExtendResult> {
    const redisKey = this.getRedisKey(input.key);
    const now = Date.now();

    const result = await this.runScript('extendLock', [redisKey], [
      input.lockToken,
      input.extension.toString(),
      now.toString(),
    ]);

    const parsed = JSON.parse(result as string);

    if (parsed.error === 'RECORD_NOT_FOUND') {
      throw new IdempotencyException(
        IdempotencyErrorCode.RECORD_NOT_FOUND,
        `Record not found for key: ${input.key}`
      );
    }

    if (parsed.error === 'LOCK_MISMATCH') {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock token mismatch'
      );
    }

    if (parsed.error === 'LOCK_EXPIRED') {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_EXPIRED,
        'Lock has already expired'
      );
    }

    return {
      extended: parsed.extended,
      newExpiresAt: new Date(parsed.newExpiresAt),
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanup(input: CleanupInput): Promise<CleanupResult> {
    const startTime = Date.now();
    const batchSize = input.batchSize ?? 100;
    const maxRecords = input.maxRecords ?? Infinity;

    let deletedCount = 0;
    let batchesProcessed = 0;
    let cursor = '0';

    // Note: Redis handles TTL automatically, but we can scan for manual cleanup
    const pattern = `${this.config.keyPrefix}:${input.keyPrefix ?? '*'}`;

    do {
      const [nextCursor, keys] = await this.client.scan(cursor, {
        MATCH: pattern,
        COUNT: batchSize,
      });

      cursor = nextCursor;

      if (keys.length > 0 && !input.dryRun) {
        // For manual cleanup (forceBefore), we need to check each key
        if (input.forceBefore) {
          for (const key of keys) {
            const data = await this.client.get(key);
            if (data) {
              try {
                const record = JSON.parse(data);
                if (new Date(record.createdAt) < input.forceBefore) {
                  await this.client.del(key);
                  deletedCount++;
                }
              } catch {
                // Skip invalid records
              }
            }
          }
        }
        batchesProcessed++;
      }

      if (deletedCount >= maxRecords) {
        break;
      }
    } while (cursor !== '0');

    return {
      deletedCount,
      batchesProcessed,
      durationMs: Date.now() - startTime,
    };
  }

  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================

  async get(key: string): Promise<IdempotencyRecord | null> {
    const redisKey = this.getRedisKey(key);
    const data = await this.client.get(redisKey);

    if (!data) {
      return null;
    }

    try {
      return this.parseRecord(JSON.parse(data));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<boolean> {
    const redisKey = this.getRedisKey(key);
    const result = await this.client.del(redisKey);
    return result > 0;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  private getRedisKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  private async runScript(
    scriptName: keyof typeof SCRIPTS,
    keys: string[],
    args: string[]
  ): Promise<unknown> {
    const script = SCRIPTS[scriptName];

    // Try cached SHA first
    if (this.config.cacheScripts && this.scriptShas.has(scriptName) && this.client.evalsha) {
      try {
        return await this.client.evalsha(this.scriptShas.get(scriptName)!, keys, args);
      } catch {
        // SHA not found, fall through to EVAL
        this.scriptShas.delete(scriptName);
      }
    }

    // Load and cache script
    if (this.config.cacheScripts && this.client.scriptLoad) {
      try {
        const sha = await this.client.scriptLoad(script);
        this.scriptShas.set(scriptName, sha);
        return await this.client.evalsha!(sha, keys, args);
      } catch {
        // Fall through to EVAL
      }
    }

    // Direct EVAL
    return await this.client.eval(script, keys, args);
  }

  private parseRecord(data: Record<string, unknown>): IdempotencyRecord {
    return {
      key: data.key as IdempotencyKey,
      requestHash: data.requestHash as RequestHash,
      response: data.response as string | undefined,
      status: data.status as RecordStatus,
      httpStatusCode: data.httpStatusCode as number | undefined,
      contentType: data.contentType as string | undefined,
      errorCode: data.errorCode as string | undefined,
      errorMessage: data.errorMessage as string | undefined,
      createdAt: new Date(data.createdAt as number),
      updatedAt: new Date(data.updatedAt as number),
      expiresAt: new Date(data.expiresAt as number),
      completedAt: data.completedAt ? new Date(data.completedAt as number) : undefined,
      clientId: data.clientId as string | undefined,
      endpoint: data.endpoint as string | undefined,
      method: data.method as string | undefined,
      lockToken: data.lockToken as LockToken | undefined,
      lockExpiresAt: data.lockExpiresAt ? new Date(data.lockExpiresAt as number) : undefined,
    };
  }
}

/**
 * Create a new Redis store instance
 */
export function createRedisStore(options: RedisStoreOptions): RedisIdempotencyStore {
  return new RedisIdempotencyStore(options);
}
