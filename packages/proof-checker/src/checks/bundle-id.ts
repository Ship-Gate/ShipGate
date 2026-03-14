import type { CheckResult, ProofManifest } from '../types.js';
import { canonicalize, computeHash } from '../hash.js';

/**
 * Recomputes the bundle ID from the manifest content (excluding the bundleId
 * field itself) and verifies it matches the declared bundleId.
 */
export function verifyBundleId(manifest: ProofManifest): CheckResult {
  const { bundleId, ...rest } = manifest;
  const expected = computeHash(canonicalize(rest));

  return {
    name: 'bundle-id',
    passed: expected === bundleId,
    details:
      expected === bundleId
        ? 'Bundle ID matches recomputed hash'
        : `Bundle ID mismatch: expected ${expected}, got ${bundleId}`,
  };
}
