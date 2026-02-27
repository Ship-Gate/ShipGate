/**
 * Types for runtime verification code generation
 */

export type InstrumentationMode = 'development' | 'production' | 'test';

export interface RuntimeConfig {
  /** Whether to throw on precondition failure */
  throwOnPreconditionFailure?: boolean;
  /** Whether to throw on postcondition failure */
  throwOnPostconditionFailure?: boolean;
  /** Whether to throw on invariant failure */
  throwOnInvariantFailure?: boolean;
  /** Log violations instead of throwing */
  logOnly?: boolean;
  /** Custom error reporter function name */
  errorReporter?: string;
}

export interface GenerateOptions {
  /** Output directory for generated files */
  outputDir?: string;
  /** Instrumentation mode */
  mode?: InstrumentationMode;
  /** Runtime configuration */
  runtime?: RuntimeConfig;
  /** Include JSDoc comments */
  includeComments?: boolean;
  /** Generate helper functions */
  includeHelpers?: boolean;
  /** Emit as ESM or CJS */
  moduleFormat?: 'esm' | 'cjs';
}

export interface GeneratedFile {
  /** File path relative to output directory */
  path: string;
  /** Generated file contents */
  content: string;
  /** File type */
  type: 'wrapper' | 'types' | 'helpers' | 'index';
}

export interface VerificationError {
  type: 'precondition' | 'postcondition' | 'invariant';
  behavior: string;
  condition: string;
  message: string;
  context?: Record<string, unknown>;
}
