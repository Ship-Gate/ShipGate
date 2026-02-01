/**
 * Mutation Testing Reporter
 * 
 * Generates reports showing mutation testing results.
 */

import {
  Mutant,
  MutantStatus,
  MutationType,
  MutationResult,
  MutationReport,
  TypeBreakdown,
  FileBreakdown,
} from './types';

/**
 * Generate a mutation testing report
 */
export class MutationReporter {
  /**
   * Generate a complete report from results
   */
  generateReport(
    results: MutationResult[],
    startTime: Date = new Date()
  ): MutationReport {
    const mutants = results.map((r) => r.mutant);
    const duration = Date.now() - startTime.getTime();

    // Count by status
    const counts = this.countByStatus(mutants);
    
    // Calculate score
    const score = this.calculateScore(counts);
    
    // Breakdown by type
    const byType = this.breakdownByType(mutants);
    
    // Breakdown by file
    const byFile = this.breakdownByFile(mutants);
    
    // Get survivors
    const survivors = mutants.filter((m) => m.status === 'survived');

    return {
      score,
      totalMutants: mutants.length,
      killed: counts.killed,
      survived: counts.survived,
      timeout: counts.timeout,
      errors: counts.error,
      equivalent: counts.equivalent,
      byType,
      byFile,
      mutants,
      survivors,
      duration,
      timestamp: new Date(),
    };
  }

  /**
   * Count mutants by status
   */
  private countByStatus(mutants: Mutant[]): Record<MutantStatus, number> {
    const counts: Record<MutantStatus, number> = {
      pending: 0,
      killed: 0,
      survived: 0,
      timeout: 0,
      error: 0,
      equivalent: 0,
    };

    for (const mutant of mutants) {
      counts[mutant.status]++;
    }

    return counts;
  }

  /**
   * Calculate mutation score
   * Score = (killed / (total - equivalent)) * 100
   */
  private calculateScore(counts: Record<MutantStatus, number>): number {
    const relevant = counts.killed + counts.survived + counts.timeout;
    
    if (relevant === 0) {
      return 100; // No testable mutants
    }
    
    return Math.round((counts.killed / relevant) * 10000) / 100;
  }

  /**
   * Breakdown by mutation type
   */
  private breakdownByType(
    mutants: Mutant[]
  ): Record<MutationType, TypeBreakdown> {
    const breakdown: Record<MutationType, TypeBreakdown> = {} as Record<
      MutationType,
      TypeBreakdown
    >;

    // Group by type
    const byType = new Map<MutationType, Mutant[]>();
    for (const mutant of mutants) {
      const list = byType.get(mutant.type) || [];
      list.push(mutant);
      byType.set(mutant.type, list);
    }

    // Calculate stats for each type
    for (const [type, typeMutants] of byType) {
      const killed = typeMutants.filter((m) => m.status === 'killed').length;
      const survived = typeMutants.filter((m) => m.status === 'survived').length;
      const total = typeMutants.length;
      
      breakdown[type] = {
        total,
        killed,
        survived,
        score: total > 0 ? Math.round((killed / total) * 10000) / 100 : 100,
      };
    }

    return breakdown;
  }

  /**
   * Breakdown by file
   */
  private breakdownByFile(mutants: Mutant[]): Record<string, FileBreakdown> {
    const breakdown: Record<string, FileBreakdown> = {};

    // Group by file
    const byFile = new Map<string, Mutant[]>();
    for (const mutant of mutants) {
      const file = mutant.location.file;
      const list = byFile.get(file) || [];
      list.push(mutant);
      byFile.set(file, list);
    }

    // Calculate stats for each file
    for (const [file, fileMutants] of byFile) {
      const killed = fileMutants.filter((m) => m.status === 'killed').length;
      const survived = fileMutants.filter((m) => m.status === 'survived').length;
      const total = fileMutants.length;
      
      breakdown[file] = {
        file,
        total,
        killed,
        survived,
        score: total > 0 ? Math.round((killed / total) * 10000) / 100 : 100,
        mutants: fileMutants,
      };
    }

    return breakdown;
  }
}

/**
 * Generate report (convenience function)
 */
export function generateReport(results: MutationResult[]): MutationReport {
  const reporter = new MutationReporter();
  return reporter.generateReport(results);
}

/**
 * Format report as text
 */
export function formatReportText(report: MutationReport): string {
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('               MUTATION TESTING REPORT                      ');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(`  Mutation Score:  ${report.score}%`);
  lines.push(`  Total Mutants:   ${report.totalMutants}`);
  lines.push(`  Killed:          ${report.killed} (tests caught the mutation)`);
  lines.push(`  Survived:        ${report.survived} (tests missed the mutation)`);
  if (report.timeout > 0) {
    lines.push(`  Timeout:         ${report.timeout}`);
  }
  if (report.errors > 0) {
    lines.push(`  Errors:          ${report.errors}`);
  }
  lines.push(`  Duration:        ${(report.duration / 1000).toFixed(2)}s`);
  lines.push('');

  // By Type
  lines.push('BY MUTATION TYPE');
  lines.push('───────────────────────────────────────────────────────────');
  for (const [type, stats] of Object.entries(report.byType)) {
    const bar = createProgressBar(stats.score);
    lines.push(
      `  ${type.padEnd(15)} ${bar} ${stats.score.toFixed(1)}% ` +
      `(${stats.killed}/${stats.total})`
    );
  }
  lines.push('');

  // By File
  lines.push('BY FILE');
  lines.push('───────────────────────────────────────────────────────────');
  for (const [file, stats] of Object.entries(report.byFile)) {
    const shortFile = file.split('/').pop() || file;
    const bar = createProgressBar(stats.score);
    lines.push(
      `  ${shortFile.padEnd(25)} ${bar} ${stats.score.toFixed(1)}% ` +
      `(${stats.killed}/${stats.total})`
    );
  }
  lines.push('');

  // Survivors (need attention)
  if (report.survivors.length > 0) {
    lines.push('SURVIVING MUTANTS (Need Better Tests)');
    lines.push('───────────────────────────────────────────────────────────');
    
    const displayCount = Math.min(report.survivors.length, 10);
    for (let i = 0; i < displayCount; i++) {
      const survivor = report.survivors[i];
      lines.push(`  ${i + 1}. ${survivor.description}`);
      lines.push(`     File: ${survivor.location.file}:${survivor.location.startLine}`);
      lines.push(`     Original: ${survivor.original}`);
      lines.push(`     Mutated:  ${survivor.mutated}`);
      lines.push('');
    }
    
    if (report.survivors.length > displayCount) {
      lines.push(`  ... and ${report.survivors.length - displayCount} more`);
    }
  }

  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Create ASCII progress bar
 */
function createProgressBar(percentage: number, width = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  const filledChar = percentage >= 80 ? '█' : percentage >= 60 ? '▓' : '░';
  
  return `[${filledChar.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Format report as JSON
 */
export function formatReportJson(report: MutationReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format report as HTML
 */
export function formatReportHtml(report: MutationReport): string {
  const scoreColor = report.score >= 80 ? '#22c55e' : report.score >= 60 ? '#eab308' : '#ef4444';
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Mutation Testing Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #fafafa; }
    h1 { color: #a78bfa; }
    h2 { color: #94a3b8; border-bottom: 1px solid #27272a; padding-bottom: 8px; }
    .score { font-size: 64px; font-weight: bold; color: ${scoreColor}; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
    .stat { background: #18181b; padding: 16px; border-radius: 8px; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { color: #71717a; }
    .killed { color: #22c55e; }
    .survived { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #27272a; }
    th { background: #18181b; }
    .bar { height: 8px; background: #27272a; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #a78bfa); }
    .mutant { background: #18181b; padding: 16px; border-radius: 8px; margin: 8px 0; }
    .mutant-desc { font-weight: 500; }
    .mutant-loc { color: #71717a; font-size: 14px; }
    code { background: #27272a; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Mutation Testing Report</h1>
  
  <div class="score">${report.score}%</div>
  <p>Mutation Score</p>
  
  <div class="summary">
    <div class="stat">
      <div class="stat-value">${report.totalMutants}</div>
      <div class="stat-label">Total Mutants</div>
    </div>
    <div class="stat">
      <div class="stat-value killed">${report.killed}</div>
      <div class="stat-label">Killed</div>
    </div>
    <div class="stat">
      <div class="stat-value survived">${report.survived}</div>
      <div class="stat-label">Survived</div>
    </div>
    <div class="stat">
      <div class="stat-value">${(report.duration / 1000).toFixed(2)}s</div>
      <div class="stat-label">Duration</div>
    </div>
  </div>

  <h2>By Mutation Type</h2>
  <table>
    <tr><th>Type</th><th>Score</th><th>Killed</th><th>Survived</th></tr>
    ${Object.entries(report.byType)
      .map(
        ([type, stats]) => `
    <tr>
      <td>${type}</td>
      <td>
        <div class="bar"><div class="bar-fill" style="width: ${stats.score}%"></div></div>
        ${stats.score.toFixed(1)}%
      </td>
      <td class="killed">${stats.killed}</td>
      <td class="survived">${stats.survived}</td>
    </tr>`
      )
      .join('')}
  </table>

  <h2>Surviving Mutants</h2>
  ${report.survivors
    .slice(0, 20)
    .map(
      (m) => `
  <div class="mutant">
    <div class="mutant-desc">${m.description}</div>
    <div class="mutant-loc">${m.location.file}:${m.location.startLine}</div>
    <p><code>${m.original}</code> → <code>${m.mutated}</code></p>
  </div>`
    )
    .join('')}
  ${report.survivors.length > 20 ? `<p>... and ${report.survivors.length - 20} more</p>` : ''}
  
  <footer style="margin-top: 40px; color: #71717a; font-size: 14px;">
    Generated: ${report.timestamp.toISOString()}
  </footer>
</body>
</html>`;
}
