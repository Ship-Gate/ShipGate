// ============================================================================
// ISL Standard Library - Idempotency Manager
// @stdlib/idempotency/manager
// ============================================================================

import {
  IdempotencyStore,
  IdempotencyConfig,
  IdempotencyRecord,
  CheckInput,
  CheckResult,
  CheckResultType,
  StartProcessingInput,
  LockResult,
  LockResultType,
  RecordInput,
  RecordResultType,
  ReleaseLockInput,
  ReleaseResult,
  ReleaseResultType,
  ExtendLockInput,
  ExtendResult,
  ExtendResultType,
  CleanupInput,
  CleanupResult,
  CleanupResultType,
  IdempotencyErrorCode,
  IdempotencyException,
  DEFAULT_CONFIG,
  RecordStatus,
  LockToken,
} from './types';
import {
  validateKey,
  computeRequestHash,
  computeHttpRequestHash,
  wrapError,
  isRetriableError,
  calculateBackoff,
  sleep,
} from './utils';

export interface IdempotencyManagerOptions extends IdempotencyConfig {
  /** Store implementation */
  store: IdempotencyStore;
  
  /** Maximum retries for retriable errors */
  maxRetries?: number;
  
  /** Base delay for exponential backoff (ms) */
  baseRetryDelay?: number;
}

/**
 * High-level idempotency manager with error handling and retry logic
 * 
 * Provides a unified interface for idempotency operations with:
 * - Automatic retry for transient failures
 * - Result types for explicit error handling
 * - Request hash computation
 * 
 * Usage:
 * ```typescript
 * const manager = new IdempotencyManager({
 *   store: createMemoryStore(),
 * });
 * 
 * // Execute an idempotent operation
 * const result = await manager.execute(
 *   'payment-123',
 *   { amount: 100, currency: 'USD' },
 *   async () => {
 *     return await processPayment({ amount: 100, currency: 'USD' });
 *   }
 * );
 * ```
 */
export class IdempotencyManager {
  private store: IdempotencyStore;
  private config: Required<IdempotencyManagerOptions>;

  constructor(options: IdempotencyManagerOptions) {
    this.store = options.store;
    this.config = {
      store: options.store,
      defaultTtl: options.defaultTtl ?? DEFAULT_CONFIG.defaultTtl,
      lockTimeout: options.lockTimeout ?? DEFAULT_CONFIG.lockTimeout,
      maxResponseSize: options.maxResponseSize ?? DEFAULT_CONFIG.maxResponseSize,
      maxKeyLength: options.maxKeyLength ?? DEFAULT_CONFIG.maxKeyLength,
      keyPrefix: options.keyPrefix ?? '',
      fingerprintHeaders: options.fingerprintHeaders ?? [],
      throwOnError: options.throwOnError ?? false,
      maxRetries: options.maxRetries ?? 3,
      baseRetryDelay: options.baseRetryDelay ?? 100,
    };
  }

  // ============================================================================
  // HIGH-LEVEL API
  // ============================================================================

  /**
   * Execute an operation with idempotency guarantees
   * 
   * This is the recommended way to use idempotency. It handles:
   * 1. Checking for existing results
   * 2. Acquiring lock for new operations
   * 3. Executing the operation
   * 4. Recording the result
   * 5. Releasing lock on failure
   * 
   * @param key - Idempotency key
   * @param request - Request payload for hash computation
   * @param operation - The operation to execute
   * @param options - Additional options
   */
  async execute<T>(
    key: string,
    request: unknown,
    operation: () => Promise<T>,
    options?: {
      ttl?: number;
      serialize?: (result: T) => string;
      deserialize?: (data: string) => T;
    }
  ): Promise<ExecuteResult<T>> {
    const requestHash = computeRequestHash(request);
    const serialize = options?.serialize ?? JSON.stringify;
    const deserialize = options?.deserialize ?? JSON.parse;

    // Try to acquire lock
    const lockResult = await this.startProcessing({ key, requestHash });

    if (!lockResult.acquired) {
      // Request mismatch
      if (lockResult.requestMismatch) {
        return {
          success: false,
          replayed: false,
          error: {
            code: IdempotencyErrorCode.REQUEST_MISMATCH,
            message: 'Idempotency key was already used with a different request',
            retriable: false,
          },
        };
      }

      // Completed - return cached result
      if (lockResult.existingStatus === RecordStatus.COMPLETED && lockResult.existingResponse) {
        try {
          const result = deserialize(lockResult.existingResponse);
          return {
            success: true,
            replayed: true,
            data: result,
          };
        } catch (e) {
          return {
            success: false,
            replayed: false,
            error: {
              code: IdempotencyErrorCode.SERIALIZATION_ERROR,
              message: 'Failed to deserialize cached response',
              retriable: false,
            },
          };
        }
      }

      // Concurrent request
      if (lockResult.existingStatus === RecordStatus.PROCESSING) {
        return {
          success: false,
          replayed: false,
          error: {
            code: IdempotencyErrorCode.CONCURRENT_REQUEST,
            message: 'Request is currently being processed',
            retriable: true,
            retryAfterMs: this.config.lockTimeout,
          },
        };
      }
    }

    const lockToken = lockResult.lockToken!;

    try {
      // Execute the operation
      const result = await operation();
      const serialized = serialize(result);

      // Record success
      await this.record({
        key,
        requestHash,
        response: serialized,
        lockToken,
        ttl: options?.ttl,
      });

      return {
        success: true,
        replayed: false,
        data: result,
      };
    } catch (error) {
      // Release lock on failure
      try {
        await this.releaseLock({
          key,
          lockToken,
          markFailed: true,
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // Ignore release errors
      }

      throw error;
    }
  }

  /**
   * Execute with automatic retry for transient failures
   */
  async executeWithRetry<T>(
    key: string,
    request: unknown,
    operation: () => Promise<T>,
    options?: {
      ttl?: number;
      serialize?: (result: T) => string;
      deserialize?: (data: string) => T;
      maxRetries?: number;
    }
  ): Promise<ExecuteResult<T>> {
    const maxRetries = options?.maxRetries ?? this.config.maxRetries;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.execute(key, request, operation, options);
        
        // Retry on concurrent request
        if (!result.success && result.error?.retriable) {
          lastError = new IdempotencyException(
            result.error.code as IdempotencyErrorCode,
            result.error.message,
            true,
            result.error.retryAfterMs
          );
          
          if (attempt < maxRetries) {
            await sleep(calculateBackoff(attempt, this.config.baseRetryDelay));
            continue;
          }
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (!isRetriableError(error) || attempt >= maxRetries) {
          throw error;
        }
        
        await sleep(calculateBackoff(attempt, this.config.baseRetryDelay));
      }
    }

    throw lastError;
  }

  // ============================================================================
  // LOW-LEVEL API
  // ============================================================================

  /**
   * Check if a request has been processed
   */
  async check(input: CheckInput): Promise<CheckResultType> {
    try {
      const result = await this.withRetry(() => this.store.check(input));
      return { success: true, data: result };
    } catch (error) {
      if (this.config.throwOnError) throw error;
      return { success: false, error: wrapError(error).toError() };
    }
  }

  /**
   * Start processing a new request
   */
  async startProcessing(input: StartProcessingInput): Promise<LockResult> {
    validateKey(input.key, this.config.maxKeyLength);
    return await this.withRetry(() =>
      this.store.startProcessing({
        ...input,
        lockTimeout: input.lockTimeout ?? this.config.lockTimeout,
      })
    );
  }

  /**
   * Record a completed request
   */
  async record(input: RecordInput): Promise<RecordResultType> {
    try {
      const result = await this.withRetry(() =>
        this.store.record({
          ...input,
          ttl: input.ttl ?? this.config.defaultTtl,
        })
      );
      return { success: true, data: result };
    } catch (error) {
      if (this.config.throwOnError) throw error;
      return { success: false, error: wrapError(error).toError() };
    }
  }

  /**
   * Release a lock without recording
   */
  async releaseLock(input: ReleaseLockInput): Promise<ReleaseResultType> {
    try {
      const result = await this.withRetry(() => this.store.releaseLock(input));
      return { success: true, data: result };
    } catch (error) {
      if (this.config.throwOnError) throw error;
      return { success: false, error: wrapError(error).toError() };
    }
  }

  /**
   * Extend lock timeout
   */
  async extendLock(input: ExtendLockInput): Promise<ExtendResultType> {
    try {
      const result = await this.withRetry(() => this.store.extendLock(input));
      return { success: true, data: result };
    } catch (error) {
      if (this.config.throwOnError) throw error;
      return { success: false, error: wrapError(error).toError() };
    }
  }

  /**
   * Clean up expired records
   */
  async cleanup(input?: CleanupInput): Promise<CleanupResultType> {
    try {
      const result = await this.store.cleanup(input ?? {});
      return { success: true, data: result };
    } catch (error) {
      if (this.config.throwOnError) throw error;
      return { success: false, error: wrapError(error).toError() };
    }
  }

  /**
   * Get a record by key
   */
  async get(key: string): Promise<IdempotencyRecord | null> {
    return await this.store.get(key);
  }

  /**
   * Delete a record
   */
  async delete(key: string): Promise<boolean> {
    return await this.store.delete(key);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return await this.store.healthCheck();
  }

  /**
   * Close the store
   */
  async close(): Promise<void> {
    await this.store.close();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Compute hash from request data
   */
  computeHash(data: unknown): string {
    return computeRequestHash(data);
  }

  /**
   * Compute hash from HTTP request
   */
  computeHttpHash(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ): string {
    return computeHttpRequestHash(
      method,
      path,
      body,
      headers,
      this.config.fingerprintHeaders
    );
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!isRetriableError(error) || attempt >= this.config.maxRetries) {
          throw error;
        }

        await sleep(calculateBackoff(attempt, this.config.baseRetryDelay));
      }
    }

    throw lastError;
  }
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export type ExecuteResult<T> =
  | { success: true; replayed: boolean; data: T }
  | { success: false; replayed: false; error: { code: string; message: string; retriable: boolean; retryAfterMs?: number } };

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an idempotency manager
 */
export function createIdempotencyManager(
  options: IdempotencyManagerOptions
): IdempotencyManager {
  return new IdempotencyManager(options);
}
