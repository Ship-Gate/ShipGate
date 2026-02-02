/**
 * ISL Evidence - Tamper-Resistant Evidence Bundles
 * 
 * Generates signed, verifiable evidence bundles for gate decisions.
 * 
 * @module @isl-lang/evidence
 * 
 * @example
 * ```typescript
 * import { writeEvidenceBundle, verifyEvidenceBundle } from '@isl-lang/evidence';
 * 
 * // Write evidence
 * const evidencePath = await writeEvidenceBundle(
 *   gateResult,
 *   findings,
 *   { outputDir: '.isl-gate/evidence', projectRoot: '/path/to/project' }
 * );
 * 
 * // Verify integrity
 * const { valid, errors } = await verifyEvidenceBundle(evidencePath);
 * if (!valid) {
 *   console.error('Evidence tampered:', errors);
 * }
 * ```
 */

export {
  writeEvidenceBundle,
  readEvidenceBundle,
  validateEvidenceBundle,
  verifyEvidenceBundle,
} from './bundle-writer.js';

export { generateHtmlReport } from './html-report.js';

export {
  createSignature,
  verifySignature,
  computeHash,
  deterministicSerialize,
  createFingerprint,
  verifyFingerprint,
  type EvidenceSignature,
} from './signing.js';

export type {
  EvidenceManifest,
  EvidenceResults,
  EvidenceBundle,
  EvidenceOptions,
} from './types.js';
