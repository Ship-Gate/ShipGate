/**
 * Verdict Scoring Types
 * 
 * Defines types for scoring claims and evidence to produce explainable verdicts.
 * 
 * @module @isl-lang/gate/verdict-scoring
 */

import type { GateEvidence } from '../authoritative/verdict-engine.js';

// ============================================================================
// Claim Types
// ============================================================================

/**
 * Type of ISL claim/clause
 */
export type ClaimType = 'postcondition' | 'invariant' | 'precondition' | 'scenario';

/**
 * Verdict for a claim
 */
export type ClaimVerdict = 'pass' | 'fail' | 'warn' | 'skip' | 'not_proven';

/**
 * A claim from an ISL specification
 */
export interface ISLClaim {
  /** Unique identifier */
  id: string;
  /** Type of claim */
  type: ClaimType;
  /** Behavior name (if applicable) */
  behavior?: string;
  /** Human-readable description */
  description?: string;
  /** Current verdict */
  verdict: ClaimVerdict;
  /** File location (if available) */
  file?: string;
  /** Line number (if available) */
  line?: number;
  /** Expression text (if available) */
  expression?: string;
}

// ============================================================================
// Blast Radius
// ============================================================================

/**
 * Blast radius indicates the scope of impact
 */
export type BlastRadius = 'local' | 'module' | 'repo' | 'prod-user-impact';

/**
 * Blast radius metadata
 */
export interface BlastRadiusInfo {
  /** Radius level */
  level: BlastRadius;
  /** Weight multiplier for scoring */
  weight: number;
  /** Description */
  description: string;
}

/**
 * Blast radius configuration
 */
export const BLAST_RADIUS: Record<BlastRadius, BlastRadiusInfo> = {
  local: {
    level: 'local',
    weight: 1.0,
    description: 'Affects only the current file/function',
  },
  module: {
    level: 'module',
    weight: 1.5,
    description: 'Affects the entire module/package',
  },
  repo: {
    level: 'repo',
    weight: 2.0,
    description: 'Affects the entire repository',
  },
  'prod-user-impact': {
    level: 'prod-user-impact',
    weight: 3.0,
    description: 'Direct impact on production users',
  },
} as const;

// ============================================================================
// Severity Mapping
// ============================================================================

/**
 * Severity level for claims
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Severity configuration
 */
export interface SeverityConfig {
  /** Severity level */
  level: Severity;
  /** Score penalty multiplier */
  penaltyMultiplier: number;
  /** Description */
  description: string;
}

/**
 * Severity configuration by claim type
 */
export const SEVERITY_BY_CLAIM_TYPE: Record<ClaimType, SeverityConfig> = {
  postcondition: {
    level: 'critical',
    penaltyMultiplier: 1.0,
    description: 'Postconditions define required outcomes - failures are critical',
  },
  invariant: {
    level: 'critical',
    penaltyMultiplier: 1.0,
    description: 'Invariants must always hold - violations are critical',
  },
  precondition: {
    level: 'high',
    penaltyMultiplier: 0.8,
    description: 'Preconditions define required inputs - failures block execution',
  },
  scenario: {
    level: 'medium',
    penaltyMultiplier: 0.6,
    description: 'Scenarios test end-to-end flows - failures indicate integration issues',
  },
};

/**
 * Map verdict to severity
 */
export function verdictToSeverity(verdict: ClaimVerdict): Severity {
  switch (verdict) {
    case 'fail':
      return 'critical';
    case 'warn':
      return 'medium';
    case 'not_proven':
      return 'high';
    case 'skip':
      return 'low';
    case 'pass':
      return 'low'; // Passes don't contribute to severity
    default:
      return 'medium';
  }
}

// ============================================================================
// Scored Claim
// ============================================================================

/**
 * A claim with scoring metadata
 */
export interface ScoredClaim extends ISLClaim {
  /** Confidence score 0-1 */
  confidence: number;
  /** Blast radius */
  blastRadius: BlastRadius;
  /** Severity */
  severity: Severity;
  /** Score contribution (0-100) */
  scoreContribution: number;
  /** Explanation of scoring */
  explanation: string;
  /** File location for fixes */
  fixLocation?: {
    file: string;
    line?: number;
  };
}

// ============================================================================
// Scoring Result
// ============================================================================

/**
 * Complete scoring result with explanations
 */
export interface VerdictScoringResult {
  /** Final verdict */
  verdict: 'SHIP' | 'WARN' | 'NO_SHIP';
  /** Overall score 0-100 */
  score: number;
  /** Overall confidence 0-1 */
  confidence: number;
  /** Scored claims (deduplicated and ordered) */
  scoredClaims: ScoredClaim[];
  /** Evidence used */
  evidence: GateEvidence[];
  /** Explanations for the verdict */
  explanations: VerdictExplanation[];
  /** Blockers (if NO_SHIP) */
  blockers: string[];
  /** Recommendations */
  recommendations: string[];
  /** Summary */
  summary: string;
}

/**
 * Explanation for a scoring decision
 */
export interface VerdictExplanation {
  /** Category of explanation */
  category: 'threshold' | 'critical_failure' | 'claim_failure' | 'confidence' | 'blast_radius';
  /** Human-readable message */
  message: string;
  /** Related claim IDs */
  claimIds?: string[];
  /** Related evidence indices */
  evidenceIndices?: number[];
}

// ============================================================================
// Scoring Configuration
// ============================================================================

/**
 * Configuration for scoring
 */
export interface ScoringConfig {
  /** Thresholds for verdicts */
  thresholds: {
    SHIP: number; // 0-100
    WARN: number; // 0-100
  };
  /** Minimum confidence for SHIP */
  minConfidence: number; // 0-1
  /** Whether to merge duplicate claims */
  mergeDuplicates: boolean;
  /** Custom blast radius mapping */
  blastRadiusMapping?: (claim: ISLClaim) => BlastRadius;
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  thresholds: {
    SHIP: 85,
    WARN: 50,
  },
  minConfidence: 0.7,
  mergeDuplicates: true,
};
