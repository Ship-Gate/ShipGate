/**
 * Exit Codes
 * 
 * Standardized exit codes for the ISL CLI.
 * 
 * @see https://tldp.org/LDP/abs/html/exitcodes.html
 */

// ─────────────────────────────────────────────────────────────────────────────
// Exit Code Constants
// ─────────────────────────────────────────────────────────────────────────────

export const ExitCode = {
  /** Success - command completed successfully (SHIP) */
  SUCCESS: 0,
  
  /** ISL Error - parse, type check, or verification failure (NO_SHIP) */
  ISL_ERROR: 1,
  
  /** Usage Error - bad flags, missing file, invalid arguments */
  USAGE_ERROR: 2,
  
  /** Internal Error - bugs, unexpected errors */
  INTERNAL_ERROR: 3,

  /** Warning - non-critical issues detected (for --fail-on warning) */
  WARN: 4,
} as const;

export type ExitCodeValue = typeof ExitCode[keyof typeof ExitCode];

// ─────────────────────────────────────────────────────────────────────────────
// Exit Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exit with success code
 */
export function exitSuccess(): never {
  process.exit(ExitCode.SUCCESS);
}

/**
 * Exit with ISL error code (parse, type check, verification failures)
 */
export function exitISLError(): never {
  process.exit(ExitCode.ISL_ERROR);
}

/**
 * Exit with usage error code (bad flags, missing file)
 */
export function exitUsageError(): never {
  process.exit(ExitCode.USAGE_ERROR);
}

/**
 * Exit with internal error code (bugs)
 */
export function exitInternalError(): never {
  process.exit(ExitCode.INTERNAL_ERROR);
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Classification
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorType = 'isl' | 'usage' | 'internal';

/**
 * Get exit code for an error type
 */
export function getExitCode(errorType: ErrorType): ExitCodeValue {
  switch (errorType) {
    case 'isl':
      return ExitCode.ISL_ERROR;
    case 'usage':
      return ExitCode.USAGE_ERROR;
    case 'internal':
      return ExitCode.INTERNAL_ERROR;
    default:
      return ExitCode.INTERNAL_ERROR;
  }
}

/**
 * Classify an error to determine exit code
 */
export function classifyError(error: unknown): ErrorType {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Usage errors
    if (msg.includes('missing') || 
        msg.includes('invalid argument') ||
        msg.includes('unknown option') ||
        msg.includes('not found') ||
        msg.includes('no such file') ||
        msg.includes('enoent')) {
      return 'usage';
    }
    
    // ISL errors
    if (msg.includes('parse') ||
        msg.includes('syntax') ||
        msg.includes('type error') ||
        msg.includes('verification') ||
        msg.includes('validation')) {
      return 'isl';
    }
  }
  
  // Default to internal error for unknown issues
  return 'internal';
}

/**
 * Exit with appropriate code based on error
 */
export function exitWithError(error: unknown): never {
  const errorType = classifyError(error);
  process.exit(getExitCode(errorType));
}
