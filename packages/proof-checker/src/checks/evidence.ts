import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CheckResult, ProofManifest } from '../types.js';
import { computeHash } from '../hash.js';

export function verifyEvidenceCompleteness(manifest: ProofManifest): CheckResult {
  const missing: string[] = [];

  for (const claim of manifest.claims) {
    if (!claim.evidence || claim.evidence.length === 0) {
      missing.push(claim.id);
    }
  }

  return {
    name: 'evidence-completeness',
    passed: missing.length === 0,
    details:
      missing.length === 0
        ? 'All claims have evidence references'
        : `Claims missing evidence: ${missing.join(', ')}`,
  };
}

export async function verifyEvidenceIntegrity(
  manifest: ProofManifest,
  bundlePath: string,
): Promise<CheckResult> {
  const failures: string[] = [];

  for (const claim of manifest.claims) {
    if (!claim.evidence) continue;

    for (const ref of claim.evidence) {
      try {
        const content = await readFile(join(bundlePath, ref.path));
        const actual = computeHash(content);
        if (actual !== ref.hash) {
          failures.push(`${ref.path}: expected ${ref.hash}, got ${actual}`);
        }
      } catch {
        failures.push(`${ref.path}: file not found or unreadable`);
      }
    }
  }

  return {
    name: 'evidence-integrity',
    passed: failures.length === 0,
    details:
      failures.length === 0
        ? 'All evidence file hashes match'
        : `Evidence integrity failures: ${failures.join('; ')}`,
  };
}
