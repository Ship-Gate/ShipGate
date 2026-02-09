/**
 * ISL Authoritative Gate - Type Definitions
 * 
 * SHIP/NO_SHIP is BINARY. No intermediate states.
 * All decisions are final and machine-readable.
 * 
 * @module @isl-lang/gate/authoritative
 */

// ============================================================================
// Core Verdict Types - BINARY ONLY
// ============================================================================

/**
 * Authoritative verdict - SHIP or NO_SHIP, nothing else.
 * This is the final, definitive decision.
 */
export type AuthoritativeVerdict = 'SHIP' | 'NO_SHIP';

/**
 * Exit codes for CI integration
 */
export const EXIT_CODES = {
  SHIP: 0,
  NO_SHIP: 1,
} as const;

// ============================================================================
// Signal Types - All verification inputs
// ============================================================================

/**
 * Signal source identifier
 */
export type SignalSource = 
  | 'parser'
  | 'typechecker'
  | 'verifier'
  | 'test_runner'
  | 'coverage'
  | 'static_analysis'
  | 'security_scan'
  | 'hallucination_scan'
  | 'contract_check'
  | 'env_validation'
  | 'gate_firewall'
  | 'dependency_audit';

/**
 * Individual verification signal
 */
export interface VerificationSignal {
  /** Source of this signal */
  source: SignalSource;
  /** Signal passed? */
  passed: boolean;
  /** Score 0-100 (optional, for weighted signals) */
  score?: number;
  /** Weight for aggregation (default: 1) */
  weight?: number;
  /** Human-readable summary */
  summary: string;
  /** Detailed findings */
  findings?: SignalFinding[];
  /** Whether this signal blocks SHIP if failed */
  blocking: boolean;
  /** Duration in ms */
  durationMs?: number;
}

/**
 * Individual finding within a signal
 */
export interface SignalFinding {
  /** Unique ID */
  id: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Message */
  message: string;
  /** File location */
  file?: string;
  /** Line number */
  line?: number;
  /** Whether this finding alone blocks SHIP */
  blocking: boolean;
}

// ============================================================================
// Threshold Configuration
// ============================================================================

/**
 * Threshold configuration for authoritative decisions
 */
export interface ThresholdConfig {
  /** Minimum overall score for SHIP (default: 80) */
  minScore: number;
  /** Minimum test pass rate for SHIP (default: 100%) */
  minTestPassRate: number;
  /** Minimum coverage for SHIP (default: 70%) */
  minCoverage: number;
  /** Maximum critical findings allowed (default: 0) */
  maxCriticalFindings: number;
  /** Maximum high findings allowed (default: 0) */
  maxHighFindings: number;
  /** Allow skipped tests (default: false) */
  allowSkipped: boolean;
}

/**
 * Default strict thresholds
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  minScore: 80,
  minTestPassRate: 100,
  minCoverage: 70,
  maxCriticalFindings: 0,
  maxHighFindings: 0,
  allowSkipped: false,
};

/**
 * Relaxed thresholds for development
 */
export const DEV_THRESHOLDS: ThresholdConfig = {
  minScore: 60,
  minTestPassRate: 80,
  minCoverage: 50,
  maxCriticalFindings: 0,
  maxHighFindings: 2,
  allowSkipped: true,
};

// ============================================================================
// Aggregated Result Types
// ============================================================================

/**
 * Signal aggregation result
 */
export interface AggregatedSignals {
  /** All signals collected */
  signals: VerificationSignal[];
  /** Weighted overall score 0-100 */
  overallScore: number;
  /** Test summary */
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
  };
  /** Finding counts by severity */
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  /** Coverage percentage (if available) */
  coverage?: number;
  /** Blocking issues that force NO_SHIP */
  blockingIssues: string[];
}

// ============================================================================
// Evidence Bundle Types
// ============================================================================

/**
 * Evidence artifact
 */
export interface EvidenceArtifact {
  /** Artifact type */
  type: 'spec' | 'implementation' | 'test_results' | 'coverage' | 'report' | 'log';
  /** Relative path within bundle */
  path: string;
  /** SHA-256 hash */
  sha256: string;
  /** Size in bytes */
  sizeBytes: number;
}

/**
 * Machine-readable evidence bundle
 */
export interface EvidenceBundle {
  /** Bundle schema version */
  schemaVersion: '2.0.0';
  /** Deterministic fingerprint */
  fingerprint: string;
  /** ISL toolchain version */
  islVersion: string;
  /** Timestamp (ISO 8601) */
  timestamp: string;
  /** Git commit SHA (if available) */
  gitSha?: string;
  /** Git branch (if available) */
  gitBranch?: string;
  /** CI run ID (if available) */
  ciRunId?: string;
  /** Input hashes */
  inputs: {
    specHash: string;
    implHash: string;
    configHash?: string;
  };
  /** Bundle artifacts */
  artifacts: EvidenceArtifact[];
}

// ============================================================================
// Authoritative Gate Result
// ============================================================================

/**
 * Authoritative gate result - the definitive output
 */
export interface AuthoritativeGateResult {
  /** SHIP or NO_SHIP - final decision */
  verdict: AuthoritativeVerdict;
  /** Exit code for CI (0 = SHIP, 1 = NO_SHIP) */
  exitCode: 0 | 1;
  /** Overall score 0-100 */
  score: number;
  /** Confidence in the decision 0-100 */
  confidence: number;
  /** Human-readable summary */
  summary: string;
  /** Aggregated signals */
  aggregation: AggregatedSignals;
  /** Thresholds used for decision */
  thresholds: ThresholdConfig;
  /** Evidence bundle manifest */
  evidence: EvidenceBundle;
  /** Reasons for the verdict */
  reasons: VerdictReason[];
  /** Suggestions for improvement (if NO_SHIP) */
  suggestions?: string[];
  /** Total duration in ms */
  durationMs: number;
}

/**
 * Reason for verdict
 */
export interface VerdictReason {
  /** Machine-readable code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Severity of this reason */
  severity: 'critical' | 'high' | 'medium' | 'info';
  /** Source signal */
  source: SignalSource;
  /** Whether this reason alone would block SHIP */
  blocking: boolean;
}

// ============================================================================
// Gate Input Types
// ============================================================================

/**
 * Input for the authoritative gate
 */
export interface AuthoritativeGateInput {
  /** Project root directory */
  projectRoot: string;
  /** ISL spec source or path */
  spec: string;
  /** Implementation source or directory path */
  implementation: string;
  /** Custom thresholds (optional) */
  thresholds?: Partial<ThresholdConfig>;
  /** Write evidence bundle to disk (default: true) */
  writeBundle?: boolean;
  /** Evidence output path (default: './evidence') */
  evidencePath?: string;
  /** Git info for bundle */
  git?: {
    sha?: string;
    branch?: string;
  };
  /** CI info for bundle */
  ci?: {
    runId?: string;
    provider?: string;
  };
  /** When true, run dependency audit (e.g. pnpm audit) and add as signal; critical vulns = NO_SHIP */
  dependencyAudit?: boolean;
  /**
   * When true, do not throw if spec is missing or invalid.
   * Instead return a SHIP result with reason "no spec provided" (caller should run firewall/unified gate for full check).
   */
  specOptional?: boolean;
}

// ============================================================================
// Unified verdict (spec + firewall)
// ============================================================================

/**
 * Source that contributed to the combined verdict
 */
export type VerdictSource = 'gate_spec' | 'gate_firewall';

/**
 * Combined verdict result from running both spec gate and firewall gate.
 * Single SHIP/NO_SHIP for "all AI code" in a branch.
 */
export interface CombinedVerdictResult {
  /** Final verdict: NO_SHIP if any source is NO_SHIP */
  verdict: AuthoritativeVerdict;
  /** Exit code for CI (0 = SHIP, 1 = NO_SHIP) */
  exitCode: 0 | 1;
  /** Which gates contributed (spec: when spec existed, gate_firewall: always when files checked) */
  sources: VerdictSource[];
  /** Combined score (min of both when both run, else the one that ran) */
  score: number;
  /** Merged reasons from all sources */
  reasons: VerdictReason[];
  /** Evidence path when bundle was written */
  evidencePath?: string;
  /** Spec gate result (when spec was provided and run) */
  specResult?: AuthoritativeGateResult;
  /** Firewall/build verification result (when files were checked) */
  firewallResult?: {
    verdict: AuthoritativeVerdict;
    score: number;
    reasons: VerdictReason[];
    filesChecked: number;
  };
}
