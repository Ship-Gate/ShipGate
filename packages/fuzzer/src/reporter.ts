// ============================================================================
// Fuzz Report Generator
// Generate comprehensive reports from fuzzing results
// ============================================================================

import { 
  FuzzResult, 
  FuzzReport, 
  ReportSummary, 
  CrashReport, 
  HangReport, 
  CoverageReport,
  Crash,
  Hang,
  CrashCategory,
} from './types.js';

/**
 * Generate a comprehensive fuzz report
 */
export function generateReport(result: FuzzResult, targetName: string): FuzzReport {
  return {
    summary: generateSummary(result, targetName),
    crashes: result.crashes.map(crash => generateCrashReport(crash)),
    hangs: result.hangs.map(hang => generateHangReport(hang)),
    coverage: generateCoverageReport(result),
    recommendations: generateRecommendations(result),
  };
}

/**
 * Generate summary section
 */
function generateSummary(result: FuzzResult, targetName: string): ReportSummary {
  return {
    targetName,
    duration: result.duration,
    iterations: result.iterations,
    crashCount: result.crashes.length,
    hangCount: result.hangs.length,
    coveragePercent: result.coverage.percentage,
    seed: result.seed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate crash report entry
 */
function generateCrashReport(crash: Crash): CrashReport {
  return {
    id: crash.uniqueId,
    category: crash.category,
    error: crash.error,
    input: safeStringify(crash.input),
    minimizedInput: crash.minimized ? safeStringify(crash.minimized) : undefined,
    stack: crash.stack,
    reproducible: crash.reproducible,
    fuzzCategory: crash.fuzzCategory,
    recommendation: getCrashRecommendation(crash),
  };
}

/**
 * Generate hang report entry
 */
function generateHangReport(hang: Hang): HangReport {
  return {
    id: hang.uniqueId,
    input: safeStringify(hang.input),
    duration: hang.duration,
  };
}

/**
 * Generate coverage report
 */
function generateCoverageReport(result: FuzzResult): CoverageReport {
  return {
    percentage: result.coverage.percentage,
    totalBranches: result.coverage.totalBranches,
    coveredBranches: result.coverage.coveredBranches,
    uncoveredAreas: [], // Would require source mapping
  };
}

/**
 * Generate recommendations based on findings
 */
function generateRecommendations(result: FuzzResult): string[] {
  const recommendations: string[] = [];

  // Crash-based recommendations
  if (result.crashes.length > 0) {
    const crashCategories = new Set(result.crashes.map(c => c.category));
    
    if (crashCategories.has('exception')) {
      recommendations.push(
        'Add input validation to prevent uncaught exceptions. ' +
        'Consider using try-catch blocks with proper error handling.'
      );
    }
    
    if (crashCategories.has('timeout')) {
      recommendations.push(
        'Review algorithmic complexity and add timeout guards. ' +
        'Consider adding resource limits for long-running operations.'
      );
    }
    
    if (crashCategories.has('oom')) {
      recommendations.push(
        'Add memory limits and validate input sizes. ' +
        'Consider streaming large data instead of loading into memory.'
      );
    }
    
    if (crashCategories.has('security')) {
      recommendations.push(
        'Critical: Security vulnerabilities detected. ' +
        'Review input sanitization and implement proper escaping.'
      );
    }
  }

  // Fuzz category-based recommendations
  const injectionCrashes = result.crashes.filter(c => c.fuzzCategory === 'injection');
  if (injectionCrashes.length > 0) {
    recommendations.push(
      'Input injection vulnerabilities detected. ' +
      'Implement proper input sanitization and parameterized queries.'
    );
  }

  const boundaryCrashes = result.crashes.filter(c => c.fuzzCategory === 'boundary');
  if (boundaryCrashes.length > 0) {
    recommendations.push(
      'Boundary condition errors found. ' +
      'Review edge case handling and add explicit bounds checking.'
    );
  }

  const unicodeCrashes = result.crashes.filter(c => c.fuzzCategory === 'unicode');
  if (unicodeCrashes.length > 0) {
    recommendations.push(
      'Unicode handling issues detected. ' +
      'Review string processing for proper Unicode support.'
    );
  }

  // Coverage recommendations
  if (result.coverage.percentage < 50) {
    recommendations.push(
      'Low code coverage. Consider adding more seed inputs ' +
      'and enabling coverage-guided fuzzing for better exploration.'
    );
  } else if (result.coverage.percentage < 80) {
    recommendations.push(
      'Moderate code coverage. Continue fuzzing with additional strategies ' +
      'to improve coverage of unexplored code paths.'
    );
  }

  // Hang recommendations
  if (result.hangs.length > 0) {
    recommendations.push(
      'Potential infinite loops or long-running operations detected. ' +
      'Review loop termination conditions and add execution timeouts.'
    );
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      'No critical issues found. Continue regular fuzzing ' +
      'and consider increasing iteration count for deeper testing.'
    );
  }

  return recommendations;
}

/**
 * Get recommendation for specific crash
 */
function getCrashRecommendation(crash: Crash): string {
  const categoryRecommendations: Record<CrashCategory, string> = {
    exception: 'Add input validation and error handling for this case.',
    assertion: 'Review assertion conditions and ensure valid inputs.',
    timeout: 'Add timeout handling or optimize the code path.',
    oom: 'Add memory limits and validate input sizes.',
    hang: 'Review loop conditions and add termination checks.',
    security: 'CRITICAL: Fix security vulnerability immediately.',
  };

  const fuzzRecommendations: Record<string, string> = {
    injection: 'Sanitize input to prevent injection attacks.',
    boundary: 'Add bounds checking for edge cases.',
    unicode: 'Ensure proper Unicode string handling.',
    'type-coercion': 'Validate input types explicitly.',
    security: 'Review security implications of this input.',
  };

  return (
    categoryRecommendations[crash.category] + ' ' +
    (fuzzRecommendations[crash.fuzzCategory] ?? '')
  ).trim();
}

/**
 * Safely stringify an object
 */
function safeStringify(value: unknown, maxLength: number = 1000): string {
  try {
    const str = JSON.stringify(value, replacer, 2);
    if (str.length > maxLength) {
      return str.slice(0, maxLength) + '... (truncated)';
    }
    return str;
  } catch {
    return String(value).slice(0, maxLength);
  }
}

/**
 * JSON replacer for special values
 */
function replacer(_key: string, value: unknown): unknown {
  if (value === undefined) return '[undefined]';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '[NaN]';
    if (value === Infinity) return '[Infinity]';
    if (value === -Infinity) return '[-Infinity]';
  }
  if (typeof value === 'bigint') return `[BigInt: ${value}]`;
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return `[Symbol: ${value.toString()}]`;
  return value;
}

/**
 * Format report as markdown
 */
export function formatMarkdown(report: FuzzReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Fuzz Report: ${report.summary.targetName}`);
  lines.push('');
  lines.push(`Generated: ${report.summary.timestamp}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Duration | ${formatDuration(report.summary.duration)} |`);
  lines.push(`| Iterations | ${report.summary.iterations.toLocaleString()} |`);
  lines.push(`| Crashes | ${report.summary.crashCount} |`);
  lines.push(`| Hangs | ${report.summary.hangCount} |`);
  lines.push(`| Coverage | ${report.summary.coveragePercent.toFixed(1)}% |`);
  lines.push(`| Seed | \`${report.summary.seed}\` |`);
  lines.push('');

  // Verdict
  const verdict = report.crashes.length === 0 && report.hangs.length === 0
    ? '✅ PASS'
    : report.crashes.some(c => c.category === 'security')
      ? '🔴 CRITICAL'
      : '⚠️ ISSUES FOUND';
  lines.push(`**Verdict:** ${verdict}`);
  lines.push('');

  // Crashes
  if (report.crashes.length > 0) {
    lines.push('## Crashes');
    lines.push('');
    
    for (const crash of report.crashes) {
      lines.push(`### ${crash.id}`);
      lines.push('');
      lines.push(`- **Category:** ${crash.category}`);
      lines.push(`- **Fuzz Type:** ${crash.fuzzCategory}`);
      lines.push(`- **Reproducible:** ${crash.reproducible ? 'Yes' : 'No'}`);
      lines.push('');
      lines.push('**Error:**');
      lines.push('```');
      lines.push(crash.error);
      lines.push('```');
      lines.push('');
      lines.push('**Input:**');
      lines.push('```json');
      lines.push(crash.input);
      lines.push('```');
      lines.push('');
      if (crash.minimizedInput) {
        lines.push('**Minimized Input:**');
        lines.push('```json');
        lines.push(crash.minimizedInput);
        lines.push('```');
        lines.push('');
      }
      lines.push('**Stack Trace:**');
      lines.push('```');
      lines.push(crash.stack.split('\n').slice(0, 10).join('\n'));
      lines.push('```');
      lines.push('');
      lines.push(`**Recommendation:** ${crash.recommendation}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // Hangs
  if (report.hangs.length > 0) {
    lines.push('## Hangs');
    lines.push('');
    
    for (const hang of report.hangs) {
      lines.push(`### ${hang.id}`);
      lines.push('');
      lines.push(`- **Duration:** ${formatDuration(hang.duration)}`);
      lines.push('');
      lines.push('**Input:**');
      lines.push('```json');
      lines.push(hang.input);
      lines.push('```');
      lines.push('');
    }
  }

  // Coverage
  lines.push('## Coverage');
  lines.push('');
  lines.push(`- **Total Branches:** ${report.coverage.totalBranches}`);
  lines.push(`- **Covered Branches:** ${report.coverage.coveredBranches}`);
  lines.push(`- **Percentage:** ${report.coverage.percentage.toFixed(1)}%`);
  lines.push('');

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  for (const rec of report.recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Format report as JSON
 */
export function formatJson(report: FuzzReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Print report to console
 */
export function printReport(report: FuzzReport): void {
  console.log('\n' + '='.repeat(60));
  console.log(`FUZZ REPORT: ${report.summary.targetName}`);
  console.log('='.repeat(60));
  
  console.log(`\nDuration: ${formatDuration(report.summary.duration)}`);
  console.log(`Iterations: ${report.summary.iterations.toLocaleString()}`);
  console.log(`Crashes: ${report.summary.crashCount}`);
  console.log(`Hangs: ${report.summary.hangCount}`);
  console.log(`Coverage: ${report.summary.coveragePercent.toFixed(1)}%`);
  console.log(`Seed: ${report.summary.seed}`);

  if (report.crashes.length > 0) {
    console.log('\n' + '-'.repeat(40));
    console.log('CRASHES:');
    for (const crash of report.crashes) {
      console.log(`\n[${crash.id}] ${crash.category} - ${crash.fuzzCategory}`);
      console.log(`  Error: ${crash.error}`);
      console.log(`  Recommendation: ${crash.recommendation}`);
    }
  }

  if (report.hangs.length > 0) {
    console.log('\n' + '-'.repeat(40));
    console.log('HANGS:');
    for (const hang of report.hangs) {
      console.log(`\n[${hang.id}] Duration: ${formatDuration(hang.duration)}`);
    }
  }

  console.log('\n' + '-'.repeat(40));
  console.log('RECOMMENDATIONS:');
  for (const rec of report.recommendations) {
    console.log(`  • ${rec}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}
