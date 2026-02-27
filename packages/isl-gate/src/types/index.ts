/**
 * ISL Gate - Type Definitions
 * 
 * Core types for the SHIP/NO_SHIP gate decision engine.
 * 
 * @module @isl-lang/gate/types
 */

// ============================================================================
// Verdict Types
// ============================================================================

/**
 * Gate verdict - the final decision
 */
export type GateVerdict = 'SHIP' | 'NO_SHIP';

/**
 * Command verdict - more granular than gate verdict
 */
export type CommandVerdict = 'SHIP' | 'WARN' | 'BLOCK';

/**
 * Verdict thresholds for score-based decisions
 */
export const VERDICT_THRESHOLDS = {
  SHIP: 80,
  WARN: 60,
} as const;

/**
 * Severity penalties for score calculation
 */
export const SEVERITY_PENALTIES = {
  critical: 25,
  high: 10,
  medium: 3,
  low: 1,
} as const;

// ============================================================================
// Gate Result Types
// ============================================================================

/**
 * Reason for a gate decision
 */
export interface GateReason {
  /** Machine-readable code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Affected files */
  files: string[];
  /** Severity level */
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Main gate result - the output of running `isl gate`
 */
export interface GateResult {
  /** Final verdict: SHIP or NO_SHIP */
  verdict: GateVerdict;
  /** Score from 0-100 */
  score: number;
  /** Reasons for the decision */
  reasons: GateReason[];
  /** Path to evidence folder */
  evidencePath: string;
  /** Deterministic fingerprint of inputs */
  fingerprint: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Timestamp of the run */
  timestamp: string;
}

/**
 * Verbose verdict info with reasons
 */
export interface CommandVerdictInfo {
  /** The verdict status */
  status: CommandVerdict;
  /** Human-readable reasons */
  reasons: string[];
}

// ============================================================================
// Scoring Types
// ============================================================================

/**
 * Severity counts for findings
 */
export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

/**
 * Full command counts for analysis
 */
export interface CommandCounts {
  /** Total files considered */
  filesConsidered: number;
  /** Files actually scanned */
  filesScanned: number;
  /** Files skipped */
  filesSkipped: number;
  /** Total findings */
  findingsTotal: number;
  /** Findings by severity */
  findingsBySeverity: SeverityCounts;
  /** Findings by type */
  findingsByType: Record<string, number>;
}

/**
 * Score values
 */
export interface CommandScores {
  /** Overall score 0-100 */
  overall: number;
  /** Confidence score 0-100 (optional) */
  confidence?: number;
  /** Dimension scores (optional) */
  dimensions?: ShipScoreDimensions;
}

/**
 * 6-dimension ship score breakdown
 */
export interface ShipScoreDimensions {
  /** Risk from unverified routes/env vars */
  ghostRisk: number;
  /** Percentage of routes with auth */
  authCoverage: number;
  /** Env var validation status */
  envIntegrity: number;
  /** Routes tested via runtime */
  runtimeProof: number;
  /** Contract alignment */
  contractsAlignment: number;
  /** Mock data cleanliness */
  mockDataCleanliness: number;
}

// ============================================================================
// Finding Types
// ============================================================================

/**
 * A finding from analysis
 */
export interface Finding {
  /** Unique ID */
  id: string;
  /** Finding type/category */
  type: string;
  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Human-readable message */
  message: string;
  /** File path */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Rule that triggered this */
  rule?: string;
  /** Whether this is auto-fixable */
  autoFixable?: boolean;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// Gate Input Types
// ============================================================================

/**
 * Options for running the gate
 */
export interface GateOptions {
  /** Project root directory */
  projectRoot: string;
  /** Path to ISL spec files (glob pattern) */
  specPattern?: string;
  /** Only check changed files */
  changedOnly?: boolean;
  /** Base branch for diff (when changedOnly is true) */
  baseBranch?: string;
  /** Output format */
  outputFormat?: 'json' | 'text' | 'sarif';
  /** Verbose output */
  verbose?: boolean;
  /** Custom evidence output path */
  evidencePath?: string;
  /** Policy pack names to apply */
  policyPacks?: string[];
  /** Force deterministic mode (no timestamps) */
  deterministic?: boolean;
}

/**
 * Gate input data
 */
export interface GateInput {
  /** Findings from ISL verification */
  findings: Finding[];
  /** Files considered */
  filesConsidered: number;
  /** Files scanned */
  filesScanned: number;
  /** Optional ISL conformance data */
  islConformance?: {
    conformance: number;
    trustScore: number;
    behaviorCount: number;
    entityCount: number;
  };
  /** Optional critical blockers */
  blockers?: CriticalBlockers;
}

/**
 * Critical blocker conditions that force NO_SHIP
 */
export interface CriticalBlockers {
  /** Missing required environment variables */
  missingRequiredEnvVars?: number;
  /** Unprotected sensitive routes */
  unprotectedSensitiveRoutes?: number;
  /** Ghost routes */
  ghostRoutes?: number;
  /** Credential findings */
  credentialFindings?: number;
  /** Fake auth patterns */
  fakeAuthFindings?: number;
  /** Custom blocker reasons */
  customBlockers?: string[];
  
  // ─────────────────────────────────────────────────────────────────────────
  // PBT Blockers (v1.1.0) - Property-Based Testing failures block SHIP
  // ─────────────────────────────────────────────────────────────────────────
  
  /** PBT postcondition violations */
  pbtPostconditionViolations?: number;
  /** PBT invariant violations (always critical) */
  pbtInvariantViolations?: number;
  /** PBT behaviors with failures */
  pbtFailedBehaviors?: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create empty severity counts
 */
export function createEmptySeverityCounts(): SeverityCounts {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

/**
 * Create empty command counts
 */
export function createEmptyCommandCounts(): CommandCounts {
  return {
    filesConsidered: 0,
    filesScanned: 0,
    filesSkipped: 0,
    findingsTotal: 0,
    findingsBySeverity: createEmptySeverityCounts(),
    findingsByType: {},
  };
}

/**
 * Assert counts are valid (invariants)
 */
export function assertCountsValid(counts: CommandCounts): void {
  if (counts.filesSkipped !== counts.filesConsidered - counts.filesScanned) {
    throw new Error('Invalid counts: filesSkipped must equal filesConsidered - filesScanned');
  }
  
  const severitySum = 
    counts.findingsBySeverity.critical +
    counts.findingsBySeverity.high +
    counts.findingsBySeverity.medium +
    counts.findingsBySeverity.low;
  
  if (severitySum !== counts.findingsTotal) {
    throw new Error('Invalid counts: severity counts must sum to findingsTotal');
  }
}

/**
 * Assert scores are valid
 */
export function assertScoresValid(scores: CommandScores): void {
  if (scores.overall < 0 || scores.overall > 100) {
    throw new Error('Invalid score: overall must be 0-100');
  }
  if (scores.confidence !== undefined && (scores.confidence < 0 || scores.confidence > 100)) {
    throw new Error('Invalid score: confidence must be 0-100');
  }
}
