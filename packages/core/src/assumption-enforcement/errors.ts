/**
 * Assumption Enforcement Errors
 *
 * Thrown when an implicit assumption is violated at runtime.
 * Fail loudly: these errors are not retriable and indicate invalid input or environment.
 */

export const AssumptionViolationCode = {
  WORKSPACE_PATH_INVALID: 'ASSUMPTION_WORKSPACE_PATH_INVALID',
  PIPELINE_INPUT_INVALID: 'ASSUMPTION_PIPELINE_INPUT_INVALID',
  AST_INVALID: 'ASSUMPTION_AST_INVALID',
  OUT_DIR_NOT_WRITABLE: 'ASSUMPTION_OUT_DIR_NOT_WRITABLE',
  STATE_NOT_SERIALIZABLE: 'ASSUMPTION_STATE_NOT_SERIALIZABLE',
  IMPLEMENTATION_NOT_ACCESSIBLE: 'ASSUMPTION_IMPLEMENTATION_NOT_ACCESSIBLE',
  REQUIRED_PACKAGE_MISSING: 'ASSUMPTION_REQUIRED_PACKAGE_MISSING',
  SKIPPED_STEP_IN_STRICT: 'ASSUMPTION_SKIPPED_STEP_IN_STRICT',
} as const;

export type AssumptionViolationCodeType =
  (typeof AssumptionViolationCode)[keyof typeof AssumptionViolationCode];

export interface AssumptionViolationContext {
  assumptionId?: string;
  [key: string]: unknown;
}

/**
 * Error thrown when an enforced assumption is violated.
 * Use for failing loudly on invalid workspace, input, AST, or state.
 */
export class AssumptionViolationError extends Error {
  readonly code: AssumptionViolationCodeType;
  readonly assumptionId: string;
  readonly context: AssumptionViolationContext;

  constructor(
    code: AssumptionViolationCodeType,
    message: string,
    options?: {
      assumptionId?: string;
      context?: AssumptionViolationContext;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AssumptionViolationError';
    this.code = code;
    this.assumptionId = options?.assumptionId ?? code;
    this.context = options?.context ?? {};

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      assumptionId: this.assumptionId,
      context: this.context,
    };
  }
}

export function isAssumptionViolationError(
  err: unknown
): err is AssumptionViolationError {
  return err instanceof AssumptionViolationError;
}
