import { timingSafeEqual } from 'node:crypto';
import type { CheckResult, ProofManifest } from '../types.js';
import { computeHmac } from '../hash.js';

/**
 * If a signature is present, verifies it using HMAC-SHA256.
 * Uses timing-safe comparison to prevent timing attacks.
 * If no key is provided but a signature exists, the check fails.
 */
export function verifySignature(
  manifest: ProofManifest,
  rawContent: string,
  key?: string,
): CheckResult {
  if (!manifest.signature) {
    return { name: 'signature', passed: true, details: 'No signature present (optional)' };
  }

  if (!key) {
    return { name: 'signature', passed: false, details: 'Signature present but no verification key provided' };
  }

  const expected = computeHmac(rawContent, key);

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(manifest.signature, 'hex');

  if (a.length !== b.length) {
    return { name: 'signature', passed: false, details: 'Signature length mismatch' };
  }

  const passed = timingSafeEqual(a, b);

  return {
    name: 'signature',
    passed,
    details: passed ? 'HMAC-SHA256 signature valid' : 'Signature verification failed',
  };
}
