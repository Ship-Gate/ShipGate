/**
 * ISL Formal Verification
 * 
 * Mathematical proof generation and verification for ISL specifications.
 */

export {
  TheoremProver,
  prove,
  type Theorem,
  type Proof,
  type ProofResult,
  type ProverOptions,
} from './prover.js';

export {
  SymbolicExecutor,
  execute,
  type SymbolicState,
  type ExecutionPath,
  type PathCondition,
} from './symbolic.js';

export {
  InvariantChecker,
  checkInvariant,
  type InvariantResult,
  type CounterExample,
} from './invariant.js';

export {
  ContractVerifier,
  verifyContract,
  type ContractProof,
  type WeakestPrecondition,
} from './contracts.js';

export {
  ModelChecker,
  checkModel,
  type ModelCheckResult,
  type StateSpace,
  type Trace,
} from './model-checker.js';

export {
  SMTSolver,
  solve,
  type SMTFormula,
  type SMTResult,
  type Assignment,
} from './smt.js';
