/**
 * ISL Certificate - Trust Artifact for AI-Generated Code
 *
 * Proves that AI-generated code was verified against its ISL specification.
 * Generates signed certificates at pipeline end; verifies integrity on demand.
 *
 * @module @isl-lang/isl-certificate
 *
 * @example
 * ```typescript
 * import { generateCertificate, verifyCertificate } from '@isl-lang/isl-certificate';
 *
 * // Generate at pipeline end
 * const cert = await generateCertificate(input, { projectRoot: '/path', apiKey: '...' });
 *
 * // Verify later
 * const result = await verifyCertificate(cert, '/path');
 * if (!result.valid) console.error(result.errors);
 * ```
 */

export {
  generateCertificate,
  generateAndSaveCertificate,
  CERTIFICATE_FILENAME,
} from './generator.js';
export { verifyCertificate, type VerificationResult } from './verifier.js';
export {
  buildCertificateInputFromPipeline,
  type CertificateOverrides,
} from './pipeline-adapter.js';
export { sha256, hmacSha256, getSignableContent } from './hash.js';

export type {
  ISLCertificate,
  CertificateInput,
  CertificateVersion,
  CertificateVerdict,
  FileTier,
  SecurityCheck,
  PipelineStage,
  GeneratedFileEntry,
  PromptInfo,
  IslSpecInfo,
  VerificationInfo,
  ModelInfo,
  PipelineInfo,
} from './types.js';
