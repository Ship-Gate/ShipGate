/**
 * Shared Error Model
 *
 * Canonical error hierarchy used by all SDK targets.
 * Platform skins re-export these — never redefine them.
 */

import type {
  ValidationFieldError,
  ISLErrorType,
} from './types.js';

// ============================================================================
// Base Error
// ============================================================================

export class ISLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ISLError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Validation
// ============================================================================

export class ValidationError extends ISLError {
  readonly field?: string;
  readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

// ============================================================================
// Precondition / Postcondition
// ============================================================================

export class PreconditionError extends ISLError {
  readonly precondition: string;
  readonly actualValue?: unknown;

  constructor(message: string, precondition: string, actualValue?: unknown) {
    super(`Precondition violated: ${message}`);
    this.name = 'PreconditionError';
    this.precondition = precondition;
    this.actualValue = actualValue;
  }
}

export class PostconditionError extends ISLError {
  readonly postcondition: string;
  readonly expectedValue?: unknown;
  readonly actualValue?: unknown;

  constructor(
    message: string,
    postcondition: string,
    expectedValue?: unknown,
    actualValue?: unknown,
  ) {
    super(`Postcondition violated: ${message}`);
    this.name = 'PostconditionError';
    this.postcondition = postcondition;
    this.expectedValue = expectedValue;
    this.actualValue = actualValue;
  }
}

// ============================================================================
// Network / Transport
// ============================================================================

export class NetworkError extends ISLError {
  readonly cause?: Error;
  readonly isTimeout: boolean;
  readonly isConnectionError: boolean;

  constructor(
    message: string,
    cause?: Error,
    isTimeout = false,
    isConnectionError = false,
  ) {
    super(`Network error: ${message}`);
    this.name = 'NetworkError';
    this.cause = cause;
    this.isTimeout = isTimeout;
    this.isConnectionError = isConnectionError;
  }
}

// ============================================================================
// Server / HTTP
// ============================================================================

export class ServerError extends ISLError {
  readonly statusCode?: number;
  readonly errorCode?: string;

  constructor(message: string, statusCode?: number, errorCode?: string) {
    super(`Server error: ${message}`);
    this.name = 'ServerError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class ApiError extends ISLError {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown,
    public readonly headers: Headers,
  ) {
    super(`API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

// ============================================================================
// Auth
// ============================================================================

export class UnauthorizedError extends ISLError {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ISLError {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// ============================================================================
// Resource
// ============================================================================

export class NotFoundError extends ISLError {
  readonly resourceType?: string;
  readonly resourceId?: string;

  constructor(message = 'Resource not found', resourceType?: string, resourceId?: string) {
    super(message);
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

export class RateLimitError extends ISLError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Rate limited') {
    super(`${message}. Retry after ${retryAfterSeconds} seconds`);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert an ISLErrorType (discriminated-union shape) into a proper Error instance.
 */
export function toISLError(err: ISLErrorType): ISLError {
  switch (err.code) {
    case 'NETWORK_ERROR':
      return new NetworkError(err.message, undefined, false, true);
    case 'TIMEOUT':
      return new NetworkError(err.message, undefined, true, false);
    case 'VALIDATION_ERROR':
      return new ValidationError(
        err.message,
        (err as { errors: ValidationFieldError[] }).errors?.[0]?.field,
      );
    case 'AUTH_ERROR':
    case 'TOKEN_EXPIRED':
    case 'UNAUTHORIZED':
      return new UnauthorizedError(err.message);
    case 'RATE_LIMITED':
      return new RateLimitError(
        (err as { retryAfter: number }).retryAfter ?? 60,
        err.message,
      );
    default:
      return new ServerError(
        err.message,
        (err as { statusCode?: number }).statusCode,
        err.code,
      );
  }
}

/**
 * Map an HTTP status code to the appropriate ISLError subclass.
 */
export function errorFromStatus(status: number, body: unknown, headers: Headers): ISLError {
  const message = typeof body === 'object' && body !== null && 'message' in body
    ? String((body as { message: string }).message)
    : `HTTP ${status}`;

  switch (status) {
    case 401:
      return new UnauthorizedError(message);
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message);
    case 429: {
      const retryAfter = parseInt(headers.get('Retry-After') ?? '60', 10);
      return new RateLimitError(retryAfter, message);
    }
    default:
      if (status >= 500) return new ServerError(message, status);
      return new ApiError(status, message, body, headers);
  }
}
