/**
 * Baseline Management
 *
 * Persists known findings so subsequent scans only surface new issues.
 * Uses SHA-256 hashing for deterministic deduplication.
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export interface BaselineEntry {
  hash: string;
}

export interface Baseline {
  version: string;
  timestamp: string;
  findings: BaselineEntry[];
}

const BASELINE_VERSION = '1';

/**
 * Compute a stable SHA-256 hash for a finding.
 * Uses file + line + check + message as the fingerprint.
 */
export function computeFindingHash(
  finding: { file?: string; line?: number; check: string; message: string },
): string {
  const payload = [
    finding.file ?? '',
    String(finding.line ?? 0),
    finding.check,
    finding.message,
  ].join('\0');

  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Load a baseline from disk. Returns null if the file doesn't exist or is
 * malformed.
 */
export async function loadBaseline(baselinePath: string): Promise<Baseline | null> {
  try {
    const raw = await readFile(baselinePath, 'utf-8');
    const parsed = JSON.parse(raw) as Baseline;
    if (!parsed.version || !Array.isArray(parsed.findings)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save current findings as a new baseline snapshot.
 */
export async function saveBaseline(
  baselinePath: string,
  findings: Array<{ file?: string; line?: number; check: string; message: string }>,
): Promise<void> {
  const baseline: Baseline = {
    version: BASELINE_VERSION,
    timestamp: new Date().toISOString(),
    findings: findings.map((f) => ({ hash: computeFindingHash(f) })),
  };

  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, JSON.stringify(baseline, null, 2), 'utf-8');
}

/**
 * Filter findings to only those not present in the baseline.
 */
export function filterNewFindings<T>(
  findings: T[],
  baseline: Baseline,
  hashFn: (f: T) => string,
): { newFindings: T[]; suppressedCount: number } {
  const knownHashes = new Set(baseline.findings.map((e) => e.hash));
  const newFindings = findings.filter((f) => !knownHashes.has(hashFn(f)));
  return {
    newFindings,
    suppressedCount: findings.length - newFindings.length,
  };
}
