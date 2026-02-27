/**
 * CLI UX Types
 *
 * Types for verification results, rendering options, and JSON output.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Verification Result Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status of an individual clause/test
 */
export type ClauseStatus = 'passed' | 'failed' | 'skipped';

/**
 * Impact level for failures
 */
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Category of verification clause
 */
export type ClauseCategory =
  | 'postcondition'
  | 'precondition'
  | 'invariant'
  | 'scenario'
  | 'temporal'
  | 'chaos';

/**
 * Recommendation for deployment readiness
 */
export type Recommendation =
  | 'production_ready'
  | 'staging_recommended'
  | 'shadow_mode'
  | 'not_ready'
  | 'critical_issues';

/**
 * Individual clause/test result
 */
export interface ClauseResult {
  /** Clause name/description */
  name: string;
  /** Pass/fail/skip status */
  status: ClauseStatus;
  /** Category of the clause */
  category: ClauseCategory;
  /** Impact level if failed */
  impact?: ImpactLevel;
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Source file where clause is defined */
  file?: string;
  /** Line number in source file */
  line?: number;
  /** Column number in source file */
  column?: number;
  /** Suggested fix for the failure */
  suggestedFix?: string;
  /** Expression that was evaluated */
  expression?: string;
  /** Actual value received */
  actual?: unknown;
  /** Expected value */
  expected?: unknown;
}

/**
 * Category score breakdown
 */
export interface CategoryScore {
  /** Score 0-100 */
  score: number;
  /** Number of passed clauses */
  passed: number;
  /** Number of failed clauses */
  failed: number;
  /** Total number of clauses */
  total: number;
  /** Weight in overall score */
  weight?: number;
}

/**
 * Category breakdown for scores
 */
export interface CategoryBreakdown {
  postconditions: CategoryScore;
  invariants: CategoryScore;
  scenarios: CategoryScore;
  temporal: CategoryScore;
  preconditions?: CategoryScore;
  chaos?: CategoryScore;
}

/**
 * Full verification result
 */
export interface VerificationResult {
  /** Whether verification passed overall */
  success: boolean;
  /** Overall score 0-100 */
  score: number;
  /** Confidence level 0-100 */
  confidence: number;
  /** Ship recommendation */
  recommendation: Recommendation;
  /** Spec file path */
  specFile: string;
  /** Implementation file path */
  implFile: string;
  /** All clause results */
  clauses: ClauseResult[];
  /** Category breakdown */
  breakdown: CategoryBreakdown;
  /** Total duration in milliseconds */
  duration: number;
  /** Timestamp of verification */
  timestamp: string;
  /** ISL version */
  islVersion?: string;
  /** Any warnings */
  warnings?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for the pretty renderer
 */
export interface RenderOptions {
  /** Enable/disable colors */
  colors?: boolean;
  /** Maximum number of failures to show */
  maxFailures?: number;
  /** Show suggested fixes */
  showFixes?: boolean;
  /** Show repro commands */
  showRepro?: boolean;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Terminal width for formatting */
  terminalWidth?: number;
  /** Show timestamp */
  showTimestamp?: boolean;
  /** Spec file for repro commands */
  specFile?: string;
  /** Impl file for repro commands */
  implFile?: string;
}

/**
 * Default render options
 */
export const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
  colors: true,
  maxFailures: 5,
  showFixes: true,
  showRepro: true,
  showBreakdown: true,
  terminalWidth: 80,
  showTimestamp: false,
  specFile: '',
  implFile: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// JSON Output Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON output structure (stable schema)
 */
export interface JsonOutput {
  /** Schema version for forward compatibility */
  schemaVersion: '1.0';
  /** Ship decision */
  decision: 'SHIP' | 'NO_SHIP';
  /** Verification result data */
  result: VerificationResult;
  /** Metadata about the run */
  meta: {
    /** ISL CLI version */
    cliVersion: string;
    /** Node.js version */
    nodeVersion: string;
    /** Operating system */
    platform: string;
    /** Timestamp */
    timestamp: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grouped failures by category
 */
export interface GroupedFailures {
  critical: ClauseResult[];
  high: ClauseResult[];
  medium: ClauseResult[];
  low: ClauseResult[];
}

/**
 * Repro command structure
 */
export interface ReproCommand {
  /** Description of what the command does */
  description: string;
  /** The command to run */
  command: string;
}
