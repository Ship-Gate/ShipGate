/**
 * ISL Verify
 * 
 * Verification engine for ISL implementations.
 */

export * from './runner/index';
export * from './reporter/index';
export * from './runtime/index';
export * from './history/index';
export * from './compliance/index';

// Proof bundle exports - renamed to avoid conflict with reporter's calculateTrustScore
export {
  ImportIntegrityProver,
  AuthCoverageProver,
  createAuthCoverageProver,
  SecretExposureProver,
  SQLInjectionProver,
  ErrorHandlingProver,
  TypeSafetyProver,
  ProofBundleGenerator,
  BundleVerifier,
  calculateTrustScore as calculateProofTrustScore,
  getTrustScoreGrade,
  getTrustScoreVerdict,
  generateResidualRisks,
  categorizeRisks,
  formatBundleAsJson,
  formatBundleAsMarkdown,
  formatBundleAsPRComment,
  createSignature,
  verifySignature,
} from './proof/index.js';

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
  FileHash,
  RouteInfo,
  AuthConfig,
  BundleGeneratorOptions,
  ProverResult,
  BundleVerificationResult,
  SignatureOptions,
} from './proof/index.js';

import type { Domain } from '@isl-lang/parser';
import { runTests, type TestResult, type RunnerOptions } from './runner/index';
import { 
  calculateTrustScore, 
  formatTrustReport, 
  type TrustScore, 
  type TrustCalculatorOptions 
} from './reporter/index';

export interface VerificationResult {
  testResult: TestResult;
  trustScore: TrustScore;
  report: string;
}

export interface VerifyOptions {
  runner?: RunnerOptions;
  trustCalculator?: TrustCalculatorOptions;
}

/**
 * Verify an implementation against an ISL domain
 */
export async function verify(
  domain: Domain,
  implementationCode: string,
  options?: VerifyOptions
): Promise<VerificationResult> {
  // Run tests
  const testResult = await runTests(domain, implementationCode, options?.runner);

  // Calculate trust score
  const trustScore = calculateTrustScore(testResult, options?.trustCalculator);

  // Generate report
  const report = formatTrustReport(trustScore);

  return {
    testResult,
    trustScore,
    report,
  };
}
