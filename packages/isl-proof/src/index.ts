/**
 * ISL Proof Bundle
 * 
 * Creates verifiable proof that ISL specifications are satisfied.
 * 
 * @module @isl-lang/proof
 */

export {
  ProofBundleBuilder,
  createProofBundle,
  verifyBundle,
  formatProofBundle,
} from './proof-bundle.js';

export type {
  ProofBundle,
  Evidence,
  TestEvidence,
  GateEvidence,
  GateViolation,
  ProofChainEntry,
  VerificationResult,
} from './proof-bundle.js';
