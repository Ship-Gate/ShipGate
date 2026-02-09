/**
 * Trust Score Formatters
 *
 * Human-readable and machine-readable output formatters for trust scores.
 *
 * @module @isl-lang/trust-score
 */

import type {
  TrustScore,
  SignalScore,
  TrustReducer,
  Recommendation,
  ShipDecision,
} from './types.js';

// ============================================================================
// JSON FORMATTING
// ============================================================================

/**
 * Format trust score as JSON for CI/machine consumption
 */
export function formatAsJSON(score: TrustScore, pretty = true): string {
  const data = {
    trust_score: round(score.score, 4),
    confidence: round(score.confidence, 4),
    decision: score.decision,
    algorithm_version: score.algorithmVersion,
    computed_at: score.computedAt,
    signals: score.signals.map(s => ({
      category: s.category,
      score: round(s.rawScore, 4),
      weight: round(s.weight, 4),
      weighted_score: round(s.weightedScore, 4),
      passed: s.passed,
      failed: s.failed,
      unknown: s.unknown,
      total: s.total,
      available: s.available,
    })),
    reducers: score.trustReducers.map(r => ({
      id: r.id,
      description: r.description,
      impact: round(r.impact, 4),
      severity: r.severity,
      category: r.category,
    })),
    recommendations: score.recommendations.map(r => ({
      id: r.id,
      description: r.description,
      expected_impact: round(r.expectedImpact, 4),
      priority: r.priority,
    })),
    summary: {
      headline: score.summary.headline,
      strengths: score.summary.strengths,
      concerns: score.summary.concerns,
    },
  };

  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

// ============================================================================
// TERMINAL/CLI FORMATTING
// ============================================================================

/**
 * Format trust score for terminal output with ANSI colors
 */
export function formatForTerminal(score: TrustScore, useColor = true): string {
  const c = useColor ? colors : noColors;
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(c.bold('═══════════════════════════════════════════════════════════════'));
  lines.push(c.bold('                        TRUST SCORE REPORT                       '));
  lines.push(c.bold('═══════════════════════════════════════════════════════════════'));
  lines.push('');

  // Main score
  const scorePercent = Math.round(score.score * 100);
  const confPercent = Math.round(score.confidence * 100);
  const scoreColor = scorePercent >= 90 ? c.green : scorePercent >= 70 ? c.yellow : c.red;
  const decisionColor = decisionColors(score.decision, c);

  lines.push(`  ${c.bold('Trust Score:')}     ${scoreColor(formatBar(score.score, 20))} ${scoreColor(`${scorePercent}%`)}`);
  lines.push(`  ${c.bold('Confidence:')}      ${c.dim(formatBar(score.confidence, 20))} ${c.dim(`${confPercent}%`)}`);
  lines.push(`  ${c.bold('Decision:')}        ${decisionColor(score.decision)}`);
  lines.push('');

  // Signal breakdown
  lines.push(c.bold('  ─── Signal Breakdown ───────────────────────────────────────'));
  lines.push('');

  for (const signal of score.signals) {
    const status = signal.available ? formatSignalStatus(signal, c) : c.dim('not available');
    const bar = signal.available ? formatBar(signal.rawScore, 15) : '░'.repeat(15);
    const percent = signal.available ? `${Math.round(signal.rawScore * 100)}%` : 'N/A';
    const weight = `(w=${Math.round(signal.weight * 100)}%)`;

    lines.push(`  ${padRight(formatCategory(signal.category), 22)} ${bar} ${padLeft(percent, 4)} ${c.dim(weight)}`);
    if (signal.available) {
      lines.push(`    ${c.dim(status)}`);
    }
  }
  lines.push('');

  // Trust reducers (if any)
  if (score.trustReducers.length > 0) {
    lines.push(c.bold('  ─── Trust Reducers ─────────────────────────────────────────'));
    lines.push('');

    for (const reducer of score.trustReducers.slice(0, 5)) {
      const icon = reducer.severity === 'critical' ? c.red('✗') : 
                   reducer.severity === 'major' ? c.yellow('⚠') : c.dim('○');
      const impactStr = c.dim(`(-${Math.round(reducer.impact * 100)}%)`);
      lines.push(`  ${icon} ${reducer.description} ${impactStr}`);
    }

    if (score.trustReducers.length > 5) {
      lines.push(c.dim(`  ... and ${score.trustReducers.length - 5} more`));
    }
    lines.push('');
  }

  // Recommendations (if any)
  if (score.recommendations.length > 0) {
    lines.push(c.bold('  ─── Recommendations ────────────────────────────────────────'));
    lines.push('');

    for (const rec of score.recommendations.slice(0, 3)) {
      const icon = rec.priority === 'high' ? c.red('→') : 
                   rec.priority === 'medium' ? c.yellow('→') : c.dim('→');
      const impactStr = c.green(`(+${Math.round(rec.expectedImpact * 100)}%)`);
      lines.push(`  ${icon} ${rec.description} ${impactStr}`);
    }
    lines.push('');
  }

  // Summary
  lines.push(c.bold('  ─── Summary ────────────────────────────────────────────────'));
  lines.push('');
  lines.push(`  ${score.summary.headline}`);
  lines.push('');

  if (score.summary.strengths.length > 0) {
    for (const strength of score.summary.strengths.slice(0, 3)) {
      lines.push(`  ${c.green('✓')} ${strength}`);
    }
  }

  if (score.summary.concerns.length > 0) {
    for (const concern of score.summary.concerns.slice(0, 3)) {
      lines.push(`  ${c.red('✗')} ${concern}`);
    }
  }

  lines.push('');
  lines.push(c.dim(`  Computed at: ${score.computedAt}`));
  lines.push(c.dim(`  Algorithm: v${score.algorithmVersion}`));
  lines.push('');
  lines.push(c.bold('═══════════════════════════════════════════════════════════════'));
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// MARKDOWN FORMATTING
// ============================================================================

/**
 * Format trust score as Markdown for reports/PRs
 */
export function formatAsMarkdown(score: TrustScore): string {
  const lines: string[] = [];

  // Header
  lines.push('# Trust Score Report');
  lines.push('');

  // Badge-style summary
  const scorePercent = Math.round(score.score * 100);
  const badge = score.decision === 'SHIP' ? '🟢' : score.decision === 'REVIEW_REQUIRED' ? '🟡' : '🔴';
  lines.push(`${badge} **${score.decision}** — Trust Score: **${scorePercent}%**`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(score.summary.headline);
  lines.push('');
  lines.push(`> ${score.summary.explanation}`);
  lines.push('');

  // Signal breakdown table
  lines.push('## Signal Breakdown');
  lines.push('');
  lines.push('| Signal | Score | Weight | Passed | Failed | Unknown |');
  lines.push('|--------|-------|--------|--------|--------|---------|');

  for (const signal of score.signals) {
    if (signal.available) {
      lines.push(
        `| ${formatCategory(signal.category)} | ${Math.round(signal.rawScore * 100)}% | ${Math.round(signal.weight * 100)}% | ${signal.passed} | ${signal.failed} | ${signal.unknown} |`
      );
    } else {
      lines.push(
        `| ${formatCategory(signal.category)} | N/A | ${Math.round(signal.weight * 100)}% | - | - | - |`
      );
    }
  }
  lines.push('');

  // Trust reducers
  if (score.trustReducers.length > 0) {
    lines.push('## Trust Reducers');
    lines.push('');

    for (const reducer of score.trustReducers) {
      const icon = reducer.severity === 'critical' ? '🔴' : reducer.severity === 'major' ? '🟡' : '⚪';
      lines.push(`- ${icon} **${reducer.severity}**: ${reducer.description} (-${Math.round(reducer.impact * 100)}%)`);
    }
    lines.push('');
  }

  // Recommendations
  if (score.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');

    for (const rec of score.recommendations) {
      const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '⚪';
      lines.push(`- ${priority} ${rec.description} (+${Math.round(rec.expectedImpact * 100)}% expected)`);
    }
    lines.push('');
  }

  // Strengths and concerns
  if (score.summary.strengths.length > 0 || score.summary.concerns.length > 0) {
    lines.push('## Key Findings');
    lines.push('');

    if (score.summary.strengths.length > 0) {
      lines.push('### Strengths');
      for (const s of score.summary.strengths) {
        lines.push(`- ✅ ${s}`);
      }
      lines.push('');
    }

    if (score.summary.concerns.length > 0) {
      lines.push('### Concerns');
      for (const c of score.summary.concerns) {
        lines.push(`- ⚠️ ${c}`);
      }
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push(`*Computed at ${score.computedAt} using algorithm v${score.algorithmVersion}*`);

  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function formatBar(value: number, width: number): string {
  const filled = Math.round(value * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function formatCategory(category: string): string {
  return category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatSignalStatus(signal: SignalScore, c: typeof colors): string {
  const parts: string[] = [];
  if (signal.passed > 0) parts.push(c.green(`${signal.passed} passed`));
  if (signal.failed > 0) parts.push(c.red(`${signal.failed} failed`));
  if (signal.unknown > 0) parts.push(c.yellow(`${signal.unknown} unknown`));
  if (signal.skipped > 0) parts.push(c.dim(`${signal.skipped} skipped`));
  return parts.join(', ');
}

function padRight(s: string, len: number): string {
  return s + ' '.repeat(Math.max(0, len - s.length));
}

function padLeft(s: string, len: number): string {
  return ' '.repeat(Math.max(0, len - s.length)) + s;
}

function decisionColors(decision: ShipDecision, c: typeof colors): (s: string) => string {
  switch (decision) {
    case 'SHIP': return c.green;
    case 'REVIEW_REQUIRED': return c.yellow;
    case 'NO_SHIP': return c.red;
  }
}

// ANSI color helpers
const colors = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

const noColors = {
  bold: (s: string) => s,
  dim: (s: string) => s,
  red: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
};
