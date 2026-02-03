/**
 * ISL SMT Integration
 * 
 * SMT solver integration for ISL specifications.
 * Provides:
 * - Satisfiability checking for preconditions
 * - Postcondition implication verification
 * - Refinement type constraint checking
 * - Query caching for deterministic results
 * - Bounded integer arithmetic solving
 * 
 * @example
 * ```typescript
 * import { verifySMT, SMTVerifier, solve } from '@isl-lang/isl-smt';
 * 
 * // Verify a domain
 * const result = await verifySMT(domain, {
 *   timeout: 5000,
 *   solver: 'builtin', // or 'z3' if available
 * });
 * 
 * console.log(result.summary);
 * // { total: 5, sat: 4, unsat: 0, unknown: 1, timeout: 0, error: 0 }
 * 
 * // Direct solve for expression checking
 * const smtResult = await solve(Expr.and(
 *   Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
 *   Expr.lt(Expr.var('x', Sort.Int()), Expr.int(100))
 * ), { timeout: 1000 });
 * // { status: 'sat', model: { x: 50 } }
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
  SolveResult,
  SolverEvidence,
  VerificationWithEvidence,
  ProofBundleEntry,
} from './types.js';

// Re-export SMT types from prover for convenience
export type {
  SMTSort,
  SMTExpr,
  SMTDecl,
  VerificationResult,
  Counterexample,
} from './types.js';

// Cache
export {
  SMTCache,
  getGlobalCache,
  resetGlobalCache,
  type CacheConfig,
} from './cache.js';

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
  isCVC5Available,
  getSolverAvailability,
  solve,
  translate,
  type ISMTSolver,
} from './solver.js';

// External Solver Adapter
export {
  runSolver,
  checkSatExternal,
  checkSolverAvailability,
  checkAllSolvers,
  getBestAvailableSolver,
  clearSolverCache,
  type ExternalSolver,
  type ExternalSolverConfig,
  type SolverAvailability,
  type SolverExecResult,
  type SolverStats,
} from './external-solver.js';

// Verifier
export {
  SMTVerifier,
  verifySMT,
  checkExpression,
  resolveUnknown,
  verifyFormal,
  type UnknownResolution,
  type FormalModeOptions,
} from './verifier.js';

// Re-export useful utilities from prover
export { Expr, Sort, Decl, toSMTLib } from '@isl-lang/prover';
