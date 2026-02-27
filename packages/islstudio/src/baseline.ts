/**
 * ISL Studio - Baseline Support
 * 
 * Allows teams to adopt without fixing 200 legacy hits.
 * New violations are flagged, baseline violations are tracked but not blocking.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import type { GateResult } from './gate.js';

export interface BaselineEntry {
  ruleId: string;
  file: string;
  line?: number;
  fingerprint: string;
}

export interface Baseline {
  version: string;
  createdAt: string;
  entries: BaselineEntry[];
}

/**
 * Generate a fingerprint for a violation
 */
export function generateViolationFingerprint(
  ruleId: string,
  file: string,
  message: string
): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${ruleId}:${file}:${message}`);
  return hash.digest('hex').slice(0, 16);
}

/**
 * Load baseline from file
 */
export async function loadBaseline(baselinePath: string): Promise<Baseline | null> {
  try {
    const content = await fs.readFile(baselinePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save baseline to file
 */
export async function saveBaseline(
  baselinePath: string,
  violations: GateResult['violations']
): Promise<Baseline> {
  const baseline: Baseline = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    entries: violations.map(v => ({
      ruleId: v.ruleId,
      file: v.filePath || 'unknown',
      line: v.line,
      fingerprint: generateViolationFingerprint(v.ruleId, v.filePath || '', v.message),
    })),
  };

  await fs.mkdir(path.dirname(baselinePath), { recursive: true });
  await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2));
  
  return baseline;
}

/**
 * Check if a violation is in the baseline
 */
export function isInBaseline(
  ruleId: string,
  file: string,
  message: string,
  baseline: Baseline
): boolean {
  const fingerprint = generateViolationFingerprint(ruleId, file, message);
  return baseline.entries.some(e => e.fingerprint === fingerprint);
}

/**
 * Filter violations to only new ones (not in baseline)
 */
export function filterNewViolations(
  violations: GateResult['violations'],
  baseline: Baseline | null
): {
  newViolations: GateResult['violations'];
  baselineViolations: GateResult['violations'];
} {
  if (!baseline) {
    return { newViolations: violations, baselineViolations: [] };
  }

  const newViolations: GateResult['violations'] = [];
  const baselineViolations: GateResult['violations'] = [];

  for (const v of violations) {
    if (isInBaseline(v.ruleId, v.filePath || '', v.message, baseline)) {
      baselineViolations.push(v);
    } else {
      newViolations.push(v);
    }
  }

  return { newViolations, baselineViolations };
}
