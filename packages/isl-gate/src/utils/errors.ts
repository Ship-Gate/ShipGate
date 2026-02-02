/**
 * ISL Gate - Error Types
 * 
 * Structured error handling with error codes, context, and recovery hints.
 * 
 * @module @isl-lang/gate/utils/errors
 */

/**
 * Error codes for ISL Gate errors
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'GATE_BLOCKED'
  | 'EVIDENCE_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'TIMEOUT'
  | 'RESOURCE_NOT_FOUND'
  | 'PARSE_ERROR'
  | 'INTERNAL_ERROR';

/**
 * Error context
 */
export interface ErrorContext {
  code: ErrorCode;
  component: string;
  operation: string;
  details?: Record<string, unknown>;
  recoveryHint?: string;
  retryable?: boolean;
}

/**
 * Base error class for ISL Gate errors
 */
export class ISLGateError extends Error {
  public readonly code: ErrorCode;
  public readonly component: string;
  public readonly operation: string;
  public readonly details: Record<string, unknown>;
  public readonly recoveryHint?: string;
  public readonly retryable: boolean;
  public readonly timestamp: Date;
  public readonly cause?: Error;

  constructor(message: string, context: ErrorContext, cause?: Error) {
    super(message);
    this.name = 'ISLGateError';
    this.code = context.code;
    this.component = context.component;
    this.operation = context.operation;
    this.details = context.details ?? {};
    this.recoveryHint = context.recoveryHint;
    this.retryable = context.retryable ?? false;
    this.timestamp = new Date();
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ISLGateError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      component: this.component,
      operation: this.operation,
      details: this.details,
      recoveryHint: this.recoveryHint,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause?.message,
    };
  }

  toString(): string {
    return `[${this.code}] ${this.component}.${this.operation}: ${this.message}`;
  }
}

/**
 * Validation error for invalid inputs
 */
export class ValidationError extends ISLGateError {
  public readonly field?: string;
  public readonly value?: unknown;
  public readonly constraints?: string[];

  constructor(
    message: string,
    options: {
      component: string;
      operation: string;
      field?: string;
      value?: unknown;
      constraints?: string[];
      recoveryHint?: string;
    }
  ) {
    super(message, {
      code: 'VALIDATION_ERROR',
      component: options.component,
      operation: options.operation,
      details: { field: options.field, constraints: options.constraints },
      recoveryHint: options.recoveryHint ?? `Check the ${options.field ?? 'input'} value`,
      retryable: false,
    });
    this.name = 'ValidationError';
    this.field = options.field;
    this.value = options.value;
    this.constraints = options.constraints;
  }
}

/**
 * Gate blocked error - when NO_SHIP verdict is given
 */
export class GateBlockedError extends ISLGateError {
  public readonly violations: Array<{ code: string; message: string; severity: string }>;
  public readonly score: number;

  constructor(
    message: string,
    options: {
      violations: Array<{ code: string; message: string; severity: string }>;
      score: number;
      recoveryHint?: string;
    }
  ) {
    super(message, {
      code: 'GATE_BLOCKED',
      component: 'Gate',
      operation: 'evaluate',
      details: { violationCount: options.violations.length, score: options.score },
      recoveryHint: options.recoveryHint ?? 'Review the violations and fix the identified issues',
      retryable: false,
    });
    this.name = 'GateBlockedError';
    this.violations = options.violations;
    this.score = options.score;
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends ISLGateError {
  public readonly timeoutMs: number;
  public readonly elapsed: number;

  constructor(
    message: string,
    options: {
      component: string;
      operation: string;
      timeoutMs: number;
      elapsed: number;
    }
  ) {
    super(message, {
      code: 'TIMEOUT',
      component: options.component,
      operation: options.operation,
      details: { timeoutMs: options.timeoutMs, elapsed: options.elapsed },
      recoveryHint: 'Consider increasing timeout or optimizing the operation',
      retryable: true,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = options.timeoutMs;
    this.elapsed = options.elapsed;
  }
}

/**
 * Configuration error
 */
export class ConfigError extends ISLGateError {
  public readonly configKey?: string;

  constructor(
    message: string,
    options: {
      component: string;
      configKey?: string;
      recoveryHint?: string;
    }
  ) {
    super(message, {
      code: 'CONFIG_INVALID',
      component: options.component,
      operation: 'configure',
      details: { configKey: options.configKey },
      recoveryHint: options.recoveryHint ?? 'Check configuration values',
      retryable: false,
    });
    this.name = 'ConfigError';
    this.configKey = options.configKey;
  }
}

/**
 * Check if an error is an ISLGateError
 */
export function isISLGateError(error: unknown): error is ISLGateError {
  return error instanceof ISLGateError;
}

/**
 * Wrap unknown errors in an ISLGateError
 */
export function wrapError(
  error: unknown,
  context: { component: string; operation: string }
): ISLGateError {
  if (isISLGateError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new ISLGateError(message, {
    code: 'INTERNAL_ERROR',
    component: context.component,
    operation: context.operation,
    retryable: false,
  }, cause);
}
