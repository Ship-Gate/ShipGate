// ============================================================================
// ISL Custom Error Classes
// ============================================================================

import type { CheckType } from './types';

/**
 * Base class for all ISL errors
 */
export abstract class ISLError extends Error {
  abstract readonly code: string;
  readonly domain: string;
  readonly behavior?: string;
  readonly timestamp: number;

  constructor(
    message: string,
    domain: string,
    behavior?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.domain = domain;
    this.behavior = behavior;
    this.timestamp = Date.now();

    // Maintains proper stack trace for where error was thrown
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
      domain: this.domain,
      behavior: this.behavior,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when a precondition check fails
 */
export class PreconditionError extends ISLError {
  readonly code = 'ISL_PRECONDITION_FAILED';
  readonly checkType: CheckType = 'precondition';
  readonly expression: string;
  readonly input?: unknown;

  constructor(
    expression: string,
    domain: string,
    behavior: string,
    input?: unknown
  ) {
    super(`Precondition failed: ${expression}`, domain, behavior);
    this.expression = expression;
    this.input = input;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      checkType: this.checkType,
      expression: this.expression,
    };
  }
}

/**
 * Error thrown when a postcondition check fails
 */
export class PostconditionError extends ISLError {
  readonly code = 'ISL_POSTCONDITION_FAILED';
  readonly checkType: CheckType = 'postcondition';
  readonly expression: string;
  readonly input?: unknown;
  readonly output?: unknown;

  constructor(
    expression: string,
    domain: string,
    behavior: string,
    input?: unknown,
    output?: unknown
  ) {
    super(`Postcondition failed: ${expression}`, domain, behavior);
    this.expression = expression;
    this.input = input;
    this.output = output;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      checkType: this.checkType,
      expression: this.expression,
    };
  }
}

/**
 * Error thrown when an invariant is violated
 */
export class InvariantError extends ISLError {
  readonly code = 'ISL_INVARIANT_VIOLATED';
  readonly checkType: CheckType = 'invariant';
  readonly expression: string;
  readonly state?: unknown;

  constructor(
    expression: string,
    domain: string,
    state?: unknown
  ) {
    super(`Invariant violated: ${expression}`, domain);
    this.expression = expression;
    this.state = state;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      checkType: this.checkType,
      expression: this.expression,
    };
  }
}

/**
 * Error thrown when a temporal property is violated
 */
export class TemporalError extends ISLError {
  readonly code = 'ISL_TEMPORAL_VIOLATED';
  readonly checkType: CheckType = 'temporal';
  readonly expression: string;
  readonly property: string;
  readonly timeline?: unknown[];

  constructor(
    expression: string,
    property: string,
    domain: string,
    behavior?: string,
    timeline?: unknown[]
  ) {
    super(`Temporal property violated: ${property} - ${expression}`, domain, behavior);
    this.expression = expression;
    this.property = property;
    this.timeline = timeline;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      checkType: this.checkType,
      expression: this.expression,
      property: this.property,
    };
  }
}

/**
 * Error thrown when verification fails
 */
export class VerificationError extends ISLError {
  readonly code = 'ISL_VERIFICATION_FAILED';
  readonly verdict: string;
  readonly score: number;
  readonly failedChecks: string[];

  constructor(
    domain: string,
    behavior: string,
    verdict: string,
    score: number,
    failedChecks: string[]
  ) {
    super(
      `Verification failed for ${domain}.${behavior}: ${verdict} (score: ${score})`,
      domain,
      behavior
    );
    this.verdict = verdict;
    this.score = score;
    this.failedChecks = failedChecks;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      verdict: this.verdict,
      score: this.score,
      failedChecks: this.failedChecks,
    };
  }
}

/**
 * Type guard to check if an error is an ISL error
 */
export function isISLError(error: unknown): error is ISLError {
  return error instanceof ISLError;
}

/**
 * Type guard for precondition errors
 */
export function isPreconditionError(error: unknown): error is PreconditionError {
  return error instanceof PreconditionError;
}

/**
 * Type guard for postcondition errors
 */
export function isPostconditionError(error: unknown): error is PostconditionError {
  return error instanceof PostconditionError;
}

/**
 * Type guard for invariant errors
 */
export function isInvariantError(error: unknown): error is InvariantError {
  return error instanceof InvariantError;
}

/**
 * Type guard for temporal errors
 */
export function isTemporalError(error: unknown): error is TemporalError {
  return error instanceof TemporalError;
}

/**
 * Type guard for verification errors
 */
export function isVerificationError(error: unknown): error is VerificationError {
  return error instanceof VerificationError;
}
