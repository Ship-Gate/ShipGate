// ============================================================================
// ISL Standard Library - In-Memory Idempotency Store
// @stdlib/idempotency/store/memory
// ============================================================================

import {
  IdempotencyStore,
  IdempotencyRecord,
  RequestHash,
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
  prefixKey,
  generateLockToken,
  calculateExpiration,
  isExpired,
  validateResponseSize,
} from '../utils';

interface StoredRecord extends IdempotencyRecord {
  // Internal fields
  _internalKey: string;
}

export interface MemoryStoreOptions extends IdempotencyConfig {
  /** Maximum number of records to store (default: 10000) */
  maxRecords?: number;
  
  /** Interval for automatic cleanup in ms (default: 60000, 0 to disable) */
  cleanupInterval?: number;
}

/**
 * In-memory implementation of IdempotencyStore
 * 
 * Suitable for:
 * - Development and testing
 * - Single-instance deployments
 * - Low-traffic applications
 * 
 * NOT suitable for:
 * - Multi-instance deployments (no shared state)
 * - High availability requirements (no persistence)
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private records: Map<string, StoredRecord> = new Map();
  private config: Required<MemoryStoreOptions>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(options: MemoryStoreOptions = {}) {
    this.config = {
      defaultTtl: options.defaultTtl ?? DEFAULT_CONFIG.defaultTtl,
      lockTimeout: options.lockTimeout ?? DEFAULT_CONFIG.lockTimeout,
      maxResponseSize: options.maxResponseSize ?? DEFAULT_CONFIG.maxResponseSize,
      maxKeyLength: options.maxKeyLength ?? DEFAULT_CONFIG.maxKeyLength,
      keyPrefix: options.keyPrefix ?? '',
      fingerprintHeaders: options.fingerprintHeaders ?? [],
      throwOnError: options.throwOnError ?? false,
      maxRecords: options.maxRecords ?? 10000,
      cleanupInterval: options.cleanupInterval ?? 60000,
    };

    // Start automatic cleanup
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(
        () => this.runAutoCleanup(),
        this.config.cleanupInterval
      );
    }
  }

  // ============================================================================
  // CHECK
  // ============================================================================

  async check(input: CheckInput): Promise<CheckResult> {
    const internalKey = this.getInternalKey(input.key);
    const record = this.records.get(internalKey);

    if (!record) {
      return {
        found: false,
        requestMismatch: false,
      };
    }

    // Check if expired
    if (isExpired(record.expiresAt)) {
      this.records.delete(internalKey);
      return {
        found: false,
        requestMismatch: false,
      };
    }

    // Check for request mismatch
    const requestMismatch = record.requestHash !== input.requestHash;

    return {
      found: true,
      status: record.status,
      response: requestMismatch ? undefined : record.response,
      httpStatusCode: requestMismatch ? undefined : record.httpStatusCode,
      contentType: requestMismatch ? undefined : record.contentType,
      requestMismatch,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
    };
  }

  // ============================================================================
  // START PROCESSING
  // ============================================================================

  async startProcessing(input: StartProcessingInput): Promise<LockResult> {
    const validatedKey = validateKey(input.key, this.config.maxKeyLength);
    const internalKey = this.getInternalKey(input.key);
    const now = new Date();

    // Check for existing record
    const existing = this.records.get(internalKey);

    if (existing && !isExpired(existing.expiresAt)) {
      // Check for request mismatch
      if (existing.requestHash !== input.requestHash) {
        return {
          acquired: false,
          existingStatus: existing.status,
          requestMismatch: true,
        };
      }

      // If completed, return the cached response
      if (existing.status === RecordStatus.COMPLETED) {
        return {
          acquired: false,
          existingStatus: existing.status,
          existingResponse: existing.response,
          existingHttpStatusCode: existing.httpStatusCode,
        };
      }

      // If failed, allow retry
      if (existing.status === RecordStatus.FAILED) {
        // Fall through to create new lock
      } else if (existing.status === RecordStatus.PROCESSING) {
        // Check if lock is still valid
        if (existing.lockExpiresAt && !isExpired(existing.lockExpiresAt)) {
          return {
            acquired: false,
            existingStatus: existing.status,
          };
        }
        // Lock expired, allow takeover
      }
    }

    // Evict if at capacity
    if (this.records.size >= this.config.maxRecords) {
      await this.evictOldest();
    }

    // Create new record with lock
    const lockToken = generateLockToken();
    const lockTimeout = input.lockTimeout ?? this.config.lockTimeout;
    const lockExpiresAt = calculateExpiration(lockTimeout, now);
    const expiresAt = calculateExpiration(this.config.defaultTtl, now);

    const record: StoredRecord = {
      _internalKey: internalKey,
      key: validatedKey,
      requestHash: input.requestHash as RequestHash,
      status: RecordStatus.PROCESSING,
      createdAt: now,
      updatedAt: now,
      expiresAt,
      endpoint: input.endpoint,
      method: input.method,
      clientId: input.clientId,
      lockToken,
      lockExpiresAt,
    };

    this.records.set(internalKey, record);

    return {
      acquired: true,
      lockToken,
      lockExpiresAt,
    };
  }

  // ============================================================================
  // RECORD
  // ============================================================================

  async record(input: RecordInput): Promise<IdempotencyRecord> {
    const internalKey = this.getInternalKey(input.key);
    const now = new Date();

    // Validate response size
    validateResponseSize(input.response, this.config.maxResponseSize);

    const existing = this.records.get(internalKey);

    // If lock token provided, verify it
    if (input.lockToken && existing?.lockToken !== input.lockToken) {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock token mismatch - another process may have acquired the lock'
      );
    }

    const ttl = input.ttl ?? this.config.defaultTtl;
    const expiresAt = calculateExpiration(ttl, now);

    const status = input.markAsFailed ? RecordStatus.FAILED : RecordStatus.COMPLETED;

    const record: StoredRecord = {
      _internalKey: internalKey,
      key: (existing?.key ?? validateKey(input.key, this.config.maxKeyLength)),
      requestHash: (existing?.requestHash ?? input.requestHash) as RequestHash,
      response: input.response,
      status,
      httpStatusCode: input.httpStatusCode,
      contentType: input.contentType,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt,
      completedAt: now,
      endpoint: existing?.endpoint,
      method: existing?.method,
      clientId: existing?.clientId,
      lockToken: undefined, // Clear lock
      lockExpiresAt: undefined,
    };

    this.records.set(internalKey, record);

    // Return without internal fields
    const { _internalKey, ...result } = record;
    return result;
  }

  // ============================================================================
  // RELEASE LOCK
  // ============================================================================

  async releaseLock(input: ReleaseLockInput): Promise<ReleaseResult> {
    const internalKey = this.getInternalKey(input.key);
    const existing = this.records.get(internalKey);

    if (!existing) {
      throw new IdempotencyException(
        IdempotencyErrorCode.RECORD_NOT_FOUND,
        `Record not found for key: ${input.key}`
      );
    }

    if (existing.lockToken !== input.lockToken) {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock token mismatch'
      );
    }

    if (input.markFailed) {
      // Mark as failed instead of deleting
      existing.status = RecordStatus.FAILED;
      existing.errorCode = input.errorCode;
      existing.errorMessage = input.errorMessage;
      existing.updatedAt = new Date();
      existing.lockToken = undefined;
      existing.lockExpiresAt = undefined;

      return {
        released: true,
        recordDeleted: false,
        recordMarkedFailed: true,
      };
    }

    // Delete the record
    this.records.delete(internalKey);

    return {
      released: true,
      recordDeleted: true,
      recordMarkedFailed: false,
    };
  }

  // ============================================================================
  // EXTEND LOCK
  // ============================================================================

  async extendLock(input: ExtendLockInput): Promise<ExtendResult> {
    const internalKey = this.getInternalKey(input.key);
    const existing = this.records.get(internalKey);

    if (!existing) {
      throw new IdempotencyException(
        IdempotencyErrorCode.RECORD_NOT_FOUND,
        `Record not found for key: ${input.key}`
      );
    }

    if (existing.lockToken !== input.lockToken) {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_ACQUISITION_FAILED,
        'Lock token mismatch'
      );
    }

    if (isExpired(existing.lockExpiresAt)) {
      throw new IdempotencyException(
        IdempotencyErrorCode.LOCK_EXPIRED,
        'Lock has already expired'
      );
    }

    const newExpiresAt = calculateExpiration(input.extension);
    existing.lockExpiresAt = newExpiresAt;
    existing.updatedAt = new Date();

    return {
      extended: true,
      newExpiresAt,
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanup(input: CleanupInput): Promise<CleanupResult> {
    const startTime = Date.now();
    const batchSize = input.batchSize ?? 1000;
    const maxRecords = input.maxRecords ?? Infinity;
    const now = new Date();

    let deletedCount = 0;
    let batchesProcessed = 0;
    let oldestRemaining: Date | undefined;
    let nextExpiration: Date | undefined;

    const keysToDelete: string[] = [];

    // Find expired records
    for (const [key, record] of this.records) {
      // Apply filters
      if (input.keyPrefix && !key.startsWith(input.keyPrefix)) {
        continue;
      }
      if (input.clientId && record.clientId !== input.clientId) {
        continue;
      }

      const shouldDelete =
        isExpired(record.expiresAt, now) ||
        (input.forceBefore && record.createdAt < input.forceBefore);

      if (shouldDelete) {
        if (!input.dryRun) {
          keysToDelete.push(key);
        }
        deletedCount++;

        if (deletedCount >= maxRecords) {
          break;
        }
      } else {
        // Track remaining records
        if (!oldestRemaining || record.createdAt < oldestRemaining) {
          oldestRemaining = record.createdAt;
        }
        if (!nextExpiration || record.expiresAt < nextExpiration) {
          nextExpiration = record.expiresAt;
        }
      }
    }

    // Delete in batches
    if (!input.dryRun) {
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        for (const key of batch) {
          this.records.delete(key);
        }
        batchesProcessed++;
      }
    }

    return {
      deletedCount,
      batchesProcessed,
      oldestRemaining,
      nextExpiration,
      durationMs: Date.now() - startTime,
    };
  }

  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================

  async get(key: string): Promise<IdempotencyRecord | null> {
    const internalKey = this.getInternalKey(key);
    const record = this.records.get(internalKey);

    if (!record || isExpired(record.expiresAt)) {
      return null;
    }

    const { _internalKey, ...result } = record;
    return result;
  }

  async delete(key: string): Promise<boolean> {
    const internalKey = this.getInternalKey(key);
    return this.records.delete(internalKey);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.records.clear();
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  private getInternalKey(key: string): string {
    return prefixKey(key, this.config.keyPrefix);
  }

  private async evictOldest(): Promise<void> {
    // Find oldest record
    let oldestKey: string | undefined;
    let oldestTime: Date | undefined;

    for (const [key, record] of this.records) {
      if (!oldestTime || record.createdAt < oldestTime) {
        oldestKey = key;
        oldestTime = record.createdAt;
      }
    }

    if (oldestKey) {
      this.records.delete(oldestKey);
    }
  }

  private async runAutoCleanup(): Promise<void> {
    try {
      await this.cleanup({ batchSize: 100 });
    } catch {
      // Ignore cleanup errors in background
    }
  }

  // ============================================================================
  // DEBUG METHODS
  // ============================================================================

  /** Get current record count (for testing) */
  get size(): number {
    return this.records.size;
  }

  /** Get all keys (for testing) */
  get keys(): string[] {
    return Array.from(this.records.keys());
  }

  /** Clear all records (for testing) */
  clear(): void {
    this.records.clear();
  }
}

/**
 * Create a new memory store instance
 */
export function createMemoryStore(options?: MemoryStoreOptions): MemoryIdempotencyStore {
  return new MemoryIdempotencyStore(options);
}
