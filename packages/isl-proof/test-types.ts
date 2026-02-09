/**
 * Type Fixture - Verifies that all exported types from @isl-lang/proof are properly typed
 * 
 * This file should compile without errors when imported by consumers.
 * Run: pnpm --filter @isl-lang/proof typecheck
 */

import type {
  // Legacy v1 types
  ProofBundle,
  Evidence,
  TestEvidence,
  GateEvidence,
  GateViolation,
  ProofChainEntry,
  VerificationResult,
  
  // Manifest v2 types
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
  StdlibVersion,
  ImportResolution,
  ImportGraph,
  TraceRef,
  ClauseVerifyResult,
  VerifyResults,
  TestsSummary,
  VerdictOptions,
  
  // Writer types
  WriterOptions,
  SpecInput,
  GateInput,
  IterationInput,
  WriteResult,
  TraceSummary,
  
  // Verifier types
  VerificationSeverity,
  VerificationIssue,
  VerificationResult as VerificationResultV2,
  VerifyOptions,
  
  // Verification engine types
  TraceEvent,
  TraceSlice,
  SourceSpanInfo,
  EvaluationResult,
  ClauseEvidence,
  VerificationVerdict,
  VerificationResult as VerificationEngineResult,
  
  // Proof verify types
  ProofVerifyOptions,
  ProofVerifyResult,
  ProofVerifyCheck,
  FailClosedSummary,
  
  // Migration types
  MigrationOptions,
  MigrationResult,
  
  // Bundle v1 types
  ProofBundleV1,
  CreateBundleInput,
  BundleVerdict,
  BundleClaim,
  ClaimStatus,
  BundleVerdictArtifact,
  BundleTraceRef,
  BundleEvidence,
  VerifyBundleResult,
  VerifyBundleCheck,
  
  // Claim graph types
  UnifiedClaim,
  ClaimGraph,
  ClaimKind,
  ClaimStatus as UnifiedClaimStatus,
  ClaimSubject,
  ClaimLocation,
  ClaimEvidence,
  ClaimRelationship,
  GraphBuilderOptions,
  
  // Claim integration types
  ClaimCollection,
  
  // ZIP types
  ZipBundleOptions,
  ZipBundleResult,
  ZipVerifyOptions,
  ZipVerifyResult,
} from './index.js';

import {
  // Legacy v1 functions
  ProofBundleBuilder,
  createProofBundle,
  verifyBundle,
  formatProofBundle,
  
  // Manifest functions
  calculateVerdict,
  calculateVerdictV2,
  calculateBundleId,
  calculateSpecHash,
  createStdlibVersion,
  calculateStdlibManifestHash,
  signManifest,
  verifyManifestSignature,
  
  // Writer functions
  ProofBundleWriter,
  createProofBundleWriter,
  
  // Verifier functions
  verifyProofBundle,
  formatVerificationResult,
  isValidBundle,
  isProvenEnough,
  
  // Migration functions
  migrateV1ToV2,
  
  // Verification engine functions
  VerificationEngine,
  verifyDomain,
  
  // Proof verify functions
  verifyProof,
  formatProofVerificationResult,
  
  // Canonical JSON functions
  canonicalJsonStringify,
  canonicalJsonCompact,
  normalizeJson,
  
  // Bundle v1 functions
  createBundle,
  verifyBundle as verifyBundleV1,
  bundleHash,
  serializeBundle,
  parseBundle,
  
  // Claim graph functions
  ClaimGraphBuilder,
  createClaimGraphBuilder,
  buildClaimGraph,
  
  // Claim adapter functions
  fromBundleClaim,
  fromClaimsVerifierClaim,
  fromFirewallClaim,
  fromVerifierClauseResult,
  createRouteClaim,
  createEnvClaim,
  
  // Claim export functions
  exportClaimGraphToJson,
  exportClaimGraphToHtml,
  serializeClaimGraph,
  
  // Claim integration functions
  buildUnifiedClaimGraph,
  extractClaimsFromProofBundle,
  extractClaimsFromVerifierReport,
  mergeClaimCollections,
  
  // ZIP functions
  createZipBundle,
  collectFiles,
  scanDirectory,
  verifyZipBundle,
  extractZip,
  verifyEd25519Signature,
  
  // HTML viewer functions
  generateHtmlViewer,
} from './index.js';

// Type assertions to ensure types are properly exported
const _testTypes: {
  verdict: ProofVerdict;
  manifest: ProofBundleManifest;
  bundle: ProofBundle;
  bundleV1: ProofBundleV1;
  claim: UnifiedClaim;
  graph: ClaimGraph;
} = {} as any;

// Function call tests (compile-time only)
function testFunctions() {
  // These should all compile without errors
  const writer = createProofBundleWriter({ projectRoot: '/test', outputDir: '/test' });
  const builder = createProofBundle({} as any);
  const graphBuilder = createClaimGraphBuilder();
  
  // Verify return types are explicit (not inferred)
  const verdict: ProofVerdict = 'PROVEN';
  const bundleId: string = calculateBundleId({} as any);
  const hash: string = bundleHash({} as any);
  
  return { writer, builder, graphBuilder, verdict, bundleId, hash };
}

// Ensure no implicit any
function testNoImplicitAny<T extends Record<string, unknown>>(obj: T): T {
  return obj;
}

export type { 
  ProofBundle,
  ProofBundleManifest,
  ProofVerdict,
  UnifiedClaim,
  ClaimGraph,
};
