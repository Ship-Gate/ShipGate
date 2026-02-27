/**
 * ISL Certificate Types
 *
 * Trust artifact that proves AI-generated code was verified against its ISL specification.
 * @module @isl-lang/isl-certificate
 */

/** Certificate version */
export type CertificateVersion = '1.0';

/** Verdict from verification pipeline */
export type CertificateVerdict = 'SHIP' | 'NO_SHIP' | 'REVIEW';

/** File tier for generated artifacts (1=critical, 2=important, 3=supplementary) */
export type FileTier = 1 | 2 | 3;

/** Security check result */
export interface SecurityCheck {
  check: string;
  passed: boolean;
  details?: string;
}

/** Pipeline stage result */
export interface PipelineStage {
  name: string;
  duration: number;
  status: string;
}

/** Generated file entry with hash and coverage */
export interface GeneratedFileEntry {
  path: string;
  hash: string;
  tier: FileTier;
  specCoverage: number;
}

/** Prompt info (hash + preview) */
export interface PromptInfo {
  hash: string;
  preview: string;
}

/** ISL spec info */
export interface IslSpecInfo {
  hash: string;
  version: string;
  constructCount: number;
}

/** Verification summary */
export interface VerificationInfo {
  verdict: CertificateVerdict;
  trustScore: number;
  evidenceCount: number;
  testsRun: number;
  testsPassed: number;
  securityChecks: SecurityCheck[];
}

/** Model info */
export interface ModelInfo {
  provider: string;
  model: string;
  tokensUsed: number;
}

/** Pipeline timing info */
export interface PipelineInfo {
  duration: number;
  stages: PipelineStage[];
}

/**
 * ISL Certificate - Trust artifact for AI-generated code verification
 *
 * Proves that generated code was verified against its ISL specification.
 * Signed with HMAC-SHA256 using user's API key for tamper detection.
 */
export interface ISLCertificate {
  version: CertificateVersion;
  id: string;
  timestamp: string;
  prompt: PromptInfo;
  islSpec: IslSpecInfo;
  generatedFiles: GeneratedFileEntry[];
  verification: VerificationInfo;
  model: ModelInfo;
  pipeline: PipelineInfo;
  signature: string;
}

/** Input for certificate generation */
export interface CertificateInput {
  prompt: string;
  islSpec: {
    content: string;
    version: string;
    constructCount: number;
  };
  generatedFiles: Array<{
    path: string;
    content?: string; // Omit to read from disk
    tier: FileTier;
    specCoverage: number;
  }>;
  verification: {
    verdict: CertificateVerdict;
    trustScore: number;
    evidenceCount: number;
    testsRun: number;
    testsPassed: number;
    securityChecks?: SecurityCheck[];
  };
  model: ModelInfo;
  pipeline: {
    duration: number;
    stages: PipelineStage[];
  };
}
