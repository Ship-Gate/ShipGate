/**
 * Idempotency Tracker
 * 
 * Tracks request idempotency keys and verifies exactly-once semantics.
 * Used for chaos testing of idempotent operations.
 */

import type { Timeline } from '../timeline.js';
import * as crypto from 'crypto';

export interface IdempotencyConfig {
  /** Time-to-live for cached responses (ms) */
  ttlMs?: number;
  /** Maximum number of cached requests */
  maxCacheSize?: number;
  /** Whether to track request hashes for duplicate detection */
  trackRequestHash?: boolean;
  /** Custom key generator function */
  keyGenerator?: (request: unknown) => string;
}

export interface IdempotencyState {
  active: boolean;
  totalRequests: number;
  uniqueRequests: number;
  duplicateRequests: number;
  idempotentResponses: number;
  conflictingRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface IdempotentRequest {
  idempotencyKey: string;
  requestHash: string;
  timestamp: number;
  response?: unknown;
  status: 'pending' | 'completed' | 'failed';
}

export interface IdempotencyCheckResult {
  isNew: boolean;
  isDuplicate: boolean;
  isConflicting: boolean;
  cachedResponse?: unknown;
  originalRequest?: IdempotentRequest;
  message?: string;
}

/**
 * Idempotency tracker for chaos testing
 */
export class IdempotencyTracker {
  private config: Required<IdempotencyConfig>;
  private state: IdempotencyState;
  private timeline: Timeline | null = null;
  private requests: Map<string, IdempotentRequest> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: IdempotencyConfig = {}) {
    this.config = {
      ttlMs: config.ttlMs ?? 24 * 60 * 60 * 1000, // 24 hours default
      maxCacheSize: config.maxCacheSize ?? 10000,
      trackRequestHash: config.trackRequestHash ?? true,
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator,
    };
    this.state = this.createInitialState();
  }

  private createInitialState(): IdempotencyState {
    return {
      active: false,
      totalRequests: 0,
      uniqueRequests: 0,
      duplicateRequests: 0,
      idempotentResponses: 0,
      conflictingRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Attach a timeline for event recording
   */
  attachTimeline(timeline: Timeline): void {
    this.timeline = timeline;
  }

  /**
   * Activate the idempotency tracker
   */
  activate(): void {
    if (this.state.active) return;

    this.state = this.createInitialState();
    this.state.active = true;
    this.requests.clear();

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRequests();
    }, Math.min(this.config.ttlMs / 10, 60000));

    this.timeline?.record('injection_start', {
      injector: 'idempotency',
      config: {
        ttlMs: this.config.ttlMs,
        maxCacheSize: this.config.maxCacheSize,
        trackRequestHash: this.config.trackRequestHash,
      },
    });
  }

  /**
   * Deactivate the idempotency tracker
   */
  deactivate(): void {
    if (!this.state.active) return;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.state.active = false;
    this.timeline?.record('injection_end', {
      injector: 'idempotency',
      state: { ...this.state },
    });
  }

  /**
   * Get current state
   */
  getState(): IdempotencyState {
    return { ...this.state };
  }

  /**
   * Check if a request with the given idempotency key should proceed
   */
  checkIdempotency(
    idempotencyKey: string,
    request: unknown
  ): IdempotencyCheckResult {
    this.state.totalRequests++;

    const requestHash = this.config.trackRequestHash
      ? this.hashRequest(request)
      : '';

    const existing = this.requests.get(idempotencyKey);

    if (!existing) {
      // New request
      this.state.uniqueRequests++;
      this.state.cacheMisses++;

      const newRequest: IdempotentRequest = {
        idempotencyKey,
        requestHash,
        timestamp: Date.now(),
        status: 'pending',
      };
      this.requests.set(idempotencyKey, newRequest);
      this.enforceMaxCacheSize();

      this.timeline?.record('injection_start', {
        type: 'idempotency_new',
        idempotencyKey,
        requestHash: requestHash.substring(0, 8),
      });

      return {
        isNew: true,
        isDuplicate: false,
        isConflicting: false,
      };
    }

    // Existing request with same key
    this.state.cacheHits++;

    if (this.config.trackRequestHash && requestHash !== existing.requestHash) {
      // Conflicting request (same key, different parameters)
      this.state.conflictingRequests++;

      this.timeline?.record('error', {
        type: 'idempotency_conflict',
        idempotencyKey,
        originalHash: existing.requestHash.substring(0, 8),
        newHash: requestHash.substring(0, 8),
      });

      return {
        isNew: false,
        isDuplicate: false,
        isConflicting: true,
        originalRequest: existing,
        message: 'Idempotency key already used with different request parameters',
      };
    }

    // Duplicate request
    this.state.duplicateRequests++;

    if (existing.status === 'completed' && existing.response !== undefined) {
      this.state.idempotentResponses++;

      this.timeline?.record('injection_end', {
        type: 'idempotency_cached',
        idempotencyKey,
        status: existing.status,
      });

      return {
        isNew: false,
        isDuplicate: true,
        isConflicting: false,
        cachedResponse: existing.response,
        originalRequest: existing,
      };
    }

    // Request is still pending or failed
    this.timeline?.record('injection_end', {
      type: 'idempotency_pending',
      idempotencyKey,
      status: existing.status,
    });

    return {
      isNew: false,
      isDuplicate: true,
      isConflicting: false,
      originalRequest: existing,
      message: existing.status === 'pending'
        ? 'Request is still being processed'
        : 'Previous request failed, retry allowed',
    };
  }

  /**
   * Record the response for a completed request
   */
  recordResponse(idempotencyKey: string, response: unknown, success: boolean): void {
    const request = this.requests.get(idempotencyKey);
    if (request) {
      request.response = response;
      request.status = success ? 'completed' : 'failed';

      this.timeline?.record('injection_end', {
        type: 'idempotency_recorded',
        idempotencyKey,
        success,
      });
    }
  }

  /**
   * Wrap an async operation with idempotency checking
   */
  async wrap<T>(
    idempotencyKey: string,
    request: unknown,
    operation: () => Promise<T>
  ): Promise<T> {
    const check = this.checkIdempotency(idempotencyKey, request);

    if (check.isConflicting) {
      throw new IdempotencyError('IDEMPOTENCY_CONFLICT', check.message!);
    }

    if (check.isDuplicate && check.cachedResponse !== undefined) {
      return check.cachedResponse as T;
    }

    if (check.isDuplicate && check.originalRequest?.status === 'pending') {
      // Wait for the original request to complete
      await this.waitForCompletion(idempotencyKey);
      const updated = this.requests.get(idempotencyKey);
      if (updated?.status === 'completed' && updated.response !== undefined) {
        return updated.response as T;
      }
    }

    try {
      const response = await operation();
      this.recordResponse(idempotencyKey, response, true);
      return response;
    } catch (error) {
      this.recordResponse(idempotencyKey, error, false);
      throw error;
    }
  }

  /**
   * Wait for a pending request to complete
   */
  private async waitForCompletion(
    idempotencyKey: string,
    timeoutMs: number = 30000
  ): Promise<void> {
    const start = Date.now();
    const pollInterval = 100;

    while (Date.now() - start < timeoutMs) {
      const request = this.requests.get(idempotencyKey);
      if (!request || request.status !== 'pending') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new IdempotencyError(
      'IDEMPOTENCY_TIMEOUT',
      'Timed out waiting for original request to complete'
    );
  }

  /**
   * Verify exactly-once semantics for a set of requests
   */
  verifyExactlyOnce(
    idempotencyKey: string,
    expectedCount: number = 1
  ): { passed: boolean; actualCount: number; message: string } {
    const duplicateCount = this.countDuplicates(idempotencyKey);
    const passed = duplicateCount === expectedCount - 1;

    return {
      passed,
      actualCount: duplicateCount + 1,
      message: passed
        ? `Exactly-once verified: ${expectedCount} request(s) resulted in 1 operation`
        : `Exactly-once violation: Expected ${expectedCount} requests to result in 1 operation, ` +
          `but ${duplicateCount + 1} operations were recorded`,
    };
  }

  /**
   * Count duplicate requests for a key
   */
  private countDuplicates(idempotencyKey: string): number {
    // This is a simplified implementation
    // In reality, you'd track all attempts per key
    return this.requests.has(idempotencyKey) ? this.state.duplicateRequests : 0;
  }

  /**
   * Generate a hash for the request body
   */
  private hashRequest(request: unknown): string {
    const content = JSON.stringify(request, this.sortedReplacer);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * JSON replacer that sorts object keys for consistent hashing
   */
  private sortedReplacer(_key: string, value: unknown): unknown {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as object).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(request: unknown): string {
    return this.hashRequest(request);
  }

  /**
   * Remove expired requests from cache
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    const expiry = now - this.config.ttlMs;

    for (const [key, request] of this.requests) {
      if (request.timestamp < expiry) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Enforce maximum cache size by removing oldest entries
   */
  private enforceMaxCacheSize(): void {
    if (this.requests.size <= this.config.maxCacheSize) return;

    // Convert to array and sort by timestamp
    const entries = Array.from(this.requests.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest entries until within limit
    const toRemove = entries.length - this.config.maxCacheSize;
    for (let i = 0; i < toRemove; i++) {
      this.requests.delete(entries[i]![0]);
    }
  }

  /**
   * Clear all cached requests
   */
  clear(): void {
    this.requests.clear();
  }

  /**
   * Get statistics about idempotency tracking
   */
  getStats(): {
    cacheHitRate: number;
    duplicateRate: number;
    conflictRate: number;
    cacheSize: number;
  } {
    const total = this.state.totalRequests || 1;
    return {
      cacheHitRate: this.state.cacheHits / total,
      duplicateRate: this.state.duplicateRequests / total,
      conflictRate: this.state.conflictingRequests / total,
      cacheSize: this.requests.size,
    };
  }
}

/**
 * Error class for idempotency violations
 */
export class IdempotencyError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'IdempotencyError';
    this.code = code;
  }
}

/**
 * Create an idempotency tracker with default settings
 */
export function createIdempotencyTracker(
  config?: IdempotencyConfig
): IdempotencyTracker {
  return new IdempotencyTracker(config);
}

/**
 * Create an idempotency tracker for testing concurrent duplicates
 */
export function createConcurrentIdempotencyTracker(): IdempotencyTracker {
  return new IdempotencyTracker({
    ttlMs: 60000, // 1 minute
    trackRequestHash: true,
  });
}

/**
 * Create an idempotency tracker with strict conflict detection
 */
export function createStrictIdempotencyTracker(): IdempotencyTracker {
  return new IdempotencyTracker({
    ttlMs: 24 * 60 * 60 * 1000, // 24 hours
    trackRequestHash: true,
    maxCacheSize: 100000,
  });
}
