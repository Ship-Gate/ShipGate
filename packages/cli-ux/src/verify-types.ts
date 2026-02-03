/**
 * Verification Table Types
 *
 * Types for the clause-level verification output with TRUE/FALSE/UNKNOWN verdicts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Verdict Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clause verdict status
 * - TRUE: Clause proven to hold
 * - FALSE: Clause violated
 * - UNKNOWN: Clause cannot be evaluated (fail-closed)
 */
export type ClauseVerdict = 'TRUE' | 'FALSE' | 'UNKNOWN';

/**
 * Overall verification verdict
 */
export type OverallVerdict = 'PROVEN' | 'INCOMPLETE_PROOF' | 'FAILED';

/**
 * Clause type
 */
export type VerifyClauseType = 'postcondition' | 'precondition' | 'invariant' | 'temporal' | 'security';

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trace slice reference - points to relevant runtime events
 */
export interface TraceSliceRef {
  /** Type of evidence */
  type: 'trace_slice';
  /** Behavior the trace is from */
  behavior: string;
  /** Event IDs in the slice */
  eventIds: string[];
  /** Start timestamp */
  startMs: number;
  /** End timestamp */
  endMs: number;
  /** Path to trace file if persisted */
  traceFile?: string;
}

/**
 * Adapter snapshot reference - points to state snapshot from adapter
 */
export interface AdapterSnapshotRef {
  /** Type of evidence */
  type: 'adapter_snapshot';
  /** Adapter name */
  adapter: string;
  /** Snapshot ID */
  snapshotId: string;
  /** Timestamp */
  timestampMs: number;
  /** Path to snapshot file if persisted */
  snapshotFile?: string;
}

/**
 * No evidence available
 */
export interface NoEvidenceRef {
  /** Type of evidence */
  type: 'none';
  /** Reason no evidence is available */
  reason: string;
}

/**
 * Evidence reference - union of all evidence types
 */
export type EvidenceRef = TraceSliceRef | AdapterSnapshotRef | NoEvidenceRef;

// ─────────────────────────────────────────────────────────────────────────────
// Unknown Reason Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reason why a clause is UNKNOWN
 */
export interface UnknownReason {
  /** Short code for the reason */
  code: 
    | 'NO_TRACE_DATA'
    | 'EVALUATION_ERROR'
    | 'MISSING_CONTEXT'
    | 'NON_BOOLEAN_RESULT'
    | 'TIMEOUT'
    | 'ADAPTER_UNAVAILABLE'
    | 'STATE_NOT_CAPTURED';
  /** Human-readable explanation */
  message: string;
  /** What to add/fix to make this clause evaluable */
  remediation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clause Result Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Source location for a clause
 */
export interface SourceLocation {
  /** Source file */
  file: string;
  /** Start line (1-indexed) */
  line: number;
  /** Start column (1-indexed) */
  column: number;
  /** End line */
  endLine?: number;
  /** End column */
  endColumn?: number;
}

/**
 * Individual clause verification result
 */
export interface VerifyClauseResult {
  /** Unique clause ID */
  clauseId: string;
  /** Clause text/expression as written in ISL */
  clauseText: string;
  /** Clause type */
  clauseType: VerifyClauseType;
  /** Behavior this clause belongs to (if applicable) */
  behavior?: string;
  /** Verdict: TRUE, FALSE, or UNKNOWN */
  verdict: ClauseVerdict;
  /** Evidence reference */
  evidence: EvidenceRef;
  /** Source location in ISL file */
  source: SourceLocation;
  /** Reason (only for UNKNOWN) */
  unknownReason?: UnknownReason;
  /** Error message (only for FALSE) */
  failureMessage?: string;
  /** Expected value (only for FALSE) */
  expected?: unknown;
  /** Actual value (only for FALSE) */
  actual?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Summary statistics
 */
export interface VerifySummary {
  /** Total number of clauses */
  total: number;
  /** Number of TRUE clauses */
  proven: number;
  /** Number of FALSE clauses */
  failed: number;
  /** Number of UNKNOWN clauses */
  unknown: number;
}

/**
 * Complete verification result
 */
export interface VerifyResult {
  /** Overall verdict */
  verdict: OverallVerdict;
  /** Domain/spec name */
  specName: string;
  /** Spec file path */
  specFile: string;
  /** All clause results */
  clauses: VerifyClauseResult[];
  /** Summary statistics */
  summary: VerifySummary;
  /** Duration in milliseconds */
  durationMs: number;
  /** Timestamp */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON Output Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable JSON output schema for isl verify --json
 */
export interface VerifyJsonOutput {
  /** Schema version for forward compatibility */
  schemaVersion: '1.0';
  /** Overall verdict */
  verdict: OverallVerdict;
  /** Exit code that will be used */
  exitCode: 0 | 1 | 2;
  /** Verification result */
  result: VerifyResult;
  /** Metadata */
  meta: {
    /** CLI version */
    cliVersion: string;
    /** Node.js version */
    nodeVersion: string;
    /** Platform */
    platform: string;
    /** Timestamp */
    timestamp: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderer Options
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for the verification table renderer
 */
export interface VerifyRenderOptions {
  /** Enable colors */
  colors?: boolean;
  /** Terminal width */
  terminalWidth?: number;
  /** Show evidence details */
  showEvidence?: boolean;
  /** Show source locations */
  showSource?: boolean;
  /** Maximum clause text length before truncation */
  maxClauseLength?: number;
  /** Filter to specific behavior */
  filterBehavior?: string;
  /** Filter to specific clause type */
  filterType?: VerifyClauseType;
}

/**
 * Default render options
 */
export const DEFAULT_VERIFY_RENDER_OPTIONS: Required<VerifyRenderOptions> = {
  colors: true,
  terminalWidth: 120,
  showEvidence: true,
  showSource: true,
  maxClauseLength: 60,
  filterBehavior: '',
  filterType: '' as VerifyClauseType,
};
