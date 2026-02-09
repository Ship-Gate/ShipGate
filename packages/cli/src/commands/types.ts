/**
 * Shared CLI Command Types
 * 
 * Common types used across CLI commands for consistency and type safety.
 */

import type { ISLConfig } from '../config.js';
import type { DiagnosticError } from '../output.js';
import type { ExitCodeValue } from '../exit-codes.js';

/**
 * Command execution context
 * Provides common utilities and configuration to command implementations
 */
export interface CommandContext {
  /** Logger instance */
  logger: {
    debug: (message: string) => void;
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  /** Current working directory */
  cwd: string;
  /** Loaded configuration */
  config: ISLConfig | null;
  /** File system helpers */
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
  };
  /** Exit code constants */
  exitCodes: {
    SUCCESS: ExitCodeValue;
    ISL_ERROR: ExitCodeValue;
    USAGE_ERROR: ExitCodeValue;
    INTERNAL_ERROR: ExitCodeValue;
  };
}

/**
 * Standard command result
 * All commands should return this structure
 */
export interface CommandResult {
  /** Exit code (0 = success, non-zero = failure) */
  exitCode: ExitCodeValue;
  /** Success flag */
  success: boolean;
  /** Optional report/result data */
  report?: unknown;
  /** Optional artifacts (files generated, etc.) */
  artifacts?: string[];
  /** Errors encountered */
  errors?: string[];
  /** Warnings encountered */
  warnings?: DiagnosticError[];
  /** Duration in milliseconds */
  duration?: number;
}

/**
 * Standard command function signature
 * All commands should follow this pattern: (ctx, argv) => Promise<CommandResult>
 */
export type CommandFunction<TArgs = Record<string, unknown>> = (
  ctx: CommandContext,
  argv: TArgs
) => Promise<CommandResult>;

/**
 * Command argument parser
 * Validates and transforms raw argv into typed arguments
 */
export type CommandArgParser<TArgs> = (argv: Record<string, unknown>) => TArgs;
