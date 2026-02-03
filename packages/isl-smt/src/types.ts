/**
 * ISL SMT Integration Types
 * 
 * Type definitions for SMT solver integration.
 */

// Re-export SMT types from prover
export type {
  SMTSort,
  SMTExpr,
  SMTDecl,
  VerificationResult,
  Counterexample,
  ProverConfig,
} from '@isl-lang/prover';

/**
 * SMT check result
 */
export type SMTCheckResult = 
  | { status: 'sat'; model?: Record<string, unknown> }
  | { status: 'unsat' }
  | { status: 'unknown'; reason: string }
  | { status: 'timeout' }
  | { status: 'error'; message: string };

/**
 * SMT verification options
 */
export interface SMTVerifyOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Produce counterexample models */
  produceModels?: boolean;
  /** Verbose logging */
  verbose?: boolean;
  /** Solver to use (default: builtin, can use z3 if available) */
  solver?: 'builtin' | 'z3' | 'cvc5';
}

// Import types from ISL core
import type { ConditionStatement, TypeConstraint } from '@isl-lang/isl-core/ast';

/**
 * Precondition check request
 */
export interface PreconditionCheck {
  /** Name of the behavior */
  behaviorName: string;
  /** Precondition expressions */
  conditions: ConditionStatement[];
  /** Input variable types */
  inputTypes: Map<string, string>;
}

/**
 * Postcondition check request  
 */
export interface PostconditionCheck {
  /** Name of the behavior */
  behaviorName: string;
  /** Precondition expressions (assumptions) */
  preconditions: ConditionStatement[];
  /** Postcondition expressions (to verify) */
  postconditions: ConditionStatement[];
  /** Input variable types */
  inputTypes: Map<string, string>;
  /** Output type */
  outputType: string;
}

/**
 * Refinement type check request
 */
export interface RefinementCheck {
  /** Name of the type */
  typeName: string;
  /** Base type */
  baseType: string;
  /** Constraints to check */
  constraints: TypeConstraint[];
}

/**
 * SMT check kind
 */
export type SMTCheckKind = 
  | 'precondition_satisfiability'
  | 'postcondition_implication'
  | 'refinement_constraint';

/**
 * Full SMT verification result
 */
export interface SMTVerificationResult {
  /** Check kind */
  kind: SMTCheckKind;
  /** Name of the checked item */
  name: string;
  /** Result of the check */
  result: SMTCheckResult;
  /** Time taken in ms */
  duration: number;
  /** Generated SMT-LIB code (for debugging) */
  smtLib?: string;
}

/**
 * Batch verification result
 */
export interface SMTBatchResult {
  /** All results */
  results: SMTVerificationResult[];
  /** Summary */
  summary: {
    total: number;
    sat: number;
    unsat: number;
    unknown: number;
    timeout: number;
    error: number;
  };
  /** Total duration */
  duration: number;
}

/**
 * Tri-state solve result
 * 
 * The three states are:
 * - proved: The property is definitively true (formula is unsatisfiable when negated)
 * - disproved: The property is definitively false (found a counterexample)
 * - unknown: Cannot determine either way (with reason)
 */
export type SolveResult = 
  | { verdict: 'proved' }
  | { verdict: 'disproved'; model?: Record<string, unknown>; reason?: string }
  | { verdict: 'unknown'; reason: string };

// ============================================================================
// Solver Evidence Types (for proof bundles)
// ============================================================================

/**
 * Evidence from SMT solver execution
 * 
 * This is attached to proof bundles to provide:
 * - Reproducibility: contains query hash for deterministic replay
 * - Auditability: records solver used, version, and timing
 * - Debugging: includes raw query and model for inspection
 */
export interface SolverEvidence {
  /** Hash of the SMT query (for caching and reproducibility) */
  queryHash: string;
  /** Solver used */
  solver: 'builtin' | 'z3' | 'cvc5';
  /** Solver version (if external) */
  solverVersion?: string;
  /** Result status */
  status: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';
  /** Model (if sat) */
  model?: Record<string, unknown>;
  /** Reason (if unknown or error) */
  reason?: string;
  /** Time spent solving (ms) */
  durationMs: number;
  /** Raw SMT-LIB query (for debugging) */
  smtLibQuery?: string;
  /** Timestamp of execution */
  timestamp: string;
}

/**
 * Verification result with solver evidence
 */
export interface VerificationWithEvidence {
  /** The verification result */
  result: SolveResult;
  /** Solver evidence (if solver was invoked) */
  evidence?: SolverEvidence;
  /** Whether solver was invoked (vs. runtime evaluation) */
  solverInvoked: boolean;
  /** Reason solver was invoked (if applicable) */
  solverInvocationReason?: 'runtime_unknown' | 'formal_mode' | 'explicit_request';
}

/**
 * Proof bundle entry with optional solver evidence
 */
export interface ProofBundleEntry {
  /** Unique identifier for this proof entry */
  id: string;
  /** Type of verification performed */
  kind: SMTCheckKind | 'runtime' | 'mixed';
  /** Name of the verified item */
  name: string;
  /** Expression that was verified (as string) */
  expression: string;
  /** Final verdict */
  verdict: 'proved' | 'disproved' | 'unknown';
  /** Runtime evidence (if runtime verification was performed) */
  runtimeEvidence?: {
    sampleCount: number;
    passCount: number;
    failCount: number;
    unknownCount: number;
  };
  /** Solver evidence (if solver was invoked) */
  solverEvidence?: SolverEvidence;
  /** How the final verdict was determined */
  verdictSource: 'runtime_only' | 'solver_only' | 'runtime_then_solver';
}

// Note: ConditionStatement and TypeConstraint are used in other files
// that import from this types file, but are re-exported from isl-core/ast
