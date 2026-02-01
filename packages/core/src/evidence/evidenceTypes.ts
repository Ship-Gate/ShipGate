/**
 * Evidence Report Types for ISL Agent Verification
 *
 * These types define the structure of evidence reports generated during
 * ISL specification verification, including clause results, scoring,
 * assumptions, and artifacts.
 */

import type { ClauseResult, ClauseState, ScoringResult } from '../isl-agent/scoring/scoringTypes.js';

/**
 * Re-export scoring types for convenience
 */
export type { ClauseResult, ClauseState, ScoringResult };

/**
 * Artifact types that can be collected during verification
 */
export type ArtifactType = 'binding' | 'test' | 'trace' | 'log' | 'snapshot';

/**
 * A single artifact produced during verification
 */
export interface EvidenceArtifact {
  /** Unique identifier for the artifact */
  id: string;
  /** Type of artifact */
  type: ArtifactType;
  /** Human-readable name */
  name: string;
  /** Path or URI to the artifact content */
  location?: string;
  /** Inline content for small artifacts */
  content?: string;
  /** MIME type of the artifact */
  mimeType?: string;
  /** Size in bytes (if applicable) */
  size?: number;
  /** When the artifact was created */
  createdAt: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * An assumption made during verification
 */
export interface Assumption {
  /** Unique identifier */
  id: string;
  /** Description of the assumption */
  description: string;
  /** Category of assumption */
  category: 'input' | 'environment' | 'dependency' | 'timing' | 'other';
  /** Impact level if assumption is violated */
  impact: 'low' | 'medium' | 'high' | 'critical';
  /** Related clause IDs */
  relatedClauses?: string[];
}

/**
 * An open question identified during verification
 */
export interface OpenQuestion {
  /** Unique identifier */
  id: string;
  /** The question text */
  question: string;
  /** Priority of resolving this question */
  priority: 'low' | 'medium' | 'high';
  /** Context or background for the question */
  context?: string;
  /** Related clause IDs */
  relatedClauses?: string[];
  /** Suggested next steps to resolve */
  suggestedActions?: string[];
}

/**
 * Score summary with additional context
 */
export interface ScoreSummary {
  /** Overall score (0-100) */
  overallScore: number;
  /** Number of clauses that passed */
  passCount: number;
  /** Number of clauses that partially passed */
  partialCount: number;
  /** Number of clauses that failed */
  failCount: number;
  /** Total clauses evaluated */
  totalClauses: number;
  /** Pass rate as percentage */
  passRate: number;
  /** Confidence level in the results */
  confidence: 'low' | 'medium' | 'high';
  /** Ship recommendation */
  recommendation: 'ship' | 'review' | 'block';
}

/**
 * Verification metadata
 */
export interface VerificationMetadata {
  /** When verification started */
  startedAt: string;
  /** When verification completed */
  completedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Tool/agent version used */
  agentVersion: string;
  /** Environment info */
  environment?: string;
  /** Verification mode */
  mode?: 'full' | 'incremental' | 'quick';
}

/**
 * Extended clause result with evidence-specific fields
 */
export interface EvidenceClauseResult extends ClauseResult {
  /** Clause type (precondition, postcondition, invariant, etc.) */
  clauseType?: 'precondition' | 'postcondition' | 'invariant' | 'effect' | 'constraint';
  /** Execution trace for this clause */
  trace?: string;
  /** Actual value observed */
  actualValue?: unknown;
  /** Expected value */
  expectedValue?: unknown;
  /** Time taken to evaluate this clause (ms) */
  evaluationTimeMs?: number;
  /** Related artifact IDs */
  artifactIds?: string[];
}

/**
 * Complete Evidence Report structure
 */
export interface EvidenceReport {
  /** Report version for schema evolution */
  version: '1.0';
  /** Unique identifier for this report */
  reportId: string;
  /** Fingerprint of the specification being verified */
  specFingerprint: string;
  /** Name of the specification */
  specName?: string;
  /** Path to the specification file */
  specPath?: string;
  /** Results for each clause evaluated */
  clauseResults: EvidenceClauseResult[];
  /** Aggregated score summary */
  scoreSummary: ScoreSummary;
  /** Assumptions made during verification */
  assumptions: Assumption[];
  /** Open questions identified */
  openQuestions: OpenQuestion[];
  /** Artifacts collected during verification */
  artifacts: EvidenceArtifact[];
  /** Verification metadata */
  metadata: VerificationMetadata;
  /** Optional free-form notes */
  notes?: string;
}

/**
 * Validation result returned by validateEvidenceReport
 */
export interface ValidationResult {
  /** Whether the report is valid */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
}

/**
 * A single validation error
 */
export interface ValidationError {
  /** Path to the invalid field (dot notation) */
  path: string;
  /** Error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
}
