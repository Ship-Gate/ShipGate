import type { CheckResult, ProofManifest, ProofMethod } from '../types.js';

const STRONG_METHODS: Set<ProofMethod> = new Set(['smt-proof', 'pbt-exhaustive']);

/**
 * For a PROVEN verdict, all claims must use strong proof methods
 * (smt-proof or pbt-exhaustive). Weaker methods like heuristic
 * or runtime-trace are insufficient for a PROVEN verdict.
 */
export function verifyMethodRequirements(manifest: ProofManifest): CheckResult {
  if (manifest.verdict.toUpperCase() !== 'PROVEN') {
    return {
      name: 'method-requirements',
      passed: true,
      details: `Method requirements only enforced for PROVEN verdict (current: ${manifest.verdict})`,
    };
  }

  const weak: string[] = [];
  for (const claim of manifest.claims) {
    if (!STRONG_METHODS.has(claim.method)) {
      weak.push(`${claim.id} uses ${claim.method}`);
    }
  }

  return {
    name: 'method-requirements',
    passed: weak.length === 0,
    details:
      weak.length === 0
        ? 'All claims use strong proof methods'
        : `PROVEN verdict requires smt-proof or pbt-exhaustive: ${weak.join('; ')}`,
  };
}
