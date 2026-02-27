/**
 * Report Generator
 * 
 * Generate comprehensive comparison reports.
 */

import type { EquivalenceResult, Difference } from './equivalence.js';
import type { PerformanceResult, PerformanceMetrics } from './performance.js';
import type { CoverageResult, CoverageMetrics, CoverageGap } from './coverage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Implementation information */
export interface ImplementationInfo {
  name: string;
  version?: string;
  source?: string;
  linesOfCode?: number;
  dependencies?: string[];
  complexity?: number;
}

/** Full comparison result */
export interface ComparisonResult {
  /** Implementations being compared */
  implementations: ImplementationInfo[];
  /** Behavioral equivalence results */
  equivalence: EquivalenceResult;
  /** Performance comparison results */
  performance: PerformanceResult;
  /** Coverage comparison results */
  coverage: CoverageResult;
  /** Overall recommendation */
  recommendation: string;
  /** Detailed recommendations */
  recommendations: Recommendation[];
  /** Timestamp of comparison */
  timestamp: Date;
  /** Duration of comparison in ms */
  duration: number;
}

/** A specific recommendation */
export interface Recommendation {
  type: 'use' | 'avoid' | 'investigate' | 'improve';
  implementation?: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  details?: string;
}

/** Report format options */
export interface ReportOptions {
  /** Include detailed sections */
  detailed?: boolean;
  /** Format type */
  format?: 'text' | 'markdown' | 'json' | 'html';
  /** Include raw data */
  includeRawData?: boolean;
  /** Include visualizations */
  includeVisualizations?: boolean;
  /** Maximum width for text output */
  maxWidth?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate recommendations based on comparison results
 */
export function generateRecommendations(
  equivalence: EquivalenceResult,
  performance: PerformanceResult,
  coverage: CoverageResult,
  gaps?: CoverageGap[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Performance winner
  if (performance.margin > 20) {
    recommendations.push({
      type: 'use',
      implementation: performance.winner,
      reason: `Significantly faster than alternatives (${performance.margin.toFixed(1)}% margin)`,
      priority: 'high',
    });
  }

  // Equivalence issues
  if (!equivalence.equivalent) {
    const criticalDiffs = equivalence.differences.filter(d => d.severity === 'critical');
    if (criticalDiffs.length > 0) {
      const implsWithIssues = new Set<string>();
      for (const diff of criticalDiffs) {
        for (const impl of diff.outputs.keys()) {
          implsWithIssues.add(impl);
        }
      }
      recommendations.push({
        type: 'investigate',
        reason: `Critical behavioral differences found in ${criticalDiffs.length} cases`,
        priority: 'high',
        details: `Affected implementations: ${Array.from(implsWithIssues).join(', ')}`,
      });
    }
  }

  // Coverage issues
  const coverageRates = Array.from(coverage.byImplementation.entries());
  for (const [name, metrics] of coverageRates) {
    if (metrics.passRate < 70) {
      recommendations.push({
        type: 'avoid',
        implementation: name,
        reason: `Low test pass rate (${metrics.passRate.toFixed(1)}%)`,
        priority: metrics.passRate < 50 ? 'high' : 'medium',
      });
    }
  }

  // Coverage gaps
  if (gaps && gaps.length > 0) {
    const criticalGaps = gaps.filter(g => g.severity === 'critical');
    if (criticalGaps.length > 0) {
      recommendations.push({
        type: 'improve',
        reason: `${criticalGaps.length} critical coverage gaps found`,
        priority: 'high',
        details: criticalGaps.map(g => g.description).join(', '),
      });
    }
  }

  // Divergent behavior
  if (coverage.divergentTests.length > coverage.comparison.totalUniqueTests * 0.2) {
    recommendations.push({
      type: 'investigate',
      reason: `High behavioral divergence (${coverage.divergentTests.length} divergent tests)`,
      priority: 'medium',
    });
  }

  // Best overall
  if (equivalence.equivalent && performance.margin < 10) {
    const bestCoverage = coverage.comparison.bestCoverage;
    if (bestCoverage.passRate >= 95) {
      recommendations.push({
        type: 'use',
        implementation: bestCoverage.name,
        reason: 'Highest test coverage with equivalent behavior',
        priority: 'medium',
      });
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Generate overall recommendation string
 */
export function generateOverallRecommendation(
  recommendations: Recommendation[],
  equivalence: EquivalenceResult,
  performance: PerformanceResult,
  coverage: CoverageResult
): string {
  // Check for critical issues
  const criticalDiffs = equivalence.differences.filter(d => d.severity === 'critical');
  if (criticalDiffs.length > 0) {
    return `⚠️ INVESTIGATE: Critical behavioral differences detected between implementations. ` +
      `Do not use interchangeably until resolved.`;
  }

  // All equivalent
  if (equivalence.equivalent) {
    const winner = performance.winner;
    const winnerCoverage = coverage.byImplementation.get(winner);
    
    if (winnerCoverage && winnerCoverage.passRate >= 95 && performance.margin > 10) {
      return `✅ RECOMMEND: Use "${winner}" - best performance with full test coverage`;
    }
    
    if (performance.margin < 5) {
      const bestCoverage = coverage.comparison.bestCoverage.name;
      return `✅ RECOMMEND: Use "${bestCoverage}" - all implementations equivalent, this has best coverage`;
    }
    
    return `✅ RECOMMEND: Use "${winner}" - ${performance.margin.toFixed(1)}% faster than alternatives`;
  }

  // Not equivalent but one is clearly better
  const useRecs = recommendations.filter(r => r.type === 'use' && r.priority === 'high');
  if (useRecs.length === 1) {
    return `⚡ PREFER: "${useRecs[0].implementation}" - ${useRecs[0].reason}`;
  }

  // Mixed results
  return `🔍 REVIEW: Implementations show different behaviors. Manual review recommended before selection.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a text report
 */
export function generateTextReport(result: ComparisonResult, options: ReportOptions = {}): string {
  const lines: string[] = [];
  const width = options.maxWidth ?? 80;
  const separator = '═'.repeat(width);
  const subseparator = '─'.repeat(width);

  // Header
  lines.push(separator);
  lines.push(centerText('IMPLEMENTATION COMPARISON REPORT', width));
  lines.push(separator);
  lines.push('');

  // Summary
  lines.push('📋 SUMMARY');
  lines.push(subseparator);
  lines.push(`Implementations: ${result.implementations.map(i => i.name).join(', ')}`);
  lines.push(`Comparison Date: ${result.timestamp.toISOString()}`);
  lines.push(`Duration: ${result.duration}ms`);
  lines.push('');

  // Recommendation
  lines.push('💡 RECOMMENDATION');
  lines.push(subseparator);
  lines.push(wrapText(result.recommendation, width));
  lines.push('');

  // Equivalence
  lines.push('🔄 BEHAVIORAL EQUIVALENCE');
  lines.push(subseparator);
  lines.push(`Status: ${result.equivalence.equivalent ? '✅ Equivalent' : '❌ Differences Found'}`);
  lines.push(`Inputs Tested: ${result.equivalence.inputsCovered}`);
  lines.push(`Equivalence Rate: ${result.equivalence.equivalenceRate.toFixed(1)}%`);
  
  if (!result.equivalence.equivalent && options.detailed) {
    lines.push('');
    lines.push('Differences:');
    for (const diff of result.equivalence.differences.slice(0, 5)) {
      lines.push(`  [${diff.severity}] ${diff.category}: ${diff.description}`);
    }
    if (result.equivalence.differences.length > 5) {
      lines.push(`  ... and ${result.equivalence.differences.length - 5} more`);
    }
  }
  lines.push('');

  // Performance
  lines.push('⚡ PERFORMANCE');
  lines.push(subseparator);
  lines.push(`Winner: ${result.performance.winner} (${result.performance.margin.toFixed(1)}% margin)`);
  lines.push('');
  
  // Performance table
  lines.push('  Implementation'.padEnd(20) + 'P50'.padStart(10) + 'P99'.padStart(10) + 'RPS'.padStart(12));
  lines.push('  ' + '-'.repeat(50));
  
  for (const [name, metrics] of result.performance.byImplementation) {
    const isWinner = name === result.performance.winner;
    lines.push(
      `  ${isWinner ? '★' : ' '} ${name.padEnd(17)}` +
      `${metrics.latencyP50.toFixed(1)}ms`.padStart(10) +
      `${metrics.latencyP99.toFixed(1)}ms`.padStart(10) +
      `${metrics.throughputRPS.toFixed(0)}/s`.padStart(12)
    );
  }
  lines.push('');

  // Coverage
  lines.push('📊 TEST COVERAGE');
  lines.push(subseparator);
  lines.push(`Best: ${result.coverage.comparison.bestCoverage.name} (${result.coverage.comparison.bestCoverage.passRate.toFixed(1)}%)`);
  lines.push(`Average: ${result.coverage.comparison.averagePassRate.toFixed(1)}%`);
  lines.push(`Consensus Tests: ${result.coverage.comparison.consensusTests}/${result.coverage.comparison.totalUniqueTests}`);
  
  if (result.coverage.divergentTests.length > 0) {
    lines.push(`Divergent Tests: ${result.coverage.divergentTests.length}`);
  }
  lines.push('');

  // Detailed recommendations
  if (options.detailed && result.recommendations.length > 0) {
    lines.push('📝 DETAILED RECOMMENDATIONS');
    lines.push(subseparator);
    for (const rec of result.recommendations) {
      const icon = rec.type === 'use' ? '✅' : rec.type === 'avoid' ? '❌' : rec.type === 'investigate' ? '🔍' : '🔧';
      const impl = rec.implementation ? `[${rec.implementation}] ` : '';
      lines.push(`${icon} ${impl}${rec.reason}`);
      if (rec.details) {
        lines.push(`   ${rec.details}`);
      }
    }
    lines.push('');
  }

  lines.push(separator);
  return lines.join('\n');
}

/**
 * Generate a Markdown report
 */
export function generateMarkdownReport(result: ComparisonResult, options: ReportOptions = {}): string {
  const lines: string[] = [];

  // Header
  lines.push('# Implementation Comparison Report');
  lines.push('');
  lines.push(`> Generated: ${result.timestamp.toISOString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`**Implementations:** ${result.implementations.map(i => `\`${i.name}\``).join(', ')}`);
  lines.push('');

  // Recommendation
  lines.push('## Recommendation');
  lines.push('');
  lines.push(`> ${result.recommendation}`);
  lines.push('');

  // Equivalence
  lines.push('## Behavioral Equivalence');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Status | ${result.equivalence.equivalent ? '✅ Equivalent' : '❌ Differences Found'} |`);
  lines.push(`| Inputs Tested | ${result.equivalence.inputsCovered} |`);
  lines.push(`| Equivalence Rate | ${result.equivalence.equivalenceRate.toFixed(1)}% |`);
  lines.push('');

  if (!result.equivalence.equivalent && options.detailed) {
    lines.push('### Differences');
    lines.push('');
    lines.push('| Severity | Category | Description |');
    lines.push('|----------|----------|-------------|');
    for (const diff of result.equivalence.differences.slice(0, 10)) {
      lines.push(`| ${diff.severity} | ${diff.category} | ${diff.description} |`);
    }
    lines.push('');
  }

  // Performance
  lines.push('## Performance');
  lines.push('');
  lines.push(`**Winner:** \`${result.performance.winner}\` (${result.performance.margin.toFixed(1)}% margin)`);
  lines.push('');
  lines.push('| Implementation | P50 | P99 | Throughput | Memory |');
  lines.push('|----------------|-----|-----|------------|--------|');
  
  for (const [name, metrics] of result.performance.byImplementation) {
    const isWinner = name === result.performance.winner;
    lines.push(
      `| ${isWinner ? '⭐ ' : ''}${name} | ` +
      `${metrics.latencyP50.toFixed(1)}ms | ` +
      `${metrics.latencyP99.toFixed(1)}ms | ` +
      `${metrics.throughputRPS.toFixed(0)}/s | ` +
      `${metrics.memoryMB.toFixed(1)}MB |`
    );
  }
  lines.push('');

  // Coverage
  lines.push('## Test Coverage');
  lines.push('');
  lines.push('| Implementation | Pass Rate | Passed | Failed | Total |');
  lines.push('|----------------|-----------|--------|--------|-------|');
  
  for (const [name, metrics] of result.coverage.byImplementation) {
    const isBest = name === result.coverage.comparison.bestCoverage.name;
    lines.push(
      `| ${isBest ? '⭐ ' : ''}${name} | ` +
      `${metrics.passRate.toFixed(1)}% | ` +
      `${metrics.passed} | ` +
      `${metrics.failed} | ` +
      `${metrics.total} |`
    );
  }
  lines.push('');

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('## Detailed Recommendations');
    lines.push('');
    for (const rec of result.recommendations) {
      const icon = rec.type === 'use' ? '✅' : rec.type === 'avoid' ? '❌' : rec.type === 'investigate' ? '🔍' : '🔧';
      const impl = rec.implementation ? `**${rec.implementation}**: ` : '';
      lines.push(`- ${icon} ${impl}${rec.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a JSON report
 */
export function generateJSONReport(result: ComparisonResult): string {
  return JSON.stringify({
    ...result,
    equivalence: {
      ...result.equivalence,
      differences: result.equivalence.differences.map(d => ({
        ...d,
        outputs: Object.fromEntries(d.outputs),
      })),
      behaviorGroups: result.equivalence.behaviorGroups,
    },
    performance: {
      ...result.performance,
      byImplementation: Object.fromEntries(result.performance.byImplementation),
      rankings: result.performance.rankings,
    },
    coverage: {
      ...result.coverage,
      byImplementation: Object.fromEntries(
        Array.from(result.coverage.byImplementation.entries()).map(([k, v]) => [
          k,
          {
            ...v,
            byCategory: Object.fromEntries(v.byCategory),
          },
        ])
      ),
      divergentTests: result.coverage.divergentTests.map(t => ({
        ...t,
        results: Object.fromEntries(t.results),
      })),
    },
  }, null, 2);
}

/**
 * Generate report in specified format
 */
export function generateReport(result: ComparisonResult, options: ReportOptions = {}): string {
  switch (options.format) {
    case 'markdown':
      return generateMarkdownReport(result, options);
    case 'json':
      return generateJSONReport(result);
    case 'html':
      // For HTML, generate markdown and wrap in basic HTML
      const md = generateMarkdownReport(result, options);
      return `<!DOCTYPE html>
<html>
<head>
  <title>Implementation Comparison Report</title>
  <style>
    body { font-family: system-ui; max-width: 900px; margin: 0 auto; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    blockquote { background: #f9f9f9; border-left: 4px solid #ccc; padding: 10px 15px; }
    pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
  </style>
</head>
<body>
<pre>${md}</pre>
</body>
</html>`;
    case 'text':
    default:
      return generateTextReport(result, options);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

function wrapText(text: string, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}
