/**
 * Drift Report Formatter
 *
 * Produces human-readable CLI output for drift reports and scan summaries.
 * Follows the existing codebase convention of dedicated print/format functions.
 */

import { relative } from 'path';
import type { DriftReport, DriftScanSummary, DriftIndicator } from './driftTypes.js';

// ============================================================================
// FULL SCAN FORMATTING
// ============================================================================

/**
 * Format a complete drift scan summary for CLI output.
 *
 * @param summary - The scan summary to format
 * @param cwd     - Current working directory (for relative paths)
 * @returns Formatted string for terminal output
 */
export function formatDriftScanSummary(
  summary: DriftScanSummary,
  cwd?: string,
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('Drift Report');
  lines.push('\u2500'.repeat(50));

  if (summary.reports.length === 0) {
    lines.push('No spec \u2194 implementation pairs found.');
    lines.push('');
    return lines.join('\n');
  }

  // Sort by drift score descending (most drifted first)
  const sorted = [...summary.reports].sort((a, b) => b.driftScore - a.driftScore);

  for (const report of sorted) {
    lines.push('');
    lines.push(formatSingleReport(report, cwd));
  }

  // Summary footer
  lines.push('');
  lines.push('\u2500'.repeat(50));

  if (summary.drifted === 0) {
    lines.push(`All ${summary.totalSpecs} spec(s) are in sync.`);
  } else {
    lines.push(
      `${summary.drifted} of ${summary.totalSpecs} spec(s) may need updating.`,
    );
  }

  if (summary.highDrift > 0) {
    lines.push(
      `${summary.highDrift} spec(s) have high drift and should be reviewed.`,
    );
  }

  lines.push(`Average drift score: ${summary.averageScore}/100`);
  lines.push(`Scan completed in ${summary.durationMs}ms`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// SINGLE REPORT FORMATTING
// ============================================================================

/**
 * Format a single drift report for CLI output.
 *
 * @param report - The drift report to format
 * @param cwd    - Current working directory (for relative paths)
 * @returns Formatted string
 */
export function formatSingleReport(
  report: DriftReport,
  cwd?: string,
): string {
  const lines: string[] = [];

  const implPath = cwd ? relative(cwd, report.file) : report.file;
  const specPath = cwd ? relative(cwd, report.spec) : report.spec;

  // Header: file ↔ spec
  lines.push(`${implPath} \u2194 ${specPath}`);

  // Score line
  const scoreLabel = severityLabel(report.severity);
  lines.push(`  Drift: ${report.driftScore}/100 (${scoreLabel})`);

  // Indicators
  if (report.indicators.length === 0) {
    lines.push(`  \u2713 All behaviors match`);
  } else {
    for (const indicator of report.indicators) {
      lines.push(`  ${formatIndicator(indicator)}`);
    }
  }

  // Suggestion for high drift
  if (report.driftScore >= 50) {
    lines.push(`  \u2192 Update spec: shipgate drift --update ${implPath}`);
  }

  return lines.join('\n');
}

// ============================================================================
// INDICATOR FORMATTING
// ============================================================================

/**
 * Format a single drift indicator for CLI output.
 */
function formatIndicator(indicator: DriftIndicator): string {
  const icon = indicatorIcon(indicator.severity);
  return `${icon} ${indicator.description}`;
}

/**
 * Get the icon for an indicator based on severity.
 */
function indicatorIcon(severity: DriftIndicator['severity']): string {
  switch (severity) {
    case 'high':
      return '\u2717';   // ✗
    case 'medium':
      return '\u26A0';   // ⚠
    case 'low':
      return '\u2713';   // ✓
    default:
      return '\u2022';   // •
  }
}

/**
 * Get a human-readable label for a drift severity.
 */
function severityLabel(severity: DriftReport['severity']): string {
  switch (severity) {
    case 'in-sync':
      return 'in sync';
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    case 'critical':
      return 'critical';
    default:
      return 'unknown';
  }
}

// ============================================================================
// JSON OUTPUT
// ============================================================================

/**
 * Format a drift scan summary as JSON for machine consumption.
 *
 * @param summary - The scan summary to format
 * @returns JSON string
 */
export function formatDriftScanJSON(summary: DriftScanSummary): string {
  return JSON.stringify(
    {
      totalSpecs: summary.totalSpecs,
      inSync: summary.inSync,
      drifted: summary.drifted,
      highDrift: summary.highDrift,
      averageScore: summary.averageScore,
      durationMs: summary.durationMs,
      timestamp: summary.timestamp.toISOString(),
      reports: summary.reports.map((r) => ({
        file: r.file,
        spec: r.spec,
        driftScore: r.driftScore,
        severity: r.severity,
        lastCodeChange: r.lastCodeChange.toISOString(),
        lastSpecChange: r.lastSpecChange.toISOString(),
        indicators: r.indicators,
      })),
    },
    null,
    2,
  );
}
