/**
 * Error Generator
 *
 * Generate error responses based on ISL error definitions.
 */

export interface ErrorGeneratorOptions {
  /** Include stack traces in development */
  includeStackTrace?: boolean;
  /** Include timestamp in error response */
  includeTimestamp?: boolean;
  /** Include request ID in error response */
  includeRequestId?: boolean;
}

export interface ErrorDefinition {
  /** Error code/name */
  name: string;
  /** Human-readable message */
  message: string;
  /** HTTP status code */
  status: number;
  /** Whether the operation can be retried */
  retriable: boolean;
  /** Retry delay in milliseconds */
  retryAfter?: number;
  /** Additional error details */
  details?: Record<string, unknown>;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retriable: boolean;
    retryAfter?: number;
  };
  timestamp?: string;
  requestId?: string;
}

export class ErrorGenerator {
  private options: Required<ErrorGeneratorOptions>;
  private predefinedErrors: Map<string, ErrorDefinition>;

  constructor(options: ErrorGeneratorOptions = {}) {
    this.options = {
      includeStackTrace: options.includeStackTrace ?? false,
      includeTimestamp: options.includeTimestamp ?? true,
      includeRequestId: options.includeRequestId ?? true,
    };

    this.predefinedErrors = new Map();
    this.registerCommonErrors();
  }

  private registerCommonErrors(): void {
    // Authentication errors
    this.registerError({
      name: 'UNAUTHORIZED',
      message: 'Authentication required',
      status: 401,
      retriable: false,
    });

    this.registerError({
      name: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      status: 401,
      retriable: true,
      retryAfter: 1000,
    });

    this.registerError({
      name: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
      status: 401,
      retriable: true,
    });

    this.registerError({
      name: 'FORBIDDEN',
      message: 'Access denied',
      status: 403,
      retriable: false,
    });

    // Resource errors
    this.registerError({
      name: 'NOT_FOUND',
      message: 'Resource not found',
      status: 404,
      retriable: false,
    });

    this.registerError({
      name: 'ALREADY_EXISTS',
      message: 'Resource already exists',
      status: 409,
      retriable: false,
    });

    this.registerError({
      name: 'DUPLICATE_EMAIL',
      message: 'Email address already in use',
      status: 409,
      retriable: false,
    });

    // Validation errors
    this.registerError({
      name: 'VALIDATION_ERROR',
      message: 'Validation failed',
      status: 400,
      retriable: true,
    });

    this.registerError({
      name: 'INVALID_INPUT',
      message: 'Invalid input provided',
      status: 400,
      retriable: true,
    });

    this.registerError({
      name: 'MISSING_FIELD',
      message: 'Required field is missing',
      status: 400,
      retriable: true,
    });

    // Rate limiting
    this.registerError({
      name: 'RATE_LIMITED',
      message: 'Too many requests',
      status: 429,
      retriable: true,
      retryAfter: 60000,
    });

    // Server errors
    this.registerError({
      name: 'INTERNAL_ERROR',
      message: 'Internal server error',
      status: 500,
      retriable: true,
      retryAfter: 5000,
    });

    this.registerError({
      name: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
      status: 503,
      retriable: true,
      retryAfter: 30000,
    });

    this.registerError({
      name: 'TIMEOUT',
      message: 'Request timed out',
      status: 504,
      retriable: true,
      retryAfter: 1000,
    });

    // Business logic errors
    this.registerError({
      name: 'INSUFFICIENT_BALANCE',
      message: 'Insufficient balance',
      status: 400,
      retriable: false,
    });

    this.registerError({
      name: 'PAYMENT_FAILED',
      message: 'Payment processing failed',
      status: 402,
      retriable: true,
      retryAfter: 5000,
    });

    this.registerError({
      name: 'USER_LOCKED',
      message: 'User account is locked',
      status: 403,
      retriable: true,
      retryAfter: 900000, // 15 minutes
    });

    this.registerError({
      name: 'USER_INACTIVE',
      message: 'User account is inactive',
      status: 403,
      retriable: false,
    });
  }

  /**
   * Register a custom error definition
   */
  registerError(error: ErrorDefinition): void {
    this.predefinedErrors.set(error.name, error);
  }

  /**
   * Get a predefined error by name
   */
  getError(name: string): ErrorDefinition | undefined {
    return this.predefinedErrors.get(name);
  }

  /**
   * Generate an error response
   */
  generateError(
    name: string,
    details?: Record<string, unknown>
  ): { status: number; body: ErrorResponse } {
    const predefined = this.predefinedErrors.get(name);

    const error: ErrorDefinition = predefined ?? {
      name,
      message: this.nameToMessage(name),
      status: 400,
      retriable: false,
    };

    const response: ErrorResponse = {
      error: {
        code: error.name,
        message: error.message,
        retriable: error.retriable,
      },
    };

    if (error.retryAfter) {
      response.error.retryAfter = error.retryAfter;
    }

    if (details || error.details) {
      response.error.details = { ...error.details, ...details };
    }

    if (this.options.includeTimestamp) {
      response.timestamp = new Date().toISOString();
    }

    if (this.options.includeRequestId) {
      response.requestId = this.generateRequestId();
    }

    return {
      status: error.status,
      body: response,
    };
  }

  /**
   * Generate validation error response
   */
  generateValidationError(
    fields: Array<{ field: string; message: string }>
  ): { status: number; body: ErrorResponse } {
    return this.generateError('VALIDATION_ERROR', {
      fields: fields.map((f) => ({
        field: f.field,
        message: f.message,
      })),
    });
  }

  /**
   * Generate not found error for a specific resource
   */
  generateNotFoundError(
    resource: string,
    id?: string
  ): { status: number; body: ErrorResponse } {
    return this.generateError('NOT_FOUND', {
      resource,
      id,
      message: `${resource} not found${id ? `: ${id}` : ''}`,
    });
  }

  /**
   * Generate rate limit error
   */
  generateRateLimitError(
    retryAfter: number = 60000
  ): { status: number; body: ErrorResponse } {
    const error = this.generateError('RATE_LIMITED');
    error.body.error.retryAfter = retryAfter;
    return error;
  }

  /**
   * Generate random error for chaos testing
   */
  generateRandomError(): { status: number; body: ErrorResponse } {
    const errors = Array.from(this.predefinedErrors.keys());
    const randomError = errors[Math.floor(Math.random() * errors.length)] ?? 'INTERNAL_ERROR';
    return this.generateError(randomError);
  }

  /**
   * Generate error with probability (for chaos testing)
   */
  maybeGenerateError(
    probability: number = 0.1
  ): { status: number; body: ErrorResponse } | null {
    if (Math.random() < probability) {
      return this.generateRandomError();
    }
    return null;
  }

  /**
   * Convert error name to human-readable message
   */
  private nameToMessage(name: string): string {
    return name
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  /**
   * Generate a request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * List all registered errors
   */
  listErrors(): ErrorDefinition[] {
    return Array.from(this.predefinedErrors.values());
  }

  /**
   * Check if an error is retriable
   */
  isRetriable(name: string): boolean {
    const error = this.predefinedErrors.get(name);
    return error?.retriable ?? false;
  }

  /**
   * Get retry delay for an error
   */
  getRetryDelay(name: string): number | undefined {
    const error = this.predefinedErrors.get(name);
    return error?.retryAfter;
  }
}
