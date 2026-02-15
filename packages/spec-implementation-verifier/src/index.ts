/**
 * Spec Implementation Verifier
 *
 * Verification engine that checks whether code actually implements
 * what the inferred spec says it should.
 *
 * Catches: hallucinated imports, dead endpoints, broken auth,
 * mismatched types, untested paths.
 *
 * @module @isl-lang/spec-implementation-verifier
 */

export { VerificationEngine, verifyImplementation } from './verification-engine.js';
export type {
  VerificationEngineOptions,
  VerificationResult,
} from './verification-engine.js';

export type {
  Finding,
  FindingSeverity,
  InferredSpec,
  SpecRoute,
  SpecEntity,
  SpecBehavior,
  VerificationContext,
  VerifierChecker,
} from './types.js';

// Individual checkers (for custom engine composition)
export { runImportVerifier } from './checkers/import-verifier.js';
export { runTypeConsistencyVerifier } from './checkers/type-consistency-verifier.js';
export { runEndpointVerifier } from './checkers/endpoint-verifier.js';
export { runAuthVerifier } from './checkers/auth-verifier.js';
export { runDeadCodeVerifier } from './checkers/dead-code-verifier.js';
export { runBehavioralVerifier } from './checkers/behavioral-verifier.js';
