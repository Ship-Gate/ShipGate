/**
 * Verified Intent — Contract Types
 *
 * "Verified" requires ALL three pillars:
 *   1. Spec Fidelity  — signatures + types match source
 *   2. Coverage        — postconditions/invariants/error cases at minimum thresholds
 *   3. Execution       — tests ran (not skipped), results attributable to the spec
 *
 * If ANY pillar is missing the run MUST produce WARN or NO_SHIP (configurable),
 * never SHIP.
 *
 * @module @isl-lang/gate/verified-intent
 */

// ============================================================================
// Pillar Status
// ============================================================================

/** Outcome of evaluating a single pillar */
export type PillarStatus = 'passed' | 'failed' | 'degraded' | 'missing';

/** One of the three verification pillars */
export type PillarName = 'spec_fidelity' | 'coverage' | 'execution';

// ============================================================================
// Provenance Tags — what was the origin of each piece of data?
// ============================================================================

/** How a piece of knowledge was obtained */
export type ProvenanceOrigin =
  | 'human-authored'
  | 'ai-generated'
  | 'inferred'
  | 'unknown';

/** Whether a check actually executed */
export type ExecutionStatus =
  | 'ran'
  | 'skipped'
  | 'not_run'
  | 'errored';

// ============================================================================
// Provenance Record
// ============================================================================

/**
 * Tracks the origin, execution, and evidence for a single verification item.
 */
export interface ProvenanceRecord {
  /** Human-readable label for this item */
  label: string;
  /** How this item was obtained */
  origin: ProvenanceOrigin;
  /** Whether it was actually executed */
  executionStatus: ExecutionStatus;
  /** Free-form detail (e.g. model name, file path) */
  detail?: string;
  /** Pointer to supporting evidence (file path, URL, hash) */
  evidenceRef?: string;
}

// ============================================================================
// Provenance Report
// ============================================================================

/**
 * Complete provenance report that explicitly answers:
 *   - what was inferred
 *   - what was AI-generated
 *   - what was unknown
 *   - what ran
 *   - what didn't run
 *   - what evidence exists
 */
export interface ProvenanceReport {
  /** Items whose origin is 'inferred' */
  inferred: ProvenanceRecord[];
  /** Items whose origin is 'ai-generated' */
  aiGenerated: ProvenanceRecord[];
  /** Items whose origin is 'unknown' */
  unknown: ProvenanceRecord[];
  /** Items that actually executed (executionStatus === 'ran') */
  ran: ProvenanceRecord[];
  /** Items that did NOT run (skipped | not_run | errored) */
  didNotRun: ProvenanceRecord[];
  /** All items that have evidence references */
  evidence: ProvenanceRecord[];
}

// ============================================================================
// Pillar Result
// ============================================================================

/**
 * Result of evaluating a single pillar.
 */
export interface PillarResult {
  /** Which pillar */
  pillar: PillarName;
  /** Overall status of this pillar */
  status: PillarStatus;
  /** Score 0–1 within this pillar */
  score: number;
  /** Human-readable summary */
  summary: string;
  /** Detailed findings within this pillar */
  details: PillarDetail[];
  /** Provenance records for items evaluated in this pillar */
  provenance: ProvenanceRecord[];
}

/**
 * A single detail finding within a pillar evaluation.
 */
export interface PillarDetail {
  /** What was checked */
  check: string;
  /** Did it pass? */
  passed: boolean;
  /** Human-readable message */
  message: string;
  /** Provenance origin */
  origin: ProvenanceOrigin;
  /** Execution status */
  executionStatus: ExecutionStatus;
}

// ============================================================================
// Verified Intent Result
// ============================================================================

/**
 * Complete Verified Intent result — the new contract.
 *
 * SHIP requires all three pillars to pass.
 * If any pillar is missing/failed, verdict is WARN or NO_SHIP per config.
 */
export interface VerifiedIntentResult {
  /** Final verdict after enforcing 3-pillar rule */
  verdict: 'SHIP' | 'WARN' | 'NO_SHIP';
  /** Did all three pillars pass? */
  allPillarsPassed: boolean;
  /** Per-pillar results */
  pillars: {
    specFidelity: PillarResult;
    coverage: PillarResult;
    execution: PillarResult;
  };
  /** Composite score 0–1 (average of pillar scores, 0 if any missing) */
  compositeScore: number;
  /** Full provenance report */
  provenance: ProvenanceReport;
  /** Human-readable summary */
  summary: string;
  /** Blockers preventing SHIP */
  blockers: string[];
  /** Actionable recommendations */
  recommendations: string[];
}

// ============================================================================
// Configuration
// ============================================================================

/** What verdict to produce when a pillar is missing or failed. */
export type MissingPillarPolicy = 'WARN' | 'NO_SHIP';

/**
 * Configuration for Verified Intent evaluation.
 */
export interface VerifiedIntentConfig {
  /** What to return when a pillar is missing (default: 'NO_SHIP') */
  missingPillarVerdict: MissingPillarPolicy;

  /** Spec Fidelity thresholds */
  specFidelity: {
    /** Minimum ratio of matched signatures (0–1, default 0.8) */
    minSignatureMatch: number;
    /** Minimum ratio of matched types (0–1, default 0.8) */
    minTypeMatch: number;
  };

  /** Coverage thresholds */
  coverage: {
    /** Minimum number of postconditions required (default 1) */
    minPostconditions: number;
    /** Minimum number of invariants required (default 1) */
    minInvariants: number;
    /** Minimum number of error cases required (default 1) */
    minErrorCases: number;
    /** Minimum overall coverage ratio 0–1 (default 0.5) */
    minCoverageRatio: number;
  };

  /** Execution thresholds */
  execution: {
    /** Minimum test pass rate 0–1 (default 0.8) */
    minPassRate: number;
    /** Maximum allowed skip rate 0–1 (default 0.1) */
    maxSkipRate: number;
    /** Require at least one test to have run (default true) */
    requireAtLeastOneRan: boolean;
    /** Require results to be attributable to spec (default true) */
    requireAttribution: boolean;
  };
}

/**
 * Default strict configuration.
 */
export const DEFAULT_VERIFIED_INTENT_CONFIG: VerifiedIntentConfig = {
  missingPillarVerdict: 'NO_SHIP',

  specFidelity: {
    minSignatureMatch: 0.8,
    minTypeMatch: 0.8,
  },

  coverage: {
    minPostconditions: 1,
    minInvariants: 1,
    minErrorCases: 1,
    minCoverageRatio: 0.5,
  },

  execution: {
    minPassRate: 0.8,
    maxSkipRate: 0.1,
    requireAtLeastOneRan: true,
    requireAttribution: true,
  },
};

/**
 * Relaxed configuration for development / bootstrapping.
 */
export const DEV_VERIFIED_INTENT_CONFIG: VerifiedIntentConfig = {
  missingPillarVerdict: 'WARN',

  specFidelity: {
    minSignatureMatch: 0.5,
    minTypeMatch: 0.5,
  },

  coverage: {
    minPostconditions: 0,
    minInvariants: 0,
    minErrorCases: 0,
    minCoverageRatio: 0.0,
  },

  execution: {
    minPassRate: 0.5,
    maxSkipRate: 0.5,
    requireAtLeastOneRan: false,
    requireAttribution: false,
  },
};
