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
