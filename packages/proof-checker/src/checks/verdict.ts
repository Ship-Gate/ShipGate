import type { CheckResult, ProofManifest } from '../types.js';

/**
 * Verifies that the declared verdict is consistent with claim statuses:
 * - All claims proven → verdict must be PROVEN
 * - Any claim violated → verdict must be VIOLATED
 * - Otherwise → verdict must be PARTIAL or UNKNOWN
 */
export function verifyVerdictConsistency(manifest: ProofManifest): CheckResult {
  const statuses = manifest.claims.map((c) => c.status);
  const allProven = statuses.length > 0 && statuses.every((s) => s === 'proven');
  const anyViolated = statuses.some((s) => s === 'violated');

  let expected: string;
  if (anyViolated) {
    expected = 'VIOLATED';
  } else if (allProven) {
    expected = 'PROVEN';
  } else {
    expected = 'PARTIAL';
  }

  const verdict = manifest.verdict.toUpperCase();
  const passed = verdict === expected;

  return {
    name: 'verdict-consistency',
    passed,
    details: passed
      ? `Verdict ${verdict} is consistent with claim statuses`
      : `Verdict mismatch: claims imply ${expected} but manifest declares ${verdict}`,
  };
}
