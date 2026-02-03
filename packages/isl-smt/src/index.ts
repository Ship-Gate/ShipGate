/**
 * ISL SMT Integration
 * 
 * SMT solver integration for ISL specifications.
 * Provides:
 * - Satisfiability checking for preconditions
 * - Postcondition implication verification
 * - Refinement type constraint checking
 * 
 * @example
 * ```typescript
 * import { verifySMT, SMTVerifier } from '@isl-lang/isl-smt';
 * 
 * // Verify a domain
 * const result = await verifySMT(domain, {
 *   timeout: 5000,
 *   solver: 'builtin', // or 'z3' if available
 * });
 * 
 * console.log(result.summary);
 * // { total: 5, sat: 4, unsat: 0, unknown: 1, timeout: 0, error: 0 }
 * ```
 */

// Types
export type {
  SMTCheckResult,
  SMTVerifyOptions,
  PreconditionCheck,
  PostconditionCheck,
  RefinementCheck,
  SMTCheckKind,
  SMTVerificationResult,
  SMTBatchResult,
} from './types.js';

// Re-export SMT types from prover for convenience
export type {
  SMTSort,
  SMTExpr,
  SMTDecl,
  VerificationResult,
  Counterexample,
} from './types.js';

// Encoder
export {
  encodeExpression,
  encodeCondition,
  encodeTypeConstraint,
  createContext,
  islTypeToSort,
  type EncodingContext,
  type EncodeResult,
} from './encoder.js';

// Solver
export {
  createSolver,
  isZ3Available,
  type ISMTSolver,
} from './solver.js';

// Verifier
export {
  SMTVerifier,
  verifySMT,
  checkExpression,
} from './verifier.js';
