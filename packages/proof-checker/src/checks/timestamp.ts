import type { CheckResult, ProofManifest } from '../types.js';

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function verifyTimestamp(manifest: ProofManifest): CheckResult {
  const ts = Date.parse(manifest.timestamp);

  if (isNaN(ts)) {
    return { name: 'timestamp', passed: false, details: `Invalid timestamp: "${manifest.timestamp}"` };
  }

  const now = Date.now();

  if (ts > now + 60_000) {
    return { name: 'timestamp', passed: false, details: 'Timestamp is in the future' };
  }

  if (now - ts > MAX_AGE_MS) {
    const daysOld = Math.floor((now - ts) / (24 * 60 * 60 * 1000));
    return { name: 'timestamp', passed: false, details: `Timestamp is ${daysOld} days old (max 30)` };
  }

  return { name: 'timestamp', passed: true, details: 'Timestamp within valid range' };
}
