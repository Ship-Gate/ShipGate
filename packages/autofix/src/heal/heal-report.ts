/**
 * Heal Report Format
 *
 * Structured report: failures before heal, fixes per iteration,
 * failures after heal, tokens spent.
 */

import type { HealReport, HealIterationResult } from './types.js';

/** Format heal report as JSON */
export function formatHealReportJSON(report: HealReport): string {
  return JSON.stringify(report, null, 2);
}

/** Format heal report for console (human-readable) */
export function formatHealReportPretty(report: HealReport): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push(' Heal Report');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push(`Failures before heal: ${report.failuresBeforeHeal}`);
  lines.push(`Failures after heal:  ${report.failuresAfterHeal}`);
  lines.push(`Verdict:             ${report.verdict}`);
  if (report.tokensSpentTotal) {
    lines.push(
      `Tokens spent:        input=${report.tokensSpentTotal.input ?? 0}, output=${report.tokensSpentTotal.output ?? 0}`,
    );
  }
  lines.push('');

  if (report.iterations.length > 0) {
    lines.push('Iterations:');
    for (const iter of report.iterations) {
      lines.push(formatIteration(iter));
    }
  }

  return lines.join('\n');
}

function formatIteration(iter: HealIterationResult): string {
  const lines: string[] = [];
  lines.push(`  [${iter.iteration}] Phase: ${iter.phase}`);
  lines.push(`      Failures: ${iter.failuresBefore} → ${iter.failuresAfter}`);
  if (iter.fixesApplied.length > 0) {
    lines.push(`      Fixes applied: ${iter.fixesApplied.length}`);
    for (const f of iter.fixesApplied.slice(0, 5)) {
      lines.push(`        • ${f}`);
    }
    if (iter.fixesApplied.length > 5) {
      lines.push(`        ... and ${iter.fixesApplied.length - 5} more`);
    }
  }
  if (iter.tokensSpent) {
    lines.push(`      Tokens: in=${iter.tokensSpent.input ?? 0}, out=${iter.tokensSpent.output ?? 0}`);
  }
  return lines.join('\n');
}

/** Create an empty heal report (no healing attempted) */
export function createEmptyHealReport(failuresCount: number): HealReport {
  return {
    failuresBeforeHeal: failuresCount,
    failuresAfterHeal: failuresCount,
    iterations: [],
    verdict: 'NO_SHIP',
  };
}
