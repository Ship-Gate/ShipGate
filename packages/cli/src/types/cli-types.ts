/**
 * Shared CLI Types
 * 
 * Centralized type definitions used across multiple CLI commands
 */

export type OutputFormat = 'pretty' | 'json' | 'quiet';

export interface BaseCommandOptions {
  verbose?: boolean;
  format?: OutputFormat;
}

export interface BaseCommandResult {
  success: boolean;
  errors?: string[];
}

// Exit code constants
export enum CLIExitCode {
  SUCCESS = 0,
  ERROR = 1,
  VALIDATION_ERROR = 2,
  NOT_FOUND = 3,
}

// Common verdict types
export type Verdict = 'SHIP' | 'WARN' | 'NO_SHIP' | 'FAIL';

export type UnifiedVerdict = 'SHIP' | 'WARN' | 'NO_SHIP';

// Proof bundle summary
export interface ProofBundleSummary {
  totalFiles: number;
  verifiedFiles: number;
  violations: number;
  score: number;
  verdict: Verdict;
}

// Config types
export interface CLIConfig {
  [key: string]: unknown;
}
