export { ImportIntegrityProver } from './import-integrity-prover.js';
export { AuthCoverageProver, createAuthCoverageProver } from './auth-coverage.js';
export { SecretExposureProver } from './secret-exposure-prover.js';
export { SQLInjectionProver } from './sql-injection-prover.js';
export { ErrorHandlingProver } from './error-handling-prover.js';
export { TypeSafetyProver } from './type-safety-prover.js';

export { ProofBundleGenerator } from './bundle-generator.js';
export { BundleVerifier } from './bundle-verifier.js';
export { calculateTrustScore, getTrustScoreGrade, getTrustScoreVerdict } from './trust-score.js';
export { generateResidualRisks, categorizeRisks } from './residual-risks.js';
export { formatBundleAsJson, formatBundleAsMarkdown, formatBundleAsPRComment } from './formatters.js';
export { createSignature, verifySignature } from './signature.js';

export type { 
  ImportEvidence, 
  AuthEvidence, 
  SecretEvidence,
  SQLEvidence,
  ErrorHandlingEvidence,
  TypeSafetyEvidence,
  PropertyProof, 
  Finding, 
  PropertyStatus,
  PropertyName,
  PropertyProver,
  ProjectContext,
  ProofBundle,
  FileHash
} from './types.js';
export type { RouteInfo, AuthConfig } from './auth-coverage.js';
export type { BundleGeneratorOptions, ProverResult } from './bundle-generator.js';
export type { BundleVerificationResult } from './bundle-verifier.js';
export type { SignatureOptions } from './signature.js';
