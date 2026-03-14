import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CheckResult, ProofManifest } from '../types.js';
import { computeHash } from '../hash.js';

/**
 * Verify the proof chain entry in a manifest.
 *
 * When the manifest contains a `chain` field with a `previousBundleId`, this
 * check validates:
 *   1. The previous bundle exists at the expected location
 *   2. The recorded hash matches the actual hash of the previous manifest
 *   3. The sequence number is exactly previous + 1
 *   4. Any regressions are reported (non-blocking, informational)
 *
 * If the manifest has no chain data, the check passes (chain is optional).
 */
export async function verifyChain(
  manifest: ProofManifest,
  bundlePath: string,
): Promise<CheckResult> {
  const chain = (manifest as ProofManifest & { chain?: ChainData }).chain;

  if (!chain) {
    return {
      name: 'chain',
      passed: true,
      details: 'No chain data present (standalone bundle)',
    };
  }

  if (!chain.previousBundleId) {
    if (chain.sequenceNumber !== 1) {
      return {
        name: 'chain',
        passed: false,
        details: `First bundle in chain must have sequenceNumber 1, got ${chain.sequenceNumber}`,
      };
    }
    return {
      name: 'chain',
      passed: true,
      details: 'First bundle in chain (no predecessor)',
    };
  }

  // Try to locate the previous bundle.
  // Convention: sibling directory named by bundleId, or a chain-index pointer.
  const parentDir = join(bundlePath, '..');
  const previousBundlePath = join(parentDir, chain.previousBundleId);

  let previousManifestRaw: string;
  try {
    previousManifestRaw = await readFile(join(previousBundlePath, 'manifest.json'), 'utf-8');
  } catch {
    return {
      name: 'chain',
      passed: false,
      details: `Previous bundle not found at ${previousBundlePath}`,
    };
  }

  if (chain.previousBundleHash) {
    const actualHash = computeHash(previousManifestRaw);
    if (actualHash !== chain.previousBundleHash) {
      return {
        name: 'chain',
        passed: false,
        details: `Previous bundle hash mismatch: expected ${chain.previousBundleHash}, got ${actualHash}`,
      };
    }
  }

  let previousManifest: ProofManifest & { chain?: ChainData };
  try {
    previousManifest = JSON.parse(previousManifestRaw);
  } catch {
    return {
      name: 'chain',
      passed: false,
      details: 'Previous bundle manifest is not valid JSON',
    };
  }

  const previousSeq = previousManifest.chain?.sequenceNumber ?? 0;
  if (chain.sequenceNumber !== previousSeq + 1) {
    return {
      name: 'chain',
      passed: false,
      details: `Sequence number gap: expected ${previousSeq + 1}, got ${chain.sequenceNumber}`,
    };
  }

  const regressionCount = chain.regressions?.length ?? 0;
  const regressionNote = regressionCount > 0
    ? ` (${regressionCount} regression${regressionCount > 1 ? 's' : ''} detected)`
    : '';

  return {
    name: 'chain',
    passed: true,
    details: `Chain valid: seq ${chain.sequenceNumber}, predecessor ${chain.previousBundleId}${regressionNote}`,
  };
}

interface ChainData {
  previousBundleId: string | null;
  previousBundleHash: string | null;
  sequenceNumber: number;
  chainId: string;
  regressions?: Array<{
    claimId: string;
    property: string;
    previousStatus: string;
    currentStatus: string;
    previousMethod: string;
    currentMethod: string;
  }>;
}
