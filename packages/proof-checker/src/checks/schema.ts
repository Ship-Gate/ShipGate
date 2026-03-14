import type { CheckResult, ProofManifest, Claim } from '../types.js';

const VALID_STATUSES = new Set(['proven', 'violated', 'unknown']);
const VALID_METHODS = new Set([
  'smt-proof',
  'pbt-exhaustive',
  'static-analysis',
  'runtime-trace',
  'heuristic',
]);

export function validateSchema(manifest: unknown): CheckResult {
  const errors: string[] = [];
  const m = manifest as Record<string, unknown>;

  if (!m || typeof m !== 'object') {
    return { name: 'schema', passed: false, details: 'Manifest is not an object' };
  }

  if (typeof m.schemaVersion !== 'string') errors.push('missing or invalid schemaVersion');
  if (typeof m.bundleId !== 'string') errors.push('missing or invalid bundleId');
  if (typeof m.verdict !== 'string') errors.push('missing or invalid verdict');
  if (typeof m.timestamp !== 'string') errors.push('missing or invalid timestamp');

  if (!m.spec || typeof m.spec !== 'object') {
    errors.push('missing or invalid spec');
  } else {
    const spec = m.spec as Record<string, unknown>;
    if (typeof spec.hash !== 'string') errors.push('missing or invalid spec.hash');
    if (typeof spec.domain !== 'string') errors.push('missing or invalid spec.domain');
  }

  if (!Array.isArray(m.claims)) {
    errors.push('missing or invalid claims array');
  } else {
    (m.claims as Claim[]).forEach((claim, i) => {
      if (typeof claim.id !== 'string') errors.push(`claims[${i}]: missing id`);
      if (typeof claim.property !== 'string') errors.push(`claims[${i}]: missing property`);
      if (!VALID_STATUSES.has(claim.status)) errors.push(`claims[${i}]: invalid status "${claim.status}"`);
      if (!VALID_METHODS.has(claim.method)) errors.push(`claims[${i}]: invalid method "${claim.method}"`);
    });
  }

  if (m.signature !== undefined && typeof m.signature !== 'string') {
    errors.push('signature must be a string if present');
  }

  return {
    name: 'schema',
    passed: errors.length === 0,
    details: errors.length === 0 ? 'Schema valid' : errors.join('; '),
  };
}
