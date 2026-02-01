/**
 * ISL Errors - Exception hierarchy for ISL SDK.
 */

/**
 * Base error for all ISL SDK errors
 */
export class ISLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ISLError';
    Object.setPrototypeOf(this, ISLError.prototype);
  }
}

/**
 * Validation error for input data
 */
export class ValidationError extends ISLError {
  readonly field?: string;
  readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Precondition violation error
 */
export class PreconditionError extends ISLError {
  readonly precondition: string;
  readonly actualValue?: unknown;

  constructor(message: string, precondition: string, actualValue?: unknown) {
    super(`Precondition violated: ${message}`);
    this.name = 'PreconditionError';
    this.precondition = precondition;
    this.actualValue = actualValue;
    Object.setPrototypeOf(this, PreconditionError.prototype);
  }
}

/**
 * Postcondition violation error
 */
export class PostconditionError extends ISLError {
  readonly postcondition: string;
  readonly expectedValue?: unknown;
  readonly actualValue?: unknown;

  constructor(
    message: string,
    postcondition: string,
    expectedValue?: unknown,
    actualValue?: unknown
  ) {
    super(`Postcondition violated: ${message}`);
    this.name = 'PostconditionError';
    this.postcondition = postcondition;
    this.expectedValue = expectedValue;
    this.actualValue = actualValue;
    Object.setPrototypeOf(this, PostconditionError.prototype);
  }
}

/**
 * Network error
 */
export class NetworkError extends ISLError {
  readonly cause?: Error;
  readonly isTimeout: boolean;
  readonly isConnectionError: boolean;

  constructor(
    message: string,
    cause?: Error,
    isTimeout = false,
    isConnectionError = false
  ) {
    super(`Network error: ${message}`);
    this.name = 'NetworkError';
    this.cause = cause;
    this.isTimeout = isTimeout;
    this.isConnectionError = isConnectionError;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Server error (5xx)
 */
export class ServerError extends ISLError {
  readonly statusCode?: number;
  readonly errorCode?: string;

  constructor(message: string, statusCode?: number, errorCode?: string) {
    super(`Server error: ${message}`);
    this.name = 'ServerError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends ISLError {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends ISLError {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends ISLError {
  readonly resourceType?: string;
  readonly resourceId?: string;

  constructor(message = 'Resource not found', resourceType?: string, resourceId?: string) {
    super(message);
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends ISLError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = 'Rate limited') {
    super(`${message}. Retry after ${retryAfterSeconds} seconds`);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
