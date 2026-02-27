/**
 * Canonical Verdict Type
 * 
 * Standardized verdict format used across gate, verify, and heal commands.
 */

/** General verdict decision: SHIP, WARN, or NO-SHIP (used by verify command) */
export type VerdictDecision = 'SHIP' | 'WARN' | 'NO-SHIP' | 'NO_SHIP';

/** Gate-specific verdict decision: SHIP or NO-SHIP only (binary gate decision) */
export type GateDecision = 'SHIP' | 'NO-SHIP';

/** Exit code enum for deterministic process exits */
export const EXIT_CODE = {
  SUCCESS: 0,
  FAILURE: 1,
} as const;

export type ExitCode = typeof EXIT_CODE[keyof typeof EXIT_CODE];

/** Clause/check status */
export type CheckStatus = 'passed' | 'failed' | 'skipped';

/** Severity level */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Individual clause result */
export interface ClauseResult {
  id: string;
  type: string;
  description: string;
  status: CheckStatus;
  error?: string;
}

/** Summary of test/check results */
export interface ResultSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

/** Blocker details */
export interface Blocker {
  clause: string;
  reason: string;
  severity: string;
}

/** Verdict manifest for fingerprinting */
export interface VerdictManifest {
  fingerprint: string;
  specHash: string;
  implHash: string;
  timestamp: string;
}

/** Complete verdict result with evidence (general 3-state) */
export interface Verdict {
  /** Final decision */
  decision: VerdictDecision;
  /** Exit code (0 for SHIP/WARN, 1 for NO-SHIP) */
  exitCode: ExitCode;
  /** Trust/confidence score (0-100) */
  trustScore: number;
  /** Confidence level (0-100) */
  confidence: number;
  /** One-line summary */
  summary: string;
  /** Path to evidence bundle */
  bundlePath?: string;
  /** Fingerprint manifest */
  manifest?: VerdictManifest;
  /** Detailed results */
  results?: {
    clauses: ClauseResult[];
    summary: ResultSummary;
    blockers: Blocker[];
  };
  /** Error code if decision is NO-SHIP */
  error?: string;
  /** Actionable suggestion */
  suggestion?: string;
}

/** Gate-specific verdict (binary SHIP/NO-SHIP only) */
export interface GateVerdict extends Omit<Verdict, 'decision'> {
  /** Final gate decision (binary: SHIP or NO-SHIP) */
  decision: GateDecision;
}

/**
 * Convert decision to exit code
 */
export function getExitCode(decision: VerdictDecision | GateDecision): ExitCode {
  return decision === 'SHIP' || decision === 'WARN' 
    ? EXIT_CODE.SUCCESS 
    : EXIT_CODE.FAILURE;
}

/**
 * Normalize decision string (handle both NO-SHIP and NO_SHIP)
 */
export function normalizeDecision(decision: string): VerdictDecision {
  if (decision === 'NO_SHIP' || decision === 'NO-SHIP') {
    return 'NO-SHIP';
  }
  return decision as VerdictDecision;
}
