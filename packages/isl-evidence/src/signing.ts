/**
 * ISL Evidence - Signing & Verification
 * 
 * Tamper-resistant evidence bundles using SHA-256.
 * 
 * @module @isl-lang/evidence
 */

import * as crypto from 'crypto';

/**
 * Evidence signature data
 */
export interface EvidenceSignature {
  /** SHA-256 hash of the manifest */
  manifestHash: string;
  /** SHA-256 hash of the results */
  resultsHash: string;
  /** Combined integrity hash */
  integrityHash: string;
  /** Signing algorithm */
  algorithm: 'sha256';
  /** When signature was created */
  signedAt: string;
  /** Signing version */
  version: '1.0';
}

/**
 * Compute SHA-256 hash of content
 */
export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Deterministically serialize an object
 * - Sorted keys
 * - No extra whitespace in production mode
 * - Consistent formatting
 */
export function deterministicSerialize(obj: unknown, pretty = false): string {
  return JSON.stringify(obj, sortedReplacer, pretty ? 2 : 0);
}

/**
 * JSON replacer that sorts object keys
 */
function sortedReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = (value as Record<string, unknown>)[key];
        return sorted;
      }, {} as Record<string, unknown>);
  }
  return value;
}

/**
 * Create a signature for evidence files
 */
export function createSignature(
  manifestContent: string,
  resultsContent: string,
  deterministic = false
): EvidenceSignature {
  const manifestHash = computeHash(manifestContent);
  const resultsHash = computeHash(resultsContent);
  
  // Combined integrity hash = hash of concatenated hashes
  const integrityHash = computeHash(`${manifestHash}:${resultsHash}`);

  return {
    manifestHash,
    resultsHash,
    integrityHash,
    algorithm: 'sha256',
    signedAt: deterministic ? '1970-01-01T00:00:00.000Z' : new Date().toISOString(),
    version: '1.0',
  };
}

/**
 * Verify evidence bundle integrity
 */
export function verifySignature(
  signature: EvidenceSignature,
  manifestContent: string,
  resultsContent: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Verify manifest hash
  const actualManifestHash = computeHash(manifestContent);
  if (actualManifestHash !== signature.manifestHash) {
    errors.push(`Manifest hash mismatch: expected ${signature.manifestHash}, got ${actualManifestHash}`);
  }

  // Verify results hash
  const actualResultsHash = computeHash(resultsContent);
  if (actualResultsHash !== signature.resultsHash) {
    errors.push(`Results hash mismatch: expected ${signature.resultsHash}, got ${actualResultsHash}`);
  }

  // Verify integrity hash
  const actualIntegrityHash = computeHash(`${actualManifestHash}:${actualResultsHash}`);
  if (actualIntegrityHash !== signature.integrityHash) {
    errors.push(`Integrity hash mismatch: expected ${signature.integrityHash}, got ${actualIntegrityHash}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a short fingerprint from content
 * Used for quick identification
 */
export function createFingerprint(content: string): string {
  const hash = computeHash(content);
  return hash.substring(0, 16);
}

/**
 * Verify that a fingerprint matches content
 */
export function verifyFingerprint(fingerprint: string, content: string): boolean {
  const expected = createFingerprint(content);
  return fingerprint === expected;
}
