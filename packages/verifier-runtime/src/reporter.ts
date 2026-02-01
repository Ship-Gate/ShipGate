// ============================================================================
// Results Reporter - Format verification results
// ============================================================================

import type { VerifyResult, CheckResult, CoverageInfo, TimingInfo } from './types';

/**
 * Report format options
 */
export type ReportFormat = 'text' | 'json' | 'markdown' | 'compact';

/**
 * Options for report generation
 */
export interface ReportOptions {
  format?: ReportFormat;
  showTiming?: boolean;
  showCoverage?: boolean;
  showPassedChecks?: boolean;
  colorize?: boolean;
}

/**
 * Generate a verification report
 */
export function generateReport(
  result: VerifyResult,
  options: ReportOptions = {}
): string {
  const format = options.format ?? 'text';

  switch (format) {
    case 'json':
      return generateJsonReport(result);
    case 'markdown':
      return generateMarkdownReport(result, options);
    case 'compact':
      return generateCompactReport(result);
    case 'text':
    default:
      return generateTextReport(result, options);
  }
}

/**
 * Generate report for multiple verification results
 */
export function generateSummaryReport(
  results: VerifyResult[],
  options: ReportOptions = {}
): string {
  const format = options.format ?? 'text';

  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'markdown':
      return generateMarkdownSummary(results, options);
    case 'text':
    default:
      return generateTextSummary(results, options);
  }
}

// ============================================================================
// TEXT FORMAT
// ============================================================================

function generateTextReport(result: VerifyResult, options: ReportOptions): string {
  const lines: string[] = [];
  const showPassed = options.showPassedChecks ?? true;

  // Header
  lines.push('═'.repeat(60));
  lines.push(`Verification Report: ${result.behaviorName}`);
  lines.push('═'.repeat(60));
  lines.push('');

  // Summary
  const verdictIcon = getVerdictIcon(result.verdict);
  lines.push(`Verdict: ${verdictIcon} ${result.verdict.toUpperCase()}`);
  lines.push(`Score: ${result.score}/100`);
  lines.push(`Success: ${result.success ? 'Yes' : 'No'}`);
  lines.push('');

  // Input used
  lines.push('─'.repeat(40));
  lines.push(`Input: ${result.inputUsed.name}`);
  lines.push(`Category: ${result.inputUsed.category}`);
  lines.push(`Description: ${result.inputUsed.description}`);
  lines.push('');

  // Preconditions
  if (result.preconditions.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('Preconditions:');
    lines.push(...formatCheckResults(result.preconditions, showPassed));
    lines.push('');
  }

  // Execution
  lines.push('─'.repeat(40));
  lines.push('Execution:');
  if (result.execution.success) {
    lines.push('  ✓ Completed successfully');
    if (result.execution.result !== undefined) {
      lines.push(`  Result: ${JSON.stringify(result.execution.result, null, 2).split('\n').join('\n  ')}`);
    }
  } else {
    lines.push('  ✗ Failed');
    if (result.execution.error) {
      lines.push(`  Error: ${result.execution.error.code}`);
      lines.push(`  Message: ${result.execution.error.message}`);
    }
  }
  lines.push(`  Duration: ${result.execution.duration.toFixed(2)}ms`);
  lines.push('');

  // Postconditions
  if (result.postconditions.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('Postconditions:');
    lines.push(...formatCheckResults(result.postconditions, showPassed));
    lines.push('');
  }

  // Invariants
  if (result.invariants.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('Invariants:');
    lines.push(...formatCheckResults(result.invariants, showPassed));
    lines.push('');
  }

  // Coverage
  if (options.showCoverage !== false) {
    lines.push('─'.repeat(40));
    lines.push('Coverage:');
    lines.push(...formatCoverage(result.coverage));
    lines.push('');
  }

  // Timing
  if (options.showTiming) {
    lines.push('─'.repeat(40));
    lines.push('Timing:');
    lines.push(...formatTiming(result.timing));
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

function formatCheckResults(results: CheckResult[], showPassed: boolean): string[] {
  const lines: string[] = [];

  for (const result of results) {
    if (!showPassed && result.passed) continue;

    const icon = result.passed ? '✓' : '✗';
    lines.push(`  ${icon} ${result.expression}`);

    if (!result.passed) {
      if (result.error) {
        lines.push(`      Error: ${result.error}`);
      } else {
        lines.push(`      Expected: ${JSON.stringify(result.expected)}`);
        lines.push(`      Actual: ${JSON.stringify(result.actual)}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  lines.push(`  ${passed}/${results.length} passed`);

  return lines;
}

function formatCoverage(coverage: CoverageInfo): string[] {
  return [
    `  Preconditions: ${coverage.preconditions.passed}/${coverage.preconditions.total}`,
    `  Postconditions: ${coverage.postconditions.passed}/${coverage.postconditions.total}`,
    `  Invariants: ${coverage.invariants.passed}/${coverage.invariants.total}`,
    `  Overall: ${coverage.overall.toFixed(1)}%`,
  ];
}

function formatTiming(timing: TimingInfo): string[] {
  return [
    `  Total: ${timing.total.toFixed(2)}ms`,
    `  Input Generation: ${timing.inputGeneration.toFixed(2)}ms`,
    `  Precondition Check: ${timing.preconditionCheck.toFixed(2)}ms`,
    `  Execution: ${timing.execution.toFixed(2)}ms`,
    `  Postcondition Check: ${timing.postconditionCheck.toFixed(2)}ms`,
    `  Invariant Check: ${timing.invariantCheck.toFixed(2)}ms`,
  ];
}

function getVerdictIcon(verdict: string): string {
  switch (verdict) {
    case 'verified':
      return '✓';
    case 'risky':
      return '⚠';
    case 'unsafe':
      return '✗';
    default:
      return '?';
  }
}

// ============================================================================
// COMPACT FORMAT
// ============================================================================

function generateCompactReport(result: VerifyResult): string {
  const verdictIcon = getVerdictIcon(result.verdict);
  const passed = result.success ? 'PASS' : 'FAIL';
  
  return `${verdictIcon} ${result.behaviorName}: ${passed} (${result.score}/100) - ${result.inputUsed.name}`;
}

// ============================================================================
// JSON FORMAT
// ============================================================================

function generateJsonReport(result: VerifyResult): string {
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// MARKDOWN FORMAT
// ============================================================================

function generateMarkdownReport(result: VerifyResult, options: ReportOptions): string {
  const lines: string[] = [];
  const showPassed = options.showPassedChecks ?? false;

  // Header
  lines.push(`# Verification Report: ${result.behaviorName}`);
  lines.push('');

  // Summary table
  const verdictEmoji = getVerdictEmoji(result.verdict);
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Verdict | ${verdictEmoji} ${result.verdict} |`);
  lines.push(`| Score | ${result.score}/100 |`);
  lines.push(`| Success | ${result.success ? '✅' : '❌'} |`);
  lines.push('');

  // Input
  lines.push('## Input');
  lines.push('');
  lines.push(`- **Name**: ${result.inputUsed.name}`);
  lines.push(`- **Category**: ${result.inputUsed.category}`);
  lines.push(`- **Description**: ${result.inputUsed.description}`);
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(result.inputUsed.values, null, 2));
  lines.push('```');
  lines.push('');

  // Preconditions
  if (result.preconditions.length > 0) {
    lines.push('## Preconditions');
    lines.push('');
    lines.push(...formatMarkdownChecks(result.preconditions, showPassed));
    lines.push('');
  }

  // Execution
  lines.push('## Execution');
  lines.push('');
  if (result.execution.success) {
    lines.push('✅ Completed successfully');
    if (result.execution.result !== undefined) {
      lines.push('');
      lines.push('**Result:**');
      lines.push('```json');
      lines.push(JSON.stringify(result.execution.result, null, 2));
      lines.push('```');
    }
  } else {
    lines.push('❌ Failed');
    if (result.execution.error) {
      lines.push('');
      lines.push(`- **Error**: ${result.execution.error.code}`);
      lines.push(`- **Message**: ${result.execution.error.message}`);
    }
  }
  lines.push('');

  // Postconditions
  if (result.postconditions.length > 0) {
    lines.push('## Postconditions');
    lines.push('');
    lines.push(...formatMarkdownChecks(result.postconditions, showPassed));
    lines.push('');
  }

  // Invariants
  if (result.invariants.length > 0) {
    lines.push('## Invariants');
    lines.push('');
    lines.push(...formatMarkdownChecks(result.invariants, showPassed));
    lines.push('');
  }

  // Coverage
  if (options.showCoverage !== false) {
    lines.push('## Coverage');
    lines.push('');
    lines.push('| Type | Passed | Total | Percentage |');
    lines.push('|------|--------|-------|------------|');
    lines.push(`| Preconditions | ${result.coverage.preconditions.passed} | ${result.coverage.preconditions.total} | ${getPercentage(result.coverage.preconditions)}% |`);
    lines.push(`| Postconditions | ${result.coverage.postconditions.passed} | ${result.coverage.postconditions.total} | ${getPercentage(result.coverage.postconditions)}% |`);
    lines.push(`| Invariants | ${result.coverage.invariants.passed} | ${result.coverage.invariants.total} | ${getPercentage(result.coverage.invariants)}% |`);
    lines.push(`| **Overall** | - | - | **${result.coverage.overall.toFixed(1)}%** |`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatMarkdownChecks(results: CheckResult[], showPassed: boolean): string[] {
  const lines: string[] = [];

  for (const result of results) {
    if (!showPassed && result.passed) continue;

    const icon = result.passed ? '✅' : '❌';
    lines.push(`- ${icon} \`${result.expression}\``);

    if (!result.passed) {
      if (result.error) {
        lines.push(`  - **Error**: ${result.error}`);
      } else {
        lines.push(`  - **Expected**: \`${JSON.stringify(result.expected)}\``);
        lines.push(`  - **Actual**: \`${JSON.stringify(result.actual)}\``);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  lines.push('');
  lines.push(`**${passed}/${results.length} passed**`);

  return lines;
}

function getVerdictEmoji(verdict: string): string {
  switch (verdict) {
    case 'verified':
      return '✅';
    case 'risky':
      return '⚠️';
    case 'unsafe':
      return '❌';
    default:
      return '❓';
  }
}

function getPercentage(coverage: { passed: number; total: number }): string {
  if (coverage.total === 0) return '100.0';
  return ((coverage.passed / coverage.total) * 100).toFixed(1);
}

// ============================================================================
// SUMMARY REPORTS
// ============================================================================

function generateTextSummary(results: VerifyResult[], _options: ReportOptions): string {
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push('Verification Summary');
  lines.push('═'.repeat(60));
  lines.push('');

  // Overall stats
  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;
  const avgScore = results.reduce((acc, r) => acc + r.score, 0) / results.length;

  lines.push(`Total: ${results.length}`);
  lines.push(`Passed: ${passed}`);
  lines.push(`Failed: ${failed}`);
  lines.push(`Average Score: ${avgScore.toFixed(1)}/100`);
  lines.push('');

  // Individual results
  lines.push('─'.repeat(40));
  lines.push('Results:');
  for (const result of results) {
    lines.push(`  ${generateCompactReport(result)}`);
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

function generateMarkdownSummary(results: VerifyResult[], _options: ReportOptions): string {
  const lines: string[] = [];

  lines.push('# Verification Summary');
  lines.push('');

  // Overall stats
  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;
  const avgScore = results.reduce((acc, r) => acc + r.score, 0) / results.length;

  lines.push('## Statistics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total | ${results.length} |`);
  lines.push(`| Passed | ${passed} |`);
  lines.push(`| Failed | ${failed} |`);
  lines.push(`| Average Score | ${avgScore.toFixed(1)}/100 |`);
  lines.push('');

  // Results table
  lines.push('## Results');
  lines.push('');
  lines.push('| Behavior | Input | Verdict | Score | Status |');
  lines.push('|----------|-------|---------|-------|--------|');
  
  for (const result of results) {
    const emoji = result.success ? '✅' : '❌';
    const verdictEmoji = getVerdictEmoji(result.verdict);
    lines.push(`| ${result.behaviorName} | ${result.inputUsed.name} | ${verdictEmoji} ${result.verdict} | ${result.score}/100 | ${emoji} |`);
  }

  return lines.join('\n');
}
