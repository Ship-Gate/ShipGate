/**
 * Custom error classes for the rate limiting library
 */

// ============================================================================
// BASE ERROR CLASS
// ============================================================================

export abstract class RateLimitError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  
  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// ============================================================================
// CONFIGURATION ERRORS
// ============================================================================

export class InvalidConfigError extends RateLimitError {
  readonly code = 'INVALID_CONFIG';
  readonly statusCode = 500;
  
  constructor(message: string, configName?: string) {
    super(message, { configName });
  }
}

export class MissingConfigError extends RateLimitError {
  readonly code = 'MISSING_CONFIG';
  readonly statusCode = 500;
  
  constructor(configName: string) {
    super(`Rate limit configuration '${configName}' not found`, { configName });
  }
}

export class ConflictingConfigError extends RateLimitError {
  readonly code = 'CONFLICTING_CONFIG';
  readonly statusCode = 500;
  
  constructor(message: string, configs?: string[]) {
    super(message, { configs });
  }
}

// ============================================================================
// ALGORITHM ERRORS
// ============================================================================

export class AlgorithmError extends RateLimitError {
  readonly code = 'ALGORITHM_ERROR';
  readonly statusCode = 500;
  
  constructor(algorithm: string, message: string) {
    super(`Error in ${algorithm} algorithm: ${message}`, { algorithm });
  }
}

export class UnsupportedAlgorithmError extends RateLimitError {
  readonly code = 'UNSUPPORTED_ALGORITHM';
  readonly statusCode = 500;
  
  constructor(algorithm: string) {
    super(`Unsupported rate limiting algorithm: ${algorithm}`, { algorithm });
  }
}

// ============================================================================
// STORAGE ERRORS
// ============================================================================

export class StorageError extends RateLimitError {
  readonly code = 'STORAGE_ERROR';
  readonly statusCode = 503;
  
  constructor(message: string, operation?: string) {
    super(message, { operation });
  }
}

export class StorageConnectionError extends StorageError {
  readonly code = 'STORAGE_CONNECTION_ERROR';
  readonly statusCode = 503;
  
  constructor(message: string) {
    super(message, 'connection');
  }
}

export class StorageTimeoutError extends StorageError {
  readonly code = 'STORAGE_TIMEOUT';
  readonly statusCode = 503;
  
  constructor(operation: string, timeout: number) {
    super(`Storage operation '${operation}' timed out after ${timeout}ms`, operation);
  }
}

export class BucketNotFoundError extends StorageError {
  readonly code = 'BUCKET_NOT_FOUND';
  readonly statusCode = 404;
  
  constructor(bucketId: string) {
    super(`Rate limit bucket not found: ${bucketId}`, 'getBucket');
  }
}

// ============================================================================
// POLICY ERRORS
// ============================================================================

export class PolicyError extends RateLimitError {
  readonly code = 'POLICY_ERROR';
  readonly statusCode = 500;
  
  constructor(message: string, policyName?: string) {
    super(message, { policyName });
  }
}

export class PolicyEvaluationError extends PolicyError {
  readonly code = 'POLICY_EVALUATION_ERROR';
  readonly statusCode = 500;
  
  constructor(policyName: string, reason: string) {
    super(`Policy evaluation failed for '${policyName}': ${reason}`, policyName);
  }
}

export class CircularPolicyReferenceError extends PolicyError {
  readonly code = 'CIRCULAR_POLICY_REFERENCE';
  readonly statusCode = 500;
  
  constructor(policyChain: string[]) {
    super(`Circular reference detected in policy chain: ${policyChain.join(' -> ')}`);
  }
}

// ============================================================================
// MIDDLEWARE ERRORS
// ============================================================================

export class MiddlewareError extends RateLimitError {
  readonly code = 'MIDDLEWARE_ERROR';
  readonly statusCode = 500;
  
  constructor(message: string, middlewareName?: string) {
    super(message, { middlewareName });
  }
}

export class KeyExtractionError extends MiddlewareError {
  readonly code = 'KEY_EXTRACTION_ERROR';
  readonly statusCode = 400;
  
  constructor(message: string, extractorType?: string) {
    super(message, extractorType);
  }
}

export class InvalidRequestError extends MiddlewareError {
  readonly code = 'INVALID_REQUEST';
  readonly statusCode = 400;
  
  constructor(message: string, field?: string) {
    super(message, undefined, { field });
  }
}

// ============================================================================
// RATE LIMIT EXCEEDED ERRORS
// ============================================================================

export class RateLimitExceededError extends RateLimitError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  
  constructor(
    message: string,
    public readonly retryAfter?: number,
    public readonly limit?: number,
    public readonly remaining?: number,
    public readonly resetAt?: Date,
    public readonly bucketId?: string
  ) {
    super(message, {
      retryAfter,
      limit,
      remaining,
      resetAt: resetAt?.toISOString(),
      bucketId
    });
  }
}

export class RateLimitWarnedError extends RateLimitError {
  readonly code = 'RATE_LIMIT_WARNING';
  readonly statusCode = 200;
  
  constructor(
    message: string,
    public readonly threshold: number,
    public readonly current: number,
    public readonly remaining: number
  ) {
    super(message, {
      threshold,
      current,
      remaining
    });
  }
}

export class RateLimitThrottledError extends RateLimitError {
  readonly code = 'RATE_LIMIT_THROTTLED';
  readonly statusCode = 429;
  
  constructor(
    message: string,
    public readonly retryAfter: number,
    public readonly throttleDelay: number
  ) {
    super(message, {
      retryAfter,
      throttleDelay
    });
  }
}

export class RateLimitBlockedError extends RateLimitError {
  readonly code = 'RATE_LIMIT_BLOCKED';
  readonly statusCode = 429;
  
  constructor(
    message: string,
    public readonly blockedUntil: Date,
    public readonly reason?: string
  ) {
    super(message, {
      blockedUntil: blockedUntil.toISOString(),
      reason
    });
  }
}

// ============================================================================
// VALIDATION ERRORS
// ============================================================================

export class ValidationError extends RateLimitError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  
  constructor(message: string, field?: string, value?: any) {
    super(message, { field, value });
  }
}

export class InvalidIdentifierError extends ValidationError {
  readonly code = 'INVALID_IDENTIFIER';
  readonly statusCode = 400;
  
  constructor(identifier: string, type?: string) {
    super(`Invalid identifier: ${identifier}`, 'identifier', { type });
  }
}

export class InvalidWindowError extends ValidationError {
  readonly code = 'INVALID_WINDOW';
  readonly statusCode = 400;
  
  constructor(windowMs: number) {
    super(`Invalid window duration: ${windowMs}ms (must be positive)`, 'windowMs', windowMs);
  }
}

export class InvalidLimitError extends ValidationError {
  readonly code = 'INVALID_LIMIT';
  readonly statusCode = 400;
  
  constructor(limit: number) {
    super(`Invalid limit: ${limit} (must be positive)`, 'limit', limit);
  }
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

export class ErrorFactory {
  static createRateLimitExceeded(
    configName: string,
    retryAfter: number,
    limit: number,
    remaining: number,
    resetAt: Date,
    bucketId: string
  ): RateLimitExceededError {
    return new RateLimitExceededError(
      `Rate limit exceeded for config '${configName}'`,
      retryAfter,
      limit,
      remaining,
      resetAt,
      bucketId
    );
  }

  static createRateLimitThrottled(
    configName: string,
    retryAfter: number,
    throttleDelay: number
  ): RateLimitThrottledError {
    return new RateLimitThrottledError(
      `Request throttled for config '${configName}'`,
      retryAfter,
      throttleDelay
    );
  }

  static createRateLimitBlocked(
    key: string,
    blockedUntil: Date,
    reason?: string
  ): RateLimitBlockedError {
    return new RateLimitBlockedError(
      `Key '${key}' is blocked until ${blockedUntil.toISOString()}`,
      blockedUntil,
      reason
    );
  }

  static createInvalidConfig(
    field: string,
    value: any,
    expected?: string
  ): InvalidConfigError {
    const message = expected 
      ? `Invalid ${field}: ${value} (expected: ${expected})`
      : `Invalid ${field}: ${value}`;
    return new InvalidConfigError(message);
  }

  static createStorageError(
    operation: string,
    underlyingError: Error
  ): StorageError {
    return new StorageError(
      `Storage operation '${operation}' failed: ${underlyingError.message}`,
      operation
    );
  }
}

// ============================================================================
// ERROR UTILITIES
// ============================================================================

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isRateLimitExceeded(error: unknown): error is RateLimitExceededError {
  return error instanceof RateLimitExceededError;
}

export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

export function isConfigError(error: unknown): error is InvalidConfigError | MissingConfigError | ConflictingConfigError {
  return error instanceof InvalidConfigError || 
         error instanceof MissingConfigError || 
         error instanceof ConflictingConfigError;
}

export function getErrorContext(error: RateLimitError): Record<string, any> {
  return {
    code: error.code,
    statusCode: error.statusCode,
    message: error.message,
    context: error.context,
    stack: error.stack
  };
}
