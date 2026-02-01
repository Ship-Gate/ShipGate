// ============================================================================
// ISL Formal Verifier
// Translates ISL specs to SMT-LIB and verifies with Z3
// ============================================================================

export { verify } from './translator';
export type {
  FormalVerifyResult,
  PropertyResult,
  Counterexample,
  VerifyOptions,
} from './translator';

// Re-export submodules for advanced usage
export * as solver from './solver';
export * as encoding from './encoding';
export * as counterexample from './counterexample';
export * as report from './report';
