/**
 * PR Analysis - Type Definitions
 *
 * Types for analyzing pull request diffs, classifying changed files,
 * and producing smart verification plans.
 *
 * @module @isl-lang/gate/pr-analysis
 */

// ============================================================================
// Diff Hunk Types
// ============================================================================

/**
 * A single hunk from a unified diff.
 */
export interface DiffHunk {
  /** Starting line in the old file */
  oldStart: number;
  /** Number of lines in the old range */
  oldCount: number;
  /** Starting line in the new file */
  newStart: number;
  /** Number of lines in the new range */
  newCount: number;
  /** Raw hunk header (e.g. "@@ -10,5 +10,8 @@") */
  header: string;
}

// ============================================================================
// File Change Types
// ============================================================================

/**
 * How a file was changed in the PR.
 */
export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

/**
 * A single file change within a PR diff.
 */
export interface FileChange {
  /** File path (new path for renames) */
  path: string;
  /** Previous path (only for renames) */
  oldPath?: string;
  /** Type of change */
  changeType: ChangeType;
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
  /** Diff hunks (populated when full diff is parsed) */
  hunks: DiffHunk[];
}

// ============================================================================
// PR Analysis Result
// ============================================================================

/**
 * Full analysis of a pull request diff.
 */
export interface PRAnalysis {
  /** All files changed in the PR */
  changedFiles: FileChange[];
  /** ISL spec paths that cover changed files */
  affectedSpecs: string[];
  /** Files that were newly added */
  newFiles: string[];
  /** ISL spec files (.isl) that were changed */
  specChanges: string[];
  /** Overall risk score 0-100 */
  riskScore: number;
  /** Human-readable risk label */
  riskLabel: RiskLabel;
  /** Base branch used for comparison */
  baseBranch: string;
  /** Head branch/ref used for comparison */
  headRef: string;
}

/**
 * Risk label for human-readable output.
 */
export type RiskLabel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

// ============================================================================
// Verification Plan Types
// ============================================================================

/**
 * A file matched with its ISL spec for full verification.
 */
export interface SpecVerification {
  /** The changed file */
  file: FileChange;
  /** Path to the matching ISL spec */
  spec: string;
}

/**
 * Reason a file was skipped.
 */
export type SkipReason = 'test_file' | 'type_only' | 'config_file' | 'non_critical';

/**
 * A file that was skipped with a reason.
 */
export interface SkippedFile {
  /** The changed file */
  file: FileChange;
  /** Why it was skipped */
  reason: SkipReason;
}

/**
 * Smart verification plan — decides what to verify and what to skip.
 */
export interface VerificationPlan {
  /** Files with ISL specs → full spec-based verification */
  fullVerify: SpecVerification[];
  /** Critical-path files without specs → specless mode */
  speclessVerify: FileChange[];
  /** Skipped files (tests, types, config, non-critical) */
  skip: SkippedFile[];
  /** New files in critical paths → recommend spec generation */
  generateSpec: FileChange[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for PR analysis and file selection.
 */
export interface PRAnalysisConfig {
  /** Glob patterns for ISL spec files (default: ['**​/*.isl']) */
  specPatterns: string[];
  /** Directory where ISL specs live (default: '.') */
  specRoot: string;
  /** Regex patterns identifying critical paths */
  criticalPathPatterns: RegExp[];
  /** Extra file extensions to treat as type-only (beyond .d.ts) */
  typeOnlyExtensions: string[];
  /** Extra patterns to treat as config files */
  configPatterns: RegExp[];
  /** Extra patterns to treat as test files */
  testPatterns: RegExp[];
}

/**
 * Options for the analyzePR entry point.
 */
export interface AnalyzePROptions {
  /** Base branch for comparison (default: 'main') */
  baseBranch?: string;
  /** Head branch/ref for comparison (default: 'HEAD') */
  headRef?: string;
  /** Remote name (default: 'origin') */
  remote?: string;
  /** Project root directory (default: process.cwd()) */
  projectRoot?: string;
  /** Override analysis config */
  config?: Partial<PRAnalysisConfig>;
}

/**
 * Resolved (all-required) analysis config.
 */
export type ResolvedPRAnalysisConfig = Required<PRAnalysisConfig>;
