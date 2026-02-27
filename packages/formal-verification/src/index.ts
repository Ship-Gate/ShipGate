/**
 * ISL Formal Verification
 * 
 * Mathematical proof generation and verification for ISL specifications.
 */

// Types
export type {
  VerificationResult,
  Proof,
  ProofMethod,
  ProofStep,
  Counterexample,
  ExecutionTrace,
  TraceStep,
  VerificationTarget,
  VerificationContext,
  Formula,
  Sort,
  Variable,
  VerifierConfig,
  ISLSpecification,
  ISLType,
  ISLConstraint,
  ISLEntity,
  ISLField,
  ISLBehavior,
  ISLOutput,
  ISLError,
  ISLInvariant,
} from './types.js';

export { defaultConfig } from './types.js';

// Contract translation
export {
  translateToFormula,
  translatePrecondition,
  translatePostcondition,
} from './contracts.js';

// Proof generation
export {
  ProofBuilder,
  formatProof,
  verifyProof,
  Tactics,
} from './proofs.js';

// SMT Solver
export {
  SMTSolver,
  createRealSolver,
  createDemoSolver,
  type SMTResult,
  type SMTStats,
  type SolverMode,
  type SMTSolverConfig,
} from './smt.js';

// Invariant checking
export {
  InvariantChecker,
  InvariantInference,
  createInvariantChecker,
  createInvariantInference,
  type InductiveCheckResult,
} from './invariants.js';

// Verifier
export {
  Verifier,
  createVerifier,
  type VerificationReport,
} from './verifier.js';
