/**
 * Trust Score Report Generator
 *
 * Produces human-readable text reports and JSON-serializable reports
 * from trust score results.
 *
 * @module @isl-lang/gate/trust-score/report
 */

import type {
  TrustCategory,
  TrustScoreResult,
  TrustDelta,
  TrustReport,
  TrustReportJSON,
  CategoryScore,
  TrustVerdict,
} from './types.js';

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a full trust report (text + JSON).
 */
export function generateReport(
  result: TrustScoreResult,
  delta?: TrustDelta,
): TrustReport {
  return {
    result,
    delta,
    text: formatTextReport(result, delta),
    json: formatJSONReport(result, delta),
  };
}

// ============================================================================
// Text Report
// ============================================================================

/**
 * Format a human-readable text report.
 */
export function formatTextReport(
  result: TrustScoreResult,
  delta?: TrustDelta,
): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(verdictBanner(result.verdict, result.score));
  lines.push('');

  // Overall score
  const deltaStr = delta ? formatDeltaInline(delta.scoreDelta) : '';
  lines.push(`  Trust Score: ${result.score}/100 ${deltaStr}`);
  lines.push(`  Verdict:     ${result.verdict}`);
  lines.push(`  Threshold:   ${result.config.shipThreshold} (SHIP) / ${result.config.warnThreshold} (WARN)`);
  lines.push('');

  // Category breakdown table
  lines.push('  Category Breakdown:');
  lines.push('  ' + '-'.repeat(68));
  lines.push(
    '  ' +
    padRight('Category', 16) +
    padRight('Score', 8) +
    padRight('Weight', 8) +
    padRight('Pass', 6) +
    padRight('Fail', 6) +
    padRight('Part', 6) +
    padRight('Unk', 6) +
    'Delta',
  );
  lines.push('  ' + '-'.repeat(68));

  for (const cs of result.categories) {
    const catDelta = delta?.categoryDeltas[cs.category];
    const catDeltaStr = catDelta !== undefined ? formatDeltaInline(catDelta) : '';

    lines.push(
      '  ' +
      padRight(cs.category, 16) +
      padRight(`${cs.score}`, 8) +
      padRight(`${Math.round(cs.weight * 100)}%`, 8) +
      padRight(`${cs.counts.pass}`, 6) +
      padRight(`${cs.counts.fail}`, 6) +
      padRight(`${cs.counts.partial}`, 6) +
      padRight(`${cs.counts.unknown}`, 6) +
      catDeltaStr,
    );
  }

  lines.push('  ' + '-'.repeat(68));
  lines.push(
    '  ' +
    padRight('TOTAL', 16) +
    padRight(`${result.score}`, 8) +
    padRight('100%', 8) +
    padRight(`${result.counts.pass}`, 6) +
    padRight(`${result.counts.fail}`, 6) +
    padRight(`${result.counts.partial}`, 6) +
    padRight(`${result.counts.unknown}`, 6) +
    deltaStr,
  );
  lines.push('');

  // Visual score bar
  lines.push('  ' + renderScoreBar(result.score, 40));
  lines.push('');

  // Critical block warning
  if (result.criticalBlock) {
    lines.push('  !! CRITICAL: A critical clause failure forced the score to 0');
    lines.push('');
  }

  // Reasons
  if (result.reasons.length > 0) {
    lines.push('  Reasons:');
    for (const reason of result.reasons) {
      lines.push(`    - ${reason}`);
    }
    lines.push('');
  }

  // Delta summary
  if (delta) {
    lines.push('  Delta from previous run:');
    lines.push(`    ${delta.summary}`);
    if (delta.improved.length > 0) {
      lines.push(`    Improved: ${delta.improved.join(', ')}`);
    }
    if (delta.regressed.length > 0) {
      lines.push(`    Regressed: ${delta.regressed.join(', ')}`);
    }
    lines.push('');
  }

  // Footer
  lines.push(`  Evaluated ${result.totalClauses} clauses at ${result.timestamp}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// JSON Report
// ============================================================================

/**
 * Format a JSON-serializable report.
 */
export function formatJSONReport(
  result: TrustScoreResult,
  delta?: TrustDelta,
): TrustReportJSON {
  return {
    score: result.score,
    verdict: result.verdict,
    threshold: result.config.shipThreshold,
    categories: result.categories.map(cs => ({
      name: cs.category,
      score: cs.score,
      weight: Math.round(cs.weight * 100),
      pass: cs.counts.pass,
      fail: cs.counts.fail,
      partial: cs.counts.partial,
      unknown: cs.counts.unknown,
    })),
    counts: {
      pass: result.counts.pass,
      fail: result.counts.fail,
      partial: result.counts.partial,
      unknown: result.counts.unknown,
      total: result.totalClauses,
    },
    delta: delta
      ? {
          scoreDelta: delta.scoreDelta,
          verdictChanged: delta.verdictChanged,
          improved: delta.improved,
          regressed: delta.regressed,
        }
      : undefined,
    timestamp: result.timestamp,
    reasons: result.reasons,
  };
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Render an ASCII verdict banner.
 */
function verdictBanner(verdict: TrustVerdict, score: number): string {
  const width = 42;
  const border = verdict === 'SHIP' ? '=' : verdict === 'WARN' ? '~' : '!';
  const bar = border.repeat(width);
  const icon = verdict === 'SHIP' ? 'SHIP' : verdict === 'WARN' ? 'WARN' : 'BLOCK';
  const label = `${icon}  (${score}/100)`;
  const padding = Math.max(0, Math.floor((width - label.length) / 2));

  return [
    `  ${bar}`,
    `  ${' '.repeat(padding)}${label}`,
    `  ${bar}`,
  ].join('\n');
}

/**
 * Render an ASCII score bar.
 *
 *   [████████████████████░░░░░░░░░░] 67/100
 */
function renderScoreBar(score: number, width: number): string {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const filledChar = '#';
  const emptyChar = '.';

  return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}] ${score}/100`;
}

/**
 * Format a delta value inline.
 */
function formatDeltaInline(delta: number): string {
  if (delta === 0) return '(=)';
  if (delta > 0) return `(+${delta})`;
  return `(${delta})`;
}

/**
 * Right-pad a string to a given length.
 */
function padRight(str: string, len: number): string {
  return str.padEnd(len);
}
