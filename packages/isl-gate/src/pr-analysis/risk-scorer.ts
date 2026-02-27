/**
 * PR Analysis - Risk Scorer
 *
 * Calculates a 0–100 risk score for a PR based on the nature, volume,
 * and location of changes. Higher scores indicate PRs that need closer
 * scrutiny.
 *
 * @module @isl-lang/gate/pr-analysis
 */

import type { PRAnalysis, RiskLabel, FileChange } from './types.js';
import { isCriticalPath } from './file-classifier.js';

// ============================================================================
// Risk Weights
// ============================================================================

/** Max contribution from file count alone */
const MAX_FILE_COUNT_RISK = 30;
/** Points per changed file (capped at MAX_FILE_COUNT_RISK) */
const PER_FILE_RISK = 5;

/** Points per critical-path file changed */
const CRITICAL_PATH_RISK = 15;

/** Points per new file without an ISL spec */
const UNSPECCED_NEW_FILE_RISK = 10;

/** Points per ISL spec change (could relax security constraints) */
const SPEC_CHANGE_RISK = 10;

/** Points per critical-path file with a large diff (>100 lines added) */
const LARGE_CRITICAL_DIFF_RISK = 20;

/** Lines-added threshold for "large diff" */
const LARGE_DIFF_THRESHOLD = 100;

// ============================================================================
// Risk Calculation
// ============================================================================

/**
 * Calculate the overall risk score (0–100) for a PR analysis.
 */
export function calculatePRRisk(analysis: PRAnalysis): number {
  let risk = 0;

  // ── File count risk ─────────────────────────────────────────────────
  risk += Math.min(analysis.changedFiles.length * PER_FILE_RISK, MAX_FILE_COUNT_RISK);

  // ── Critical-path changes ───────────────────────────────────────────
  const criticalFiles = analysis.changedFiles.filter((f) =>
    isCriticalPath(f.path),
  );
  risk += criticalFiles.length * CRITICAL_PATH_RISK;

  // ── New files without specs ─────────────────────────────────────────
  const unspeccedNew = analysis.newFiles.filter(
    (f) => !analysis.affectedSpecs.some((spec) => specCoversFile(spec, f)),
  );
  risk += unspeccedNew.length * UNSPECCED_NEW_FILE_RISK;

  // ── ISL spec changes ───────────────────────────────────────────────
  risk += analysis.specChanges.length * SPEC_CHANGE_RISK;

  // ── Large diffs in critical files ──────────────────────────────────
  const largeCritical = analysis.changedFiles.filter(
    (f) => f.linesAdded > LARGE_DIFF_THRESHOLD && isCriticalPath(f.path),
  );
  risk += largeCritical.length * LARGE_CRITICAL_DIFF_RISK;

  return Math.min(100, risk);
}

/**
 * Convert a numeric risk score to a human-readable label.
 */
export function riskLabel(score: number): RiskLabel {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'elevated';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'low';
  return 'low';
}

/**
 * Build a human-readable risk summary line.
 */
export function riskSummary(analysis: PRAnalysis): string {
  const { riskScore, riskLabel: label, changedFiles } = analysis;
  const criticalFiles = changedFiles.filter((f) => isCriticalPath(f.path));

  let summary = `Risk Score: ${riskScore}/100 (${label}`;

  if (criticalFiles.length > 0) {
    const kinds = describeCriticalKinds(criticalFiles);
    summary += ` — ${kinds} changes detected`;
  }

  summary += ')';
  return summary;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Rough check: does a spec path plausibly cover a file path?
 * Uses basename matching without extension.
 */
function specCoversFile(specPath: string, filePath: string): boolean {
  const specBase = specPath.replace(/.*\//, '').replace(/\.[^.]+$/, '');
  const fileBase = filePath.replace(/.*\//, '').replace(/\.[^.]+$/, '');
  const fileDir = filePath.replace(/\/[^/]+$/, '');

  return specBase === fileBase || fileDir.includes(specBase);
}

/**
 * Describe what critical categories are touched (for the summary line).
 */
function describeCriticalKinds(files: FileChange[]): string {
  const kinds = new Set<string>();

  for (const f of files) {
    if (/auth/i.test(f.path)) kinds.add('auth');
    if (/payment|billing/i.test(f.path)) kinds.add('payment');
    if (/security|crypto/i.test(f.path)) kinds.add('security');
    if (/webhook/i.test(f.path)) kinds.add('webhook');
    if (/api\//i.test(f.path)) kinds.add('API');
  }

  return kinds.size > 0 ? [...kinds].join(', ') : 'critical path';
}
