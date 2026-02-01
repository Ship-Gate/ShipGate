/**
 * Cache Verification - Runtime contract verification for cache operations.
 */

import type { Cache, CacheEntry, SetOptions } from './types';

/**
 * Verification configuration
 */
export interface VerificationConfig {
  enablePreconditions?: boolean;
  enablePostconditions?: boolean;
  throwOnViolation?: boolean;
  logViolations?: boolean;
}

/**
 * Violation record
 */
export interface Violation {
  type: 'PRECONDITION' | 'POSTCONDITION';
  operation: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
  timestamp: Date;
}

/**
 * Cache verifier for ISL contract verification
 */
export class CacheVerifier<T> {
  private readonly config: Required<VerificationConfig>;
  private readonly violations: Violation[] = [];

  constructor(config?: VerificationConfig) {
    this.config = {
      enablePreconditions: config?.enablePreconditions ?? true,
      enablePostconditions: config?.enablePostconditions ?? true,
      throwOnViolation: config?.throwOnViolation ?? true,
      logViolations: config?.logViolations ?? true,
    };
  }

  /**
   * Verify Get preconditions
   */
  verifyGetPreconditions(key: string): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      'Get',
      key.length >= 1,
      'Key must not be empty',
      key
    );

    this.checkPrecondition(
      'Get',
      key.length <= 1024,
      'Key must be at most 1024 characters',
      key.length
    );
  }

  /**
   * Verify Get postconditions
   */
  verifyGetPostconditions(
    key: string,
    entry: CacheEntry<T> | undefined
  ): void {
    if (!this.config.enablePostconditions) return;

    if (entry) {
      this.checkPostcondition(
        'Get',
        entry.key === key,
        'Entry key must match request key',
        key,
        entry.key
      );

      if (entry.expiresAt) {
        this.checkPostcondition(
          'Get',
          entry.expiresAt > new Date(),
          'Entry must not be expired',
          'future date',
          entry.expiresAt
        );
      }
    }
  }

  /**
   * Verify Set preconditions
   */
  verifySetPreconditions(
    key: string,
    value: T,
    options?: SetOptions
  ): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      'Set',
      key.length >= 1,
      'Key must not be empty',
      key
    );

    this.checkPrecondition(
      'Set',
      key.length <= 1024,
      'Key must be at most 1024 characters',
      key.length
    );

    if (options?.ttl !== undefined) {
      this.checkPrecondition(
        'Set',
        options.ttl >= 0,
        'TTL must be non-negative',
        options.ttl
      );

      this.checkPrecondition(
        'Set',
        options.ttl <= 31536000000,
        'TTL must be at most 1 year',
        options.ttl
      );
    }
  }

  /**
   * Verify Set postconditions
   */
  async verifySetPostconditions(
    cache: Cache<T>,
    key: string,
    value: T
  ): Promise<void> {
    if (!this.config.enablePostconditions) return;

    const result = await cache.get(key);
    
    this.checkPostcondition(
      'Set',
      result.ok,
      'Value must be retrievable after set',
      true,
      result.ok
    );

    if (result.ok) {
      this.checkPostcondition(
        'Set',
        JSON.stringify(result.data.value) === JSON.stringify(value),
        'Retrieved value must match set value',
        value,
        result.data.value
      );
    }
  }

  /**
   * Verify Delete preconditions
   */
  verifyDeletePreconditions(key: string): void {
    if (!this.config.enablePreconditions) return;

    this.checkPrecondition(
      'Delete',
      key.length >= 1,
      'Key must not be empty',
      key
    );
  }

  /**
   * Verify Delete postconditions
   */
  async verifyDeletePostconditions(
    cache: Cache<T>,
    key: string
  ): Promise<void> {
    if (!this.config.enablePostconditions) return;

    const result = await cache.get(key);
    
    this.checkPostcondition(
      'Delete',
      !result.ok,
      'Key must not exist after delete',
      false,
      result.ok
    );
  }

  /**
   * Verify Clear postconditions
   */
  async verifyClearPostconditions(cache: Cache<T>): Promise<void> {
    if (!this.config.enablePostconditions) return;

    const stats = await cache.stats();
    
    this.checkPostcondition(
      'Clear',
      stats.size === 0,
      'Cache must be empty after clear',
      0,
      stats.size
    );
  }

  /**
   * Get all violations
   */
  getViolations(): readonly Violation[] {
    return [...this.violations];
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    this.violations.length = 0;
  }

  /**
   * Check if there are any violations
   */
  hasViolations(): boolean {
    return this.violations.length > 0;
  }

  private checkPrecondition(
    operation: string,
    condition: boolean,
    message: string,
    actual?: unknown
  ): void {
    if (!condition) {
      this.handleViolation({
        type: 'PRECONDITION',
        operation,
        message,
        actual,
        timestamp: new Date(),
      });
    }
  }

  private checkPostcondition(
    operation: string,
    condition: boolean,
    message: string,
    expected?: unknown,
    actual?: unknown
  ): void {
    if (!condition) {
      this.handleViolation({
        type: 'POSTCONDITION',
        operation,
        message,
        expected,
        actual,
        timestamp: new Date(),
      });
    }
  }

  private handleViolation(violation: Violation): void {
    this.violations.push(violation);

    if (this.config.logViolations) {
      console.warn(
        `[${violation.type} VIOLATION] ${violation.operation}: ${violation.message}`,
        {
          expected: violation.expected,
          actual: violation.actual,
        }
      );
    }

    if (this.config.throwOnViolation) {
      throw new Error(
        `${violation.type} violated in ${violation.operation}: ${violation.message}`
      );
    }
  }
}
