/**
 * Drift Detection Types
 *
 * Type definitions for the drift detector that identifies when source code
 * has changed but its ISL spec hasn't been updated — the spec may no longer
 * accurately describe the code's behavior.
 */

// ============================================================================
// DRIFT REPORT
// ============================================================================

/**
 * A full drift report for a single spec ↔ implementation pair
 */
export interface DriftReport {
  /** Path to the implementation file */
  file: string;

  /** Path to the ISL spec file */
  spec: string;

  /** Drift score: 0 = in sync, 100 = completely stale */
  driftScore: number;

  /** Severity bucket derived from driftScore */
  severity: DriftSeverity;

  /** Last modification time of the implementation */
  lastCodeChange: Date;

  /** Last modification time of the spec */
  lastSpecChange: Date;

  /** Individual drift indicators that contribute to the score */
  indicators: DriftIndicator[];
}

/**
 * Severity level derived from drift score
 */
export type DriftSeverity = 'in-sync' | 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// DRIFT INDICATORS
// ============================================================================

/**
 * Types of drift that can be detected
 */
export type DriftIndicatorType =
  | 'signature_change'
  | 'new_behavior'
  | 'removed_behavior'
  | 'dependency_change'
  | 'structural_change';

/**
 * An individual indicator of drift between spec and implementation
 */
export interface DriftIndicator {
  /** Category of drift detected */
  type: DriftIndicatorType;

  /** Human-readable description */
  description: string;

  /** Severity of this indicator */
  severity: 'low' | 'medium' | 'high';

  /** Location in the implementation file */
  codeLocation: CodeLocation;

  /** Location in the spec file (if applicable) */
  specLocation?: CodeLocation;
}

/**
 * A location in a source file
 */
export interface CodeLocation {
  file: string;
  line: number;
}

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * An extracted function signature from implementation code
 */
export interface ExtractedFunction {
  /** Function name */
  name: string;

  /** Parameter names */
  params: string[];

  /** Return type (raw string, may be empty) */
  returnType: string;

  /** Whether the function is exported */
  exported: boolean;

  /** Whether the function is async */
  async: boolean;

  /** Line number where the function starts */
  line: number;
}

/**
 * An extracted import from implementation code
 */
export interface ExtractedImport {
  /** Module specifier (e.g., 'fs', './utils') */
  source: string;

  /** Named imports (e.g., ['readFile', 'writeFile']) */
  names: string[];

  /** Default import name if any */
  defaultImport?: string;

  /** Whether this is a type-only import */
  typeOnly: boolean;

  /** Line number */
  line: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for drift detection
 */
export interface DriftConfig {
  /** Root directory to scan */
  rootDir: string;

  /** Glob patterns for spec files (default: ['**\/*.isl']) */
  specPatterns?: string[];

  /** Glob patterns for implementation files (default: ['**\/*.ts']) */
  implPatterns?: string[];

  /** Patterns to ignore (default: node_modules, dist, .git) */
  ignorePatterns?: string[];

  /** Maximum age in days before warning (default: 30) */
  maxAgeDays?: number;

  /** Drift score threshold for high severity (default: 50) */
  highThreshold?: number;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_DRIFT_CONFIG = {
  specPatterns: ['**/*.isl'],
  implPatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/__tests__/**'],
  maxAgeDays: 30,
  highThreshold: 50,
} as const;

// ============================================================================
// WATCH MODE
// ============================================================================

/**
 * Configuration for watch mode
 */
export interface DriftWatchConfig {
  /** Root directory to watch */
  rootDir: string;

  /** Drift config (inherits defaults) */
  driftConfig?: Partial<DriftConfig>;

  /** Debounce interval in milliseconds (default: 500) */
  debounceMs?: number;

  /** Score threshold that triggers a warning (default: 50) */
  warnThreshold?: number;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Default watch configuration values
 */
export const DEFAULT_DRIFT_WATCH_CONFIG = {
  debounceMs: 500,
  warnThreshold: 50,
} as const;

/**
 * Events emitted by the drift watcher
 */
export type DriftWatchEvent =
  | { type: 'started'; config: DriftWatchConfig }
  | { type: 'spec-changed'; file: string; timestamp: Date }
  | { type: 'code-changed'; file: string; timestamp: Date }
  | { type: 'drift-detected'; report: DriftReport }
  | { type: 'error'; error: Error }
  | { type: 'stopped' };

/**
 * Callback for drift watch events
 */
export type DriftWatchEventCallback = (event: DriftWatchEvent) => void;

/**
 * Handle to control the drift watcher
 */
export interface DriftWatchHandle {
  /** Stop watching */
  stop(): Promise<void>;

  /** Check if currently watching */
  isWatching(): boolean;

  /** Manually trigger a full drift scan */
  triggerScan(): Promise<DriftReport[]>;
}

// ============================================================================
// BATCH SCAN
// ============================================================================

/**
 * A spec ↔ implementation mapping used for batch scanning
 */
export interface SpecImplPair {
  specFile: string;
  implFile: string;
}

/**
 * Summary of a batch drift scan
 */
export interface DriftScanSummary {
  /** Total spec files scanned */
  totalSpecs: number;

  /** Number of specs in sync (score 0) */
  inSync: number;

  /** Number of specs with drift detected */
  drifted: number;

  /** Number with high drift (score >= threshold) */
  highDrift: number;

  /** Average drift score across all pairs */
  averageScore: number;

  /** All individual reports */
  reports: DriftReport[];

  /** Timestamp of the scan */
  timestamp: Date;

  /** Duration in milliseconds */
  durationMs: number;
}
