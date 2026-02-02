// ============================================================================
// Runtime Verify Errors - Typed Error Classes
// ============================================================================

import type { VerificationContext } from './types';

/**
 * Error codes for verification failures
 */
export const ErrorCode = {
  // Precondition errors
  PRECONDITION_FAILED: 'PRECONDITION_FAILED',
  PRECONDITION_TYPE_ERROR: 'PRECONDITION_TYPE_ERROR',
  PRECONDITION_RANGE_ERROR: 'PRECONDITION_RANGE_ERROR',
  PRECONDITION_NULL_ERROR: 'PRECONDITION_NULL_ERROR',
  
  // Postcondition errors
  POSTCONDITION_FAILED: 'POSTCONDITION_FAILED',
  POSTCONDITION_TYPE_ERROR: 'POSTCONDITION_TYPE_ERROR',
  POSTCONDITION_RESULT_ERROR: 'POSTCONDITION_RESULT_ERROR',
  
  // Invariant errors
  INVARIANT_FAILED: 'INVARIANT_FAILED',
  INVARIANT_STATE_ERROR: 'INVARIANT_STATE_ERROR',
  INVARIANT_CONSISTENCY_ERROR: 'INVARIANT_CONSISTENCY_ERROR',
  
  // General errors
  ASSERTION_ERROR: 'ASSERTION_ERROR',
  EVALUATION_ERROR: 'EVALUATION_ERROR',
  HOOK_ERROR: 'HOOK_ERROR',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Base class for all verification errors
 */
export class VerifyError extends Error {
  readonly code: ErrorCodeType;
  readonly retriable: boolean;
  readonly context?: VerificationContext;
  readonly timestamp: number;
  readonly expression?: string;

  constructor(
    code: ErrorCodeType,
    message: string,
    options?: {
      retriable?: boolean;
      context?: VerificationContext;
      expression?: string;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'VerifyError';
    this.code = code;
    this.retriable = options?.retriable ?? false;
    this.context = options?.context;
    this.expression = options?.expression;
    this.timestamp = Date.now();
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retriable: this.retriable,
      context: this.context,
      expression: this.expression,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Precondition violation error
 */
export class PreconditionError extends VerifyError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      retriable?: boolean;
      context?: VerificationContext;
      expression?: string;
      cause?: Error;
    }
  ) {
    super(
      options?.code ?? ErrorCode.PRECONDITION_FAILED,
      message,
      options
    );
    this.name = 'PreconditionError';
  }
}

/**
 * Postcondition violation error
 */
export class PostconditionError extends VerifyError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      retriable?: boolean;
      context?: VerificationContext;
      expression?: string;
      cause?: Error;
    }
  ) {
    super(
      options?.code ?? ErrorCode.POSTCONDITION_FAILED,
      message,
      options
    );
    this.name = 'PostconditionError';
  }
}

/**
 * Invariant violation error
 */
export class InvariantError extends VerifyError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      retriable?: boolean;
      context?: VerificationContext;
      expression?: string;
      cause?: Error;
    }
  ) {
    super(
      options?.code ?? ErrorCode.INVARIANT_FAILED,
      message,
      options
    );
    this.name = 'InvariantError';
  }
}

/**
 * Hook execution error
 */
export class HookError extends VerifyError {
  constructor(
    message: string,
    options?: {
      context?: VerificationContext;
      cause?: Error;
    }
  ) {
    super(ErrorCode.HOOK_ERROR, message, {
      retriable: false,
      ...options,
    });
    this.name = 'HookError';
  }
}

/**
 * Expression evaluation error
 */
export class EvaluationError extends VerifyError {
  constructor(
    message: string,
    options?: {
      context?: VerificationContext;
      expression?: string;
      cause?: Error;
    }
  ) {
    super(ErrorCode.EVALUATION_ERROR, message, {
      retriable: false,
      ...options,
    });
    this.name = 'EvaluationError';
  }
}

/**
 * Type guard for VerifyError
 */
export function isVerifyError(error: unknown): error is VerifyError {
  return error instanceof VerifyError;
}

/**
 * Type guard for PreconditionError
 */
export function isPreconditionError(error: unknown): error is PreconditionError {
  return error instanceof PreconditionError;
}

/**
 * Type guard for PostconditionError
 */
export function isPostconditionError(error: unknown): error is PostconditionError {
  return error instanceof PostconditionError;
}

/**
 * Type guard for InvariantError
 */
export function isInvariantError(error: unknown): error is InvariantError {
  return error instanceof InvariantError;
}

/**
 * Format a verification error for display
 */
export function formatVerifyError(error: VerifyError): string {
  const lines: string[] = [
    `${error.name} [${error.code}]: ${error.message}`,
  ];
  
  if (error.expression) {
    lines.push(`  Expression: ${error.expression}`);
  }
  
  if (error.context) {
    if (error.context.input) {
      lines.push(`  Input: ${JSON.stringify(error.context.input)}`);
    }
    if (error.context.result !== undefined) {
      lines.push(`  Result: ${JSON.stringify(error.context.result)}`);
    }
    if (error.context.state) {
      lines.push(`  State: ${JSON.stringify(error.context.state)}`);
    }
  }
  
  return lines.join('\n');
}
