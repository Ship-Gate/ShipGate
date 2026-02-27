/**
 * Security Verification Reporter
 *
 * Generates verification reports in various formats.
 *
 * @module @isl-lang/verifier-security/reporter
 */

import type {
  SecurityVerifyResult,
  SecurityViolation,
} from './types.js';

// ============================================================================
// Report Format Types
// ============================================================================

export type ReportFormat = 'text' | 'json' | 'markdown' | 'compact';

export interface ReportOptions {
  format: ReportFormat;
  includeContext?: boolean;
  includeFix?: boolean;
  colorize?: boolean;
}

// ============================================================================
// Text Colors (ANSI)
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function colorize(text: string, color: keyof typeof colors, useColor: boolean): string {
  return useColor ? `${colors[color]}${text}${colors.reset}` : text;
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a verification report
 */
export function generateReport(
  result: SecurityVerifyResult,
  options: ReportOptions = { format: 'text' }
): string {
  switch (options.format) {
    case 'json':
      return generateJsonReport(result);
    case 'markdown':
      return generateMarkdownReport(result, options);
    case 'compact':
      return generateCompactReport(result, options);
    case 'text':
    default:
      return generateTextReport(result, options);
  }
}

// ============================================================================
// Text Format
// ============================================================================

function generateTextReport(result: SecurityVerifyResult, options: ReportOptions): string {
  const useColor = options.colorize ?? true;
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(colorize('═══════════════════════════════════════════════════════════════', 'cyan', useColor));
  lines.push(colorize('                    SECURITY VERIFICATION REPORT                ', 'bold', useColor));
  lines.push(colorize('═══════════════════════════════════════════════════════════════', 'cyan', useColor));
  lines.push('');

  // Verdict
  const verdictIcon = getVerdictIcon(result.verdict);
  const verdictColor = getVerdictColor(result.verdict);
  lines.push(`  Verdict: ${colorize(verdictIcon + ' ' + result.verdict.toUpperCase(), verdictColor, useColor)}`);
  lines.push(`  Score:   ${colorize(result.score.toString() + '/100', result.score >= 80 ? 'green' : result.score >= 50 ? 'yellow' : 'red', useColor)}`);
  lines.push('');

  // Coverage Summary
  lines.push(colorize('  Coverage:', 'bold', useColor));
  lines.push(`    Static Rules:  ${result.coverage.staticRules.passed}/${result.coverage.staticRules.total} passed`);
  lines.push(`    Runtime Checks: ${result.coverage.runtimeChecks.passed}/${result.coverage.runtimeChecks.total} passed`);
  lines.push(`    Files Analyzed: ${result.coverage.filesAnalyzed}`);
  lines.push('');

  // Violations Summary
  const criticalCount = result.staticViolations.filter(v => v.severity === 'critical').length;
  const highCount = result.staticViolations.filter(v => v.severity === 'high').length;
  const mediumCount = result.staticViolations.filter(v => v.severity === 'medium').length;
  const lowCount = result.staticViolations.filter(v => v.severity === 'low').length;

  lines.push(colorize('  Violations:', 'bold', useColor));
  lines.push(`    Critical: ${colorize(criticalCount.toString(), 'red', useColor)}`);
  lines.push(`    High:     ${colorize(highCount.toString(), 'yellow', useColor)}`);
  lines.push(`    Medium:   ${colorize(mediumCount.toString(), 'blue', useColor)}`);
  lines.push(`    Low:      ${colorize(lowCount.toString(), 'dim', useColor)}`);
  lines.push('');

  // Static Violations
  if (result.staticViolations.length > 0) {
    lines.push(colorize('  Static Analysis Violations:', 'bold', useColor));
    lines.push(colorize('  ───────────────────────────────────────────────────────────', 'dim', useColor));

    for (const violation of result.staticViolations) {
      const severityColor = getSeverityColor(violation.severity);
      lines.push('');
      lines.push(`  ${colorize(violation.severity.toUpperCase(), severityColor, useColor)} ${violation.file}:${violation.line}`);
      lines.push(`  ${colorize('→', 'cyan', useColor)} ${violation.message}`);
      lines.push(`  ${colorize('Evidence:', 'dim', useColor)} ${violation.evidence}`);

      if (options.includeContext && violation.metadata?.context) {
        lines.push(`  ${colorize('Context:', 'dim', useColor)}`);
        for (const contextLine of String(violation.metadata.context).split('\n')) {
          lines.push(`    ${contextLine}`);
        }
      }

      if (options.includeFix !== false && violation.fix) {
        lines.push(`  ${colorize('Fix:', 'green', useColor)}`);
        const fixLines = violation.fix.split('\n');
        for (const fixLine of fixLines.slice(0, 5)) {
          lines.push(`    ${fixLine}`);
        }
        if (fixLines.length > 5) {
          lines.push(`    ${colorize('... (truncated)', 'dim', useColor)}`);
        }
      }
    }
  } else {
    lines.push(colorize('  ✓ No static analysis violations detected', 'green', useColor));
  }

  // Runtime Check Results
  if (result.runtimeChecks.length > 0) {
    lines.push('');
    lines.push(colorize('  Runtime Check Results:', 'bold', useColor));
    lines.push(colorize('  ───────────────────────────────────────────────────────────', 'dim', useColor));

    for (const check of result.runtimeChecks) {
      const checkIcon = check.passed ? '✓' : '✗';
      const checkColor = check.passed ? 'green' : 'red';
      lines.push(`  ${colorize(checkIcon, checkColor, useColor)} ${check.checkName}: ${check.reason}`);
    }
  }

  // Timing
  lines.push('');
  lines.push(colorize('  Timing:', 'bold', useColor));
  lines.push(`    Total:          ${result.timing.total}ms`);
  lines.push(`    Static Analysis: ${result.timing.staticAnalysis}ms`);
  lines.push(`    Runtime:        ${result.timing.runtimeVerification}ms`);

  lines.push('');
  lines.push(colorize('═══════════════════════════════════════════════════════════════', 'cyan', useColor));
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// JSON Format
// ============================================================================

function generateJsonReport(result: SecurityVerifyResult): string {
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// Markdown Format
// ============================================================================

function generateMarkdownReport(result: SecurityVerifyResult, options: ReportOptions): string {
  const lines: string[] = [];

  // Header
  lines.push('# Security Verification Report');
  lines.push('');

  // Verdict badge
  const verdictIcon = getVerdictIcon(result.verdict);
  lines.push(`## ${verdictIcon} Verdict: **${result.verdict.toUpperCase()}**`);
  lines.push('');
  lines.push(`**Score:** ${result.score}/100`);
  lines.push('');

  // Coverage table
  lines.push('## Coverage');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Static Rules | ${result.coverage.staticRules.passed}/${result.coverage.staticRules.total} passed |`);
  lines.push(`| Runtime Checks | ${result.coverage.runtimeChecks.passed}/${result.coverage.runtimeChecks.total} passed |`);
  lines.push(`| Files Analyzed | ${result.coverage.filesAnalyzed} |`);
  lines.push('');

  // Violations Summary
  const criticalCount = result.staticViolations.filter(v => v.severity === 'critical').length;
  const highCount = result.staticViolations.filter(v => v.severity === 'high').length;

  lines.push('## Violation Summary');
  lines.push('');
  lines.push(`- **Critical:** ${criticalCount}`);
  lines.push(`- **High:** ${highCount}`);
  lines.push(`- **Total:** ${result.staticViolations.length}`);
  lines.push('');

  // Violations
  if (result.staticViolations.length > 0) {
    lines.push('## Violations');
    lines.push('');

    for (const violation of result.staticViolations) {
      lines.push(`### ${getSeverityEmoji(violation.severity)} ${violation.severity.toUpperCase()}: ${violation.file}:${violation.line}`);
      lines.push('');
      lines.push(`**Rule:** \`${violation.ruleId}\``);
      lines.push('');
      lines.push(`**Message:** ${violation.message}`);
      lines.push('');
      lines.push('**Evidence:**');
      lines.push('```typescript');
      lines.push(violation.evidence);
      lines.push('```');
      lines.push('');

      if (options.includeFix !== false && violation.fix) {
        lines.push('**Fix:**');
        lines.push('```typescript');
        lines.push(violation.fix.split('\n').slice(0, 10).join('\n'));
        lines.push('```');
        lines.push('');
      }
    }
  } else {
    lines.push('## ✅ No Violations');
    lines.push('');
    lines.push('All security checks passed.');
  }

  return lines.join('\n');
}

// ============================================================================
// Compact Format
// ============================================================================

function generateCompactReport(result: SecurityVerifyResult, options: ReportOptions): string {
  const useColor = options.colorize ?? true;
  const verdictIcon = getVerdictIcon(result.verdict);
  const verdictColor = getVerdictColor(result.verdict);

  const criticalCount = result.staticViolations.filter(v => v.severity === 'critical').length;
  const highCount = result.staticViolations.filter(v => v.severity === 'high').length;
  const mediumCount = result.staticViolations.filter(v => v.severity === 'medium').length;
  const lowCount = result.staticViolations.filter(v => v.severity === 'low').length;

  const status = colorize(`${verdictIcon} ${result.verdict.toUpperCase()}`, verdictColor, useColor);
  const score = colorize(`${result.score}/100`, result.score >= 80 ? 'green' : result.score >= 50 ? 'yellow' : 'red', useColor);
  const counts = `C:${criticalCount} H:${highCount} M:${mediumCount} L:${lowCount}`;

  return `Security: ${status} | Score: ${score} | ${counts}`;
}

// ============================================================================
// Helpers
// ============================================================================

function getVerdictIcon(verdict: string): string {
  switch (verdict) {
    case 'secure':
      return '✓';
    case 'risky':
      return '⚠';
    case 'insecure':
      return '✗';
    default:
      return '?';
  }
}

function getVerdictColor(verdict: string): keyof typeof colors {
  switch (verdict) {
    case 'secure':
      return 'green';
    case 'risky':
      return 'yellow';
    case 'insecure':
      return 'red';
    default:
      return 'white';
  }
}

function getSeverityColor(severity: string): keyof typeof colors {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'high':
      return 'yellow';
    case 'medium':
      return 'blue';
    case 'low':
      return 'dim';
    default:
      return 'white';
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🔵';
    default:
      return '⚪';
  }
}

// ============================================================================
// Invariant Clause Result (for integration with verification pipeline)
// ============================================================================

export interface InvariantClauseResult {
  clause: string;
  status: 'SATISFIED' | 'VIOLATED' | 'UNKNOWN';
  evidence: string[];
  violations: SecurityViolation[];
}

/**
 * Convert SecurityVerifyResult to invariant clause results for pipeline integration
 * 
 * This extracts security rules as invariant clauses for reporting.
 */
export function toInvariantClauseResults(result: SecurityVerifyResult): InvariantClauseResult[] {
  // Group violations by rule ID
  const ruleViolations = new Map<string, SecurityViolation[]>();
  
  for (const violation of result.staticViolations) {
    const existing = ruleViolations.get(violation.ruleId) || [];
    existing.push(violation);
    ruleViolations.set(violation.ruleId, existing);
  }

  // Define invariant clauses for each security rule
  const invariantClauses: { ruleId: string; clause: string }[] = [
    { ruleId: 'security/token-approved-source', clause: 'session tokens use approved cryptographic source' },
    { ruleId: 'security/token-min-length', clause: 'session tokens have minimum 256-bit entropy' },
    { ruleId: 'security/token-entropy-validation', clause: 'token generation validates entropy' },
    { ruleId: 'security/constant-time-compare', clause: 'password comparison is constant-time' },
    { ruleId: 'security/no-early-return-on-hash-mismatch', clause: 'hash comparison does not leak timing via early return' },
  ];

  return invariantClauses.map(({ ruleId, clause }) => {
    const violations = ruleViolations.get(ruleId) || [];
    const status = violations.length === 0 ? 'SATISFIED' : 'VIOLATED';
    const evidence = violations.map(v => `${v.file}:${v.line} - ${v.message}`);

    return {
      clause,
      status,
      evidence,
      violations,
    };
  });
}

/**
 * Format invariant clause result for display
 */
export function formatInvariantClause(clause: InvariantClauseResult, useColor = true): string {
  const icon = clause.status === 'SATISFIED' ? '✓' : clause.status === 'VIOLATED' ? '✗' : '?';
  const color = clause.status === 'SATISFIED' ? 'green' : clause.status === 'VIOLATED' ? 'red' : 'yellow';

  let output = `${colorize(icon, color, useColor)} Invariant: "${clause.clause}" - ${colorize(clause.status, color, useColor)}`;

  if (clause.evidence.length > 0) {
    output += '\n  Evidence:';
    for (const ev of clause.evidence.slice(0, 3)) {
      output += `\n    - ${ev}`;
    }
    if (clause.evidence.length > 3) {
      output += `\n    ... and ${clause.evidence.length - 3} more`;
    }
  }

  return output;
}
