// ============================================================================
// ISL Interpreter - Report Generation
// @isl-lang/interpreter/report
// ============================================================================

import { writeFile } from 'node:fs/promises';
import type {
  VerificationReport,
  BehaviorResult,
  ScenarioResult,
  ConditionResult,
  CheckResult,
  ReportFormat,
  ReportOptions,
} from './types';

// ============================================================================
// REPORT GENERATOR
// ============================================================================

/**
 * Generate a report in the specified format.
 */
export async function generateReport(
  report: VerificationReport,
  options: ReportOptions
): Promise<string> {
  let output: string;
  
  switch (options.format) {
    case 'json':
      output = generateJsonReport(report);
      break;
    case 'terminal':
      output = generateTerminalReport(report, options.colors ?? true);
      break;
    case 'junit':
      output = generateJUnitReport(report);
      break;
    case 'markdown':
      output = generateMarkdownReport(report);
      break;
    default:
      throw new Error(`Unknown report format: ${options.format}`);
  }
  
  if (options.outputPath) {
    await writeFile(options.outputPath, output, 'utf-8');
  }
  
  return output;
}

// ============================================================================
// JSON REPORT
// ============================================================================

/**
 * Generate a JSON report (machine-parseable).
 */
export function generateJsonReport(report: VerificationReport): string {
  return JSON.stringify(
    {
      specPath: report.specPath,
      targetPath: report.targetPath,
      testDataPath: report.testDataPath,
      mode: report.mode,
      timestamp: report.timestamp.toISOString(),
      duration: report.duration,
      summary: report.summary,
      behaviors: report.behaviors.map((b) => ({
        behavior: b.behavior,
        description: b.description,
        passed: b.passed,
        duration: b.duration,
        preconditions: b.preconditions.map(formatConditionResult),
        postconditions: b.postconditions.map(formatConditionResult),
        invariants: b.invariants.map(formatConditionResult),
        scenarios: b.scenarios.map((s) => ({
          name: s.name,
          passed: s.passed,
          duration: s.duration,
          given: s.given.map(formatStepResult),
          when: s.when.map(formatStepResult),
          then: s.then.map(formatCheckResult),
          error: s.error ? { message: s.error.message, stack: s.error.stack } : undefined,
        })),
      })),
      warnings: report.warnings,
      metadata: report.metadata,
    },
    null,
    2
  );
}

function formatConditionResult(result: ConditionResult): object {
  return {
    type: result.type,
    expression: result.expression,
    status: result.result.status,
    message: result.result.message,
    duration: result.duration,
    ...('expected' in result.result ? { expected: result.result.expected } : {}),
    ...('actual' in result.result ? { actual: result.result.actual } : {}),
    ...('values' in result.result ? { values: result.result.values } : {}),
    ...('error' in result.result ? { error: result.result.error.message } : {}),
  };
}

function formatStepResult(result: { description: string; result: CheckResult; duration: number }): object {
  return {
    description: result.description,
    status: result.result.status,
    message: result.result.message,
    duration: result.duration,
    ...('error' in result.result ? { error: result.result.error.message } : {}),
  };
}

function formatCheckResult(result: CheckResult): object {
  return {
    status: result.status,
    message: result.message,
    ...('expected' in result ? { expected: result.expected } : {}),
    ...('actual' in result ? { actual: result.actual } : {}),
    ...('values' in result ? { values: result.values } : {}),
    ...('error' in result ? { error: result.error.message } : {}),
  };
}

// ============================================================================
// TERMINAL REPORT (Pretty output)
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const SYMBOLS = {
  check: '✓',
  cross: '✗',
  bullet: '•',
  arrow: '→',
  warning: '⚠',
};

/**
 * Generate a terminal report with colors.
 */
export function generateTerminalReport(report: VerificationReport, colors: boolean = true): string {
  const c = colors ? COLORS : Object.fromEntries(Object.keys(COLORS).map((k) => [k, '']));
  const lines: string[] = [];
  
  // Header
  lines.push('');
  lines.push(`${c.bold}ISL Verification Report${c.reset}`);
  lines.push(`${c.gray}${'─'.repeat(50)}${c.reset}`);
  lines.push(`${c.dim}Spec:${c.reset} ${report.specPath}`);
  if (report.targetPath) {
    lines.push(`${c.dim}Target:${c.reset} ${report.targetPath}`);
  }
  if (report.testDataPath) {
    lines.push(`${c.dim}Test Data:${c.reset} ${report.testDataPath}`);
  }
  lines.push(`${c.dim}Mode:${c.reset} ${report.mode}`);
  lines.push('');
  
  // Behaviors
  for (const behavior of report.behaviors) {
    const statusColor = behavior.passed ? c.green : c.red;
    const statusSymbol = behavior.passed ? SYMBOLS.check : SYMBOLS.cross;
    
    lines.push(`${statusColor}${statusSymbol}${c.reset} ${c.bold}${behavior.behavior}${c.reset}`);
    if (behavior.description) {
      lines.push(`  ${c.dim}${behavior.description}${c.reset}`);
    }
    
    // Preconditions
    for (const pre of behavior.preconditions) {
      lines.push(formatConditionLine(pre, 'pre', c));
    }
    
    // Postconditions
    for (const post of behavior.postconditions) {
      lines.push(formatConditionLine(post, 'post', c));
    }
    
    // Invariants
    for (const inv of behavior.invariants) {
      lines.push(formatConditionLine(inv, 'invariant', c));
    }
    
    // Scenarios
    if (behavior.scenarios.length > 0) {
      lines.push('');
      lines.push(`  ${c.cyan}Scenarios:${c.reset}`);
      
      for (const scenario of behavior.scenarios) {
        const sColor = scenario.passed ? c.green : c.red;
        const sSymbol = scenario.passed ? SYMBOLS.check : SYMBOLS.cross;
        
        lines.push(`  ${sColor}${sSymbol}${c.reset} "${scenario.name}"`);
        
        if (!scenario.passed) {
          // Show failed assertions
          for (const then of scenario.then) {
            if (then.status === 'failed') {
              lines.push(`    ${c.red}${SYMBOLS.arrow} ${then.message}${c.reset}`);
              if ('expected' in then) {
                lines.push(`      ${c.dim}expected:${c.reset} ${JSON.stringify(then.expected)}`);
                lines.push(`      ${c.dim}actual:${c.reset} ${JSON.stringify(then.actual)}`);
              }
            }
          }
          
          if (scenario.error) {
            lines.push(`    ${c.red}${SYMBOLS.arrow} Error: ${scenario.error.message}${c.reset}`);
          }
        }
      }
    }
    
    lines.push('');
  }
  
  // Summary
  lines.push(`${c.gray}${'─'.repeat(50)}${c.reset}`);
  
  const summaryColor = report.summary.failed === 0 && report.summary.errors === 0 ? c.green : c.red;
  lines.push(`${c.bold}Results:${c.reset} ${summaryColor}${report.summary.passed}/${report.summary.total} checks passed${c.reset}`);
  
  if (report.summary.failed > 0) {
    lines.push(`  ${c.red}${report.summary.failed} failed${c.reset}`);
  }
  if (report.summary.skipped > 0) {
    lines.push(`  ${c.yellow}${report.summary.skipped} skipped${c.reset}`);
  }
  if (report.summary.errors > 0) {
    lines.push(`  ${c.red}${report.summary.errors} errors${c.reset}`);
  }
  
  lines.push(`${c.dim}Duration: ${formatDuration(report.duration)}${c.reset}`);
  
  // Warnings
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push(`${c.yellow}${SYMBOLS.warning} Warnings:${c.reset}`);
    for (const warning of report.warnings) {
      lines.push(`  ${c.yellow}${SYMBOLS.bullet} ${warning}${c.reset}`);
    }
  }
  
  lines.push('');
  
  return lines.join('\n');
}

function formatConditionLine(
  cond: ConditionResult,
  prefix: string,
  c: typeof COLORS
): string {
  const statusColor = cond.result.status === 'passed' ? c.green : c.red;
  const statusSymbol = cond.result.status === 'passed' ? SYMBOLS.check : SYMBOLS.cross;
  
  let line = `  ${statusColor}${statusSymbol}${c.reset} ${c.dim}${prefix}:${c.reset} ${cond.expression}`;
  
  if (cond.result.status === 'passed' && 'values' in cond.result && cond.result.values) {
    const valuesStr = Object.entries(cond.result.values)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    if (valuesStr) {
      line += ` ${c.gray}(${valuesStr})${c.reset}`;
    }
  }
  
  if (cond.result.status === 'failed') {
    if ('expected' in cond.result) {
      line += `\n      ${c.dim}expected:${c.reset} ${JSON.stringify(cond.result.expected)}`;
      line += `\n      ${c.dim}actual:${c.reset} ${JSON.stringify(cond.result.actual)}`;
    }
  }
  
  return line;
}

// ============================================================================
// JUNIT XML REPORT
// ============================================================================

/**
 * Generate a JUnit XML report (for CI systems).
 */
export function generateJUnitReport(report: VerificationReport): string {
  const lines: string[] = [];
  
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<testsuites name="ISL Verification" tests="${report.summary.total}" failures="${report.summary.failed}" errors="${report.summary.errors}" skipped="${report.summary.skipped}" time="${report.duration / 1000}">`);
  
  for (const behavior of report.behaviors) {
    const tests = behavior.preconditions.length + behavior.postconditions.length + behavior.invariants.length + behavior.scenarios.length;
    const failures = countFailures(behavior);
    const errors = countErrors(behavior);
    
    lines.push(`  <testsuite name="${escapeXml(behavior.behavior)}" tests="${tests}" failures="${failures}" errors="${errors}" time="${behavior.duration / 1000}">`);
    
    // Preconditions
    for (const pre of behavior.preconditions) {
      lines.push(formatJUnitTestCase(`pre: ${pre.expression}`, pre.result, pre.duration));
    }
    
    // Postconditions
    for (const post of behavior.postconditions) {
      lines.push(formatJUnitTestCase(`post: ${post.expression}`, post.result, post.duration));
    }
    
    // Invariants
    for (const inv of behavior.invariants) {
      lines.push(formatJUnitTestCase(`invariant: ${inv.expression}`, inv.result, inv.duration));
    }
    
    // Scenarios
    for (const scenario of behavior.scenarios) {
      lines.push(formatJUnitScenario(scenario));
    }
    
    lines.push('  </testsuite>');
  }
  
  lines.push('</testsuites>');
  
  return lines.join('\n');
}

function formatJUnitTestCase(name: string, result: CheckResult, duration: number): string {
  const lines: string[] = [];
  
  lines.push(`    <testcase name="${escapeXml(name)}" time="${duration / 1000}">`);
  
  if (result.status === 'failed') {
    const message = 'expected' in result
      ? `expected ${JSON.stringify(result.expected)}, got ${JSON.stringify(result.actual)}`
      : result.message;
    lines.push(`      <failure message="${escapeXml(message)}" />`);
  } else if (result.status === 'error') {
    lines.push(`      <error message="${escapeXml(result.error.message)}">`);
    if (result.error.stack) {
      lines.push(`        ${escapeXml(result.error.stack)}`);
    }
    lines.push('      </error>');
  } else if (result.status === 'skipped') {
    lines.push(`      <skipped message="${escapeXml(result.reason)}" />`);
  }
  
  lines.push('    </testcase>');
  
  return lines.join('\n');
}

function formatJUnitScenario(scenario: ScenarioResult): string {
  const lines: string[] = [];
  
  lines.push(`    <testcase name="scenario: ${escapeXml(scenario.name)}" time="${scenario.duration / 1000}">`);
  
  if (!scenario.passed) {
    if (scenario.error) {
      lines.push(`      <error message="${escapeXml(scenario.error.message)}">`);
      if (scenario.error.stack) {
        lines.push(`        ${escapeXml(scenario.error.stack)}`);
      }
      lines.push('      </error>');
    } else {
      const failedThen = scenario.then.find((t) => t.status === 'failed' || t.status === 'error');
      if (failedThen) {
        const message = 'expected' in failedThen
          ? `${failedThen.message}: expected ${JSON.stringify(failedThen.expected)}, got ${JSON.stringify(failedThen.actual)}`
          : failedThen.message;
        lines.push(`      <failure message="${escapeXml(message)}" />`);
      }
    }
  }
  
  lines.push('    </testcase>');
  
  return lines.join('\n');
}

function countFailures(behavior: BehaviorResult): number {
  let count = 0;
  count += behavior.preconditions.filter((p) => p.result.status === 'failed').length;
  count += behavior.postconditions.filter((p) => p.result.status === 'failed').length;
  count += behavior.invariants.filter((p) => p.result.status === 'failed').length;
  count += behavior.scenarios.filter((s) => !s.passed && !s.error).length;
  return count;
}

function countErrors(behavior: BehaviorResult): number {
  let count = 0;
  count += behavior.preconditions.filter((p) => p.result.status === 'error').length;
  count += behavior.postconditions.filter((p) => p.result.status === 'error').length;
  count += behavior.invariants.filter((p) => p.result.status === 'error').length;
  count += behavior.scenarios.filter((s) => s.error !== undefined).length;
  return count;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// MARKDOWN REPORT
// ============================================================================

/**
 * Generate a Markdown report (for PR comments).
 */
export function generateMarkdownReport(report: VerificationReport): string {
  const lines: string[] = [];
  
  // Header
  const statusEmoji = report.summary.failed === 0 && report.summary.errors === 0 ? '✅' : '❌';
  lines.push(`## ${statusEmoji} ISL Verification Report`);
  lines.push('');
  
  // Summary table
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Spec | \`${report.specPath}\` |`);
  if (report.targetPath) {
    lines.push(`| Target | \`${report.targetPath}\` |`);
  }
  lines.push(`| Mode | ${report.mode} |`);
  lines.push(`| Duration | ${formatDuration(report.duration)} |`);
  lines.push(`| Total Checks | ${report.summary.total} |`);
  lines.push(`| Passed | ${report.summary.passed} |`);
  lines.push(`| Failed | ${report.summary.failed} |`);
  if (report.summary.skipped > 0) {
    lines.push(`| Skipped | ${report.summary.skipped} |`);
  }
  if (report.summary.errors > 0) {
    lines.push(`| Errors | ${report.summary.errors} |`);
  }
  lines.push('');
  
  // Behaviors
  for (const behavior of report.behaviors) {
    const statusEmoji = behavior.passed ? '✅' : '❌';
    lines.push(`### ${statusEmoji} ${behavior.behavior}`);
    
    if (behavior.description) {
      lines.push(`> ${behavior.description}`);
    }
    lines.push('');
    
    // Conditions table
    const allConditions = [
      ...behavior.preconditions.map((c) => ({ ...c, kind: 'pre' })),
      ...behavior.postconditions.map((c) => ({ ...c, kind: 'post' })),
      ...behavior.invariants.map((c) => ({ ...c, kind: 'invariant' })),
    ];
    
    if (allConditions.length > 0) {
      lines.push('| Status | Type | Expression |');
      lines.push('|--------|------|------------|');
      
      for (const cond of allConditions) {
        const emoji = cond.result.status === 'passed' ? '✅' : cond.result.status === 'failed' ? '❌' : '⚠️';
        lines.push(`| ${emoji} | ${cond.kind} | \`${cond.expression}\` |`);
      }
      lines.push('');
    }
    
    // Scenarios
    if (behavior.scenarios.length > 0) {
      lines.push('#### Scenarios');
      lines.push('');
      
      for (const scenario of behavior.scenarios) {
        const emoji = scenario.passed ? '✅' : '❌';
        lines.push(`- ${emoji} **${scenario.name}**`);
        
        if (!scenario.passed) {
          for (const then of scenario.then) {
            if (then.status === 'failed') {
              lines.push(`  - ❌ ${then.message}`);
              if ('expected' in then) {
                lines.push(`    - Expected: \`${JSON.stringify(then.expected)}\``);
                lines.push(`    - Actual: \`${JSON.stringify(then.actual)}\``);
              }
            }
          }
          
          if (scenario.error) {
            lines.push(`  - Error: ${scenario.error.message}`);
          }
        }
      }
      lines.push('');
    }
  }
  
  // Warnings
  if (report.warnings.length > 0) {
    lines.push('### ⚠️ Warnings');
    lines.push('');
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }
  
  // Footer
  lines.push('---');
  lines.push(`*Generated at ${report.timestamp.toISOString()}*`);
  
  return lines.join('\n');
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}
