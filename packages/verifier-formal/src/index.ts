// ============================================================================
// ISL Formal Verifier
// Translates ISL specs to SMT-LIB and verifies with Z3
// ============================================================================

// Legacy exports (for backward compatibility)
export { verify } from './translator';
export type {
  FormalVerifyResult,
  PropertyResult,
  Counterexample,
  VerifyOptions,
} from './translator';

// Authoritative verification (preferred)
export {
  verifyAuthoritative,
  formatVerificationResult,
} from './authoritative-translator';
export type {
  AuthoritativeVerifyResult,
  AuthoritativePropertyResult,
  VerificationSummary,
  AuthoritativeVerifyOptions,
} from './authoritative-translator';

// Authoritative solver
export {
  AuthoritativeSolver,
  createSolver,
  verifyQuery,
} from './authoritative-solver';
export type {
  AuthoritativeSolverOptions,
  SolverResult,
} from './authoritative-solver';

// Verdict types
export type {
  Verdict,
  ProvedVerdict,
  DisprovedVerdict,
  UnknownVerdict,
  UnknownReason,
  CounterexampleData,
  ComplexityAnalysis,
} from './verdict';
export {
  createProvedVerdict,
  createDisprovedVerdict,
  createUnknownVerdict,
  formatVerdict,
  formatUnknownReason,
  aggregateVerdicts,
} from './verdict';

// Complexity analysis
export {
  analyzeComplexity,
  checkComplexityLimits,
  estimateTimeout,
  DEFAULT_LIMITS,
  STRICT_LIMITS,
  PERMISSIVE_LIMITS,
} from './complexity';
export type { ComplexityLimits } from './complexity';

// Re-export submodules for advanced usage
export * as solver from './solver';
export * as encoding from './encoding';
export * as counterexample from './counterexample';
export * as report from './report';
