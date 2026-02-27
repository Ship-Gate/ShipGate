/**
 * Postcondition evaluation types with evidence-based semantics.
 *
 * Evidence Ladder (highest to lowest priority):
 * 1. BINDING_PROOF - Static bindings prove the postcondition (e.g., type system guarantees)
 * 2. EXECUTED_TEST - Test executed and assertion passed with coverage
 * 3. RUNTIME_ASSERT - Runtime assertion present but not yet executed
 * 4. HEURISTIC_MATCH - Heuristic analysis suggests compliance
 * 5. NO_EVIDENCE - No evidence found
 */

/**
 * Status of a postcondition evaluation.
 */
export type PostconditionStatus = 'PASS' | 'PARTIAL' | 'FAIL';

/**
 * Types of evidence that can support a postcondition.
 * Ordered by strength (strongest first).
 */
export type EvidenceType =
  | 'BINDING_PROOF'    // Static proof via type bindings or formal verification
  | 'EXECUTED_TEST'    // Test executed with passing assertion
  | 'RUNTIME_ASSERT'   // Runtime assertion present but not executed
  | 'HEURISTIC_MATCH'  // Heuristic/pattern matching evidence
  | 'NO_EVIDENCE';     // No evidence found

/**
 * Priority of evidence types (lower = stronger).
 */
export const EVIDENCE_PRIORITY: Record<EvidenceType, number> = {
  BINDING_PROOF: 1,
  EXECUTED_TEST: 2,
  RUNTIME_ASSERT: 3,
  HEURISTIC_MATCH: 4,
  NO_EVIDENCE: 5,
};

/**
 * A single piece of evidence supporting a postcondition.
 */
export interface Evidence {
  /** Type of evidence */
  type: EvidenceType;

  /** Source of the evidence (file, test name, etc.) */
  source: string;

  /** Human-readable description of the evidence */
  description: string;

  /** Optional: line number or location in source */
  location?: {
    file: string;
    line?: number;
    column?: number;
  };

  /** Optional: coverage percentage if applicable */
  coverage?: number;

  /** Optional: additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * A postcondition clause from a specification.
 */
export interface SpecClause {
  /** Unique identifier for the clause */
  id: string;

  /** The condition expression (e.g., "result.status == 'success'") */
  expression: string;

  /** Human-readable description */
  description?: string;

  /** Category of the postcondition */
  category?: 'success' | 'error' | 'invariant' | 'state_change' | 'general';

  /** Optional: the behavior this postcondition belongs to */
  behaviorId?: string;

  /** Optional: whether this is a conditional postcondition (implies) */
  isConditional?: boolean;

  /** Optional: the antecedent for conditional postconditions */
  antecedent?: string;
}

/**
 * Result of evaluating a single postcondition clause.
 */
export interface ClauseResult {
  /** The clause that was evaluated */
  clauseId: string;

  /** Final status determination */
  status: PostconditionStatus;

  /** Primary evidence type that determined the status */
  evidenceType: EvidenceType;

  /** All evidence collected for this clause */
  evidence: Evidence[];

  /** Notes explaining the evaluation */
  notes: string[];

  /** Required next step to improve status (for PARTIAL/FAIL) */
  requiredNextStep?: string;

  /** Confidence score (0-1) in the evaluation */
  confidence: number;
}

/**
 * Input to the postcondition evaluator.
 */
export interface EvaluationInput {
  /** Specification clauses to evaluate */
  specClauses: SpecClause[];

  /** Evidence collected from various sources */
  evidence: Evidence[];
}

/**
 * Output from the postcondition evaluator.
 */
export interface EvaluationResult {
  /** Results for each clause */
  clauseResults: ClauseResult[];

  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    partial: number;
    failed: number;
    passRate: number;
  };

  /** Timestamp of evaluation */
  evaluatedAt: string;
}

/**
 * Configuration for the evaluator.
 */
export interface EvaluatorConfig {
  /** Minimum coverage percentage to consider EXECUTED_TEST as PASS */
  minCoverageForPass?: number;

  /** Whether to require explicit test execution for PASS */
  requireExecutedTests?: boolean;

  /** Whether to allow HEURISTIC_MATCH to contribute to PARTIAL */
  allowHeuristicPartial?: boolean;

  /** Custom evidence priority overrides */
  evidencePriority?: Partial<Record<EvidenceType, number>>;
}
