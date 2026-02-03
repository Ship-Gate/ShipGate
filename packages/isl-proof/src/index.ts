/**
 * ISL Proof Bundle
 * 
 * Creates verifiable proof that ISL specifications are satisfied.
 * 
 * @module @isl-lang/proof
 */

// Legacy proof bundle (v1)
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

// Enhanced proof bundle manifest (v2)
export {
  calculateVerdict,
  calculateVerdictV2,
  calculateBundleId,
  calculateSpecHash,
  createStdlibVersion,
  calculateStdlibManifestHash,
  signManifest,
  verifyManifestSignature,
} from './manifest.js';

export type {
  ProofVerdict,
  ProofBundleManifest,
  BuildResult,
  TestResult,
  TestFileResult,
  ManifestGateResult,
  ManifestViolation,
  RulepackVersion,
  IterationRecord,
  PatchRecord,
  DomainTestDeclaration,
  VerificationEvaluationResult,
  PostconditionVerificationResult,
  // V2 types
  StdlibVersion,
  ImportResolution,
  ImportGraph,
  TraceRef,
  ClauseVerifyResult,
  VerifyResults,
  TestsSummary,
  VerdictOptions,
} from './manifest.js';

// Proof bundle writer
export {
  ProofBundleWriter,
  createProofBundleWriter,
} from './writer.js';

export type {
  WriterOptions,
  SpecInput,
  GateInput,
  IterationInput,
  WriteResult,
  TraceSummary,
} from './writer.js';

// Proof bundle verifier
export {
  verifyProofBundle,
  formatVerificationResult,
  isValidBundle,
  isProvenEnough,
} from './verifier.js';

// Migration tool
export {
  migrateV1ToV2,
} from './migrate.js';

export type {
  MigrationOptions,
  MigrationResult,
} from './migrate.js';

export type {
  VerificationSeverity,
  VerificationIssue,
  VerificationResult as VerificationResultV2,
  VerifyOptions,
} from './verifier.js';

// Verification engine
export {
  VerificationEngine,
  verifyDomain,
} from './verification-engine.js';

export type {
  TraceEvent,
  TraceSlice,
  SourceSpanInfo,
  EvaluationResult,
  ClauseEvidence,
  VerificationVerdict,
  VerificationResult as VerificationEngineResult,
} from './verification-engine.js';

// Proof verification CLI (fail-closed)
export {
  verifyProof,
  formatVerificationResult as formatProofVerificationResult,
} from './proof-verify.js';

export type {
  ProofVerifyOptions,
  ProofVerifyResult,
  ProofVerifyCheck,
  FailClosedSummary,
} from './proof-verify.js';
