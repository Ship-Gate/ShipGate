/**
 * Security Verifier Enhancer
 * 
 * Agent 35 — Security Verifier Enhancer
 * Detects auth drift: endpoints that require auth per ISL but don't enforce it, and vice versa.
 */

export type {
  ISLAuthRequirement,
  ObservedAuthPolicy,
  AuthDriftClaim,
  AuthDriftResult,
  AuthDriftConfig,
} from './types.js';

export {
  extractISLAuthRequirements,
  extractAllISLAuthRequirements,
} from './isl-extractor.js';

export {
  extractObservedAuthPolicies,
  extractAllObservedAuthPolicies,
} from './route-detector.js';

export {
  detectAuthDrift,
} from './drift-detector.js';

export {
  SecurityVerifierEnhancer,
} from './enhancer.js';
