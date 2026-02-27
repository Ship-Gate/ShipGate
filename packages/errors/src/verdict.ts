// ============================================================================
// ISL Gate Verdict Formatter
// ============================================================================
//
// Beautiful formatting for ISL Gate SHIP/NO_SHIP verdicts.
// Produces actionable, scannable output that tells developers exactly
// what went wrong and how to fix it.
//
// ============================================================================

import chalk from 'chalk';
import type { SourceFile } from './types.js';
import { getSource } from './formatter.js';

// ============================================================================
// VERDICT TYPES
// ============================================================================

/**
 * Gate verdict: the binary SHIP or NO_SHIP decision
 */
export type Verdict = 'SHIP' | 'NO_SHIP';

/**
 * Severity of a verdict violation
 */
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * A single violation found during verification
 */
export interface VerdictViolation {
  /** File where the violation occurred */
  file: string;
  /** Line number in the ISL spec */
  specLine?: number;
  /** The ISL rule text that was violated */
  rule: string;
  /** Human-readable violation description */
  message: string;
  /** Severity level */
  severity: ViolationSeverity;
  /** Detailed explanation of why this matters */
  explanation?: string;
  /** Concrete code fix suggestion */
  fix?: string;
  /** Does this violation block shipping? */
  blocking: boolean;
}

/**
 * Complete gate verdict result
 */
export interface VerdictResult {
  /** Binary verdict */
  verdict: Verdict;
  /** Overall score (0-100) */
  score: number;
  /** Human-readable summary */
  summary: string;
  /** All violations found */
  violations: VerdictViolation[];
  /** Duration of verification in milliseconds */
  durationMs?: number;
  /** Files that were verified */
  filesChecked?: string[];
}

/**
 * Options for verdict formatting
 */
export interface VerdictFormatOptions {
  /** Enable ANSI colors (default: true) */
  colors: boolean;
  /** Show detailed explanations (default: true) */
  showExplanations: boolean;
  /** Show fix suggestions (default: true) */
  showFixes: boolean;
  /** Maximum violations to show (default: 10) */
  maxViolations: number;
  /** Show ISL spec source context (default: true) */
  showSpecContext: boolean;
  /** Terminal width for line drawing (default: 60) */
  terminalWidth: number;
}

const DEFAULT_VERDICT_OPTIONS: VerdictFormatOptions = {
  colors: true,
  showExplanations: true,
  showFixes: true,
  maxViolations: 10,
  showSpecContext: true,
  terminalWidth: 60,
};

// ============================================================================
// COLOR SCHEMES
// ============================================================================

interface VerdictColors {
  ship: typeof chalk.green;
  noShip: typeof chalk.red;
  critical: typeof chalk.red;
  high: typeof chalk.red;
  medium: typeof chalk.yellow;
  low: typeof chalk.cyan;
  info: typeof chalk.blue;
  header: typeof chalk.bold;
  muted: typeof chalk.gray;
  accent: typeof chalk.cyan;
  rule: typeof chalk.white;
  lineNumber: typeof chalk.blue;
  separator: typeof chalk.blue;
}

const VERDICT_COLORS: VerdictColors = {
  ship: chalk.green.bold,
  noShip: chalk.red.bold,
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.cyan,
  info: chalk.blue,
  header: chalk.bold,
  muted: chalk.gray,
  accent: chalk.cyan,
  rule: chalk.white,
  lineNumber: chalk.blue,
  separator: chalk.blue,
};

const NO_VERDICT_COLORS: VerdictColors = {
  ship: chalk.reset,
  noShip: chalk.reset,
  critical: chalk.reset,
  high: chalk.reset,
  medium: chalk.reset,
  low: chalk.reset,
  info: chalk.reset,
  header: chalk.reset,
  muted: chalk.reset,
  accent: chalk.reset,
  rule: chalk.reset,
  lineNumber: chalk.reset,
  separator: chalk.reset,
};

// ============================================================================
// VERDICT FORMATTING
// ============================================================================

/**
 * Format a complete gate verdict result into a beautiful string.
 *
 * Example output:
 * ```
 * ─── ISL Verify ─────────────────────────────────────────
 *
 *   ✗ FAIL  src/auth/login.ts
 *
 *   ─── login.isl:22 ───
 *   │
 *   22 │   must "return identical error for wrong email or password"
 *   │   ────────────────────────────────────────────────────────
 *   │
 *   Violation: Error messages differ based on failure reason
 *
 *   Why this matters:
 *     Different error messages let attackers enumerate valid
 *     email addresses (user existence oracle).
 *
 *   Fix:
 *     Return the same 401 status and message for both cases:
 *     return res.status(401).json({ error: "Invalid credentials" })
 *
 * ─────────────────────────────────────────────────────────
 *   Score: 45/100    Verdict: NO_SHIP
 *   1 critical, 0 high, 0 medium violations
 * ─────────────────────────────────────────────────────────
 * ```
 */
export function formatVerdict(
  result: VerdictResult,
  options: Partial<VerdictFormatOptions> = {}
): string {
  const opts: VerdictFormatOptions = { ...DEFAULT_VERDICT_OPTIONS, ...options };
  const c = opts.colors ? VERDICT_COLORS : NO_VERDICT_COLORS;
  const lines: string[] = [];
  const divider = c.muted('\u2500'.repeat(opts.terminalWidth));

  // Header
  lines.push(c.muted('\u2500\u2500\u2500 ') + c.header('ISL Verify') + ' ' + c.muted('\u2500'.repeat(Math.max(0, opts.terminalWidth - 16))));
  lines.push('');

  // Verdict icon and files
  if (result.verdict === 'SHIP') {
    lines.push('  ' + c.ship('\u2713 PASS') + (result.summary ? '  ' + result.summary : ''));
  } else {
    // Group violations by file
    const fileViolations = groupViolationsByFile(result.violations);
    for (const [file, violations] of fileViolations) {
      lines.push('  ' + c.noShip('\u2717 FAIL') + '  ' + c.muted(file));
      lines.push('');

      const toShow = violations.slice(0, opts.maxViolations);
      for (const violation of toShow) {
        lines.push(...formatViolation(violation, c, opts));
        lines.push('');
      }

      if (violations.length > opts.maxViolations) {
        const remaining = violations.length - opts.maxViolations;
        lines.push('  ' + c.muted(`... and ${remaining} more violation${remaining === 1 ? '' : 's'} in this file`));
        lines.push('');
      }
    }
  }

  // Footer with score and verdict
  lines.push(divider);
  const scoreStr = formatScore(result.score, c);
  const verdictStr = result.verdict === 'SHIP'
    ? c.ship('SHIP')
    : c.noShip('NO_SHIP');
  lines.push(`  Score: ${scoreStr}    Verdict: ${verdictStr}`);

  // Violation summary
  const summary = formatViolationSummary(result.violations, c);
  if (summary) {
    lines.push('  ' + summary);
  }

  // Duration
  if (result.durationMs !== undefined) {
    lines.push('  ' + c.muted(`Completed in ${formatDuration(result.durationMs)}`));
  }

  lines.push(divider);

  return lines.join('\n');
}

/**
 * Format a single verdict violation.
 */
function formatViolation(
  violation: VerdictViolation,
  c: VerdictColors,
  opts: VerdictFormatOptions
): string[] {
  const lines: string[] = [];
  const severityColor = getSeverityColor(violation.severity, c);

  // Spec source context
  if (opts.showSpecContext && violation.specLine !== undefined) {
    const specFile = getSource(violation.file);
    if (specFile) {
      lines.push(...formatSpecSnippet(specFile, violation.specLine, violation.rule, c));
    } else {
      // No source registered, show location reference
      lines.push('  ' + c.muted(`\u2500\u2500\u2500 ${violation.file}:${violation.specLine} \u2500\u2500\u2500`));
      lines.push('  ' + c.separator('\u2502'));
      const gutterWidth = String(violation.specLine).length;
      lines.push(
        '  ' +
        c.lineNumber(String(violation.specLine).padStart(gutterWidth)) +
        ' ' + c.separator('\u2502') + '   ' +
        c.rule(violation.rule)
      );
      lines.push('  ' + c.separator('\u2502'));
    }
  }

  // Violation message
  lines.push('  ' + severityColor('Violation: ') + violation.message);

  // Explanation
  if (opts.showExplanations && violation.explanation) {
    lines.push('');
    lines.push('  ' + c.accent('Why this matters:'));
    for (const expLine of wrapText(violation.explanation, opts.terminalWidth - 6)) {
      lines.push('    ' + expLine);
    }
  }

  // Fix suggestion
  if (opts.showFixes && violation.fix) {
    lines.push('');
    lines.push('  ' + c.accent('Fix:'));
    for (const fixLine of violation.fix.split('\n')) {
      lines.push('    ' + fixLine);
    }
  }

  return lines;
}

/**
 * Format a spec file snippet showing the violated rule.
 */
function formatSpecSnippet(
  source: SourceFile,
  line: number,
  rule: string,
  c: VerdictColors
): string[] {
  const lines: string[] = [];
  const gutterWidth = String(line).length;

  lines.push('  ' + c.muted(`\u2500\u2500\u2500 ${source.path}:${line} \u2500\u2500\u2500`));
  lines.push('  ' + ' '.repeat(gutterWidth + 1) + c.separator('\u2502'));

  // Show the spec line
  const specLine = source.lines[line - 1];
  if (specLine !== undefined) {
    lines.push(
      '  ' +
      c.lineNumber(String(line).padStart(gutterWidth)) +
      ' ' + c.separator('\u2502') +
      '   ' + c.rule(specLine)
    );

    // Underline the rule text
    const ruleStart = specLine.indexOf(rule);
    if (ruleStart >= 0) {
      const padding = ' '.repeat(ruleStart + 3);
      const underline = '\u2500'.repeat(rule.length);
      lines.push(
        '  ' +
        ' '.repeat(gutterWidth + 1) +
        c.separator('\u2502') +
        padding + c.noShip(underline)
      );
    } else {
      // Underline the full content
      const contentStart = specLine.length - specLine.trimStart().length;
      const underline = '\u2500'.repeat(specLine.trimEnd().length - contentStart);
      lines.push(
        '  ' +
        ' '.repeat(gutterWidth + 1) +
        c.separator('\u2502') +
        '   ' + ' '.repeat(contentStart) + c.noShip(underline)
      );
    }
  }

  lines.push('  ' + ' '.repeat(gutterWidth + 1) + c.separator('\u2502'));

  return lines;
}

// ============================================================================
// HELPERS
// ============================================================================

function groupViolationsByFile(violations: VerdictViolation[]): Map<string, VerdictViolation[]> {
  const map = new Map<string, VerdictViolation[]>();
  for (const v of violations) {
    const existing = map.get(v.file) ?? [];
    existing.push(v);
    map.set(v.file, existing);
  }
  return map;
}

function formatScore(score: number, c: VerdictColors): string {
  const colorFn = score >= 95 ? c.ship
    : score >= 70 ? c.medium
    : c.noShip;
  return colorFn(`${score}/100`);
}

function formatViolationSummary(violations: VerdictViolation[], c: VerdictColors): string {
  const critical = violations.filter(v => v.severity === 'critical').length;
  const high = violations.filter(v => v.severity === 'high').length;
  const medium = violations.filter(v => v.severity === 'medium').length;
  const low = violations.filter(v => v.severity === 'low').length;

  const parts: string[] = [];
  if (critical > 0) parts.push(c.critical(`${critical} critical`));
  if (high > 0) parts.push(c.high(`${high} high`));
  if (medium > 0) parts.push(c.medium(`${medium} medium`));
  if (low > 0) parts.push(c.low(`${low} low`));

  if (parts.length === 0) return '';
  return parts.join(', ') + ' violation' + (violations.length === 1 ? '' : 's');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function getSeverityColor(severity: ViolationSeverity, c: VerdictColors): typeof chalk.red {
  switch (severity) {
    case 'critical': return c.critical;
    case 'high': return c.high;
    case 'medium': return c.medium;
    case 'low': return c.low;
    case 'info': return c.info;
  }
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

// ============================================================================
// SINGLE VERDICT VIOLATION FORMATTER
// ============================================================================

/**
 * Format a single violation as a standalone message.
 * Useful for streaming output or individual violation reports.
 */
export function formatViolationMessage(
  violation: VerdictViolation,
  options: Partial<VerdictFormatOptions> = {}
): string {
  const opts: VerdictFormatOptions = { ...DEFAULT_VERDICT_OPTIONS, ...options };
  const c = opts.colors ? VERDICT_COLORS : NO_VERDICT_COLORS;

  return formatViolation(violation, c, opts).join('\n');
}

// ============================================================================
// VERDICT SUMMARY (compact, for CI output)
// ============================================================================

/**
 * Format a compact verdict summary for CI environments.
 *
 * Example:
 * ```
 * ISL Gate: NO_SHIP (score: 45/100) - 1 critical, 2 high violations
 * ```
 */
export function formatVerdictCompact(
  result: VerdictResult,
  options: { colors?: boolean } = {}
): string {
  const useColors = options.colors ?? true;
  const c = useColors ? VERDICT_COLORS : NO_VERDICT_COLORS;

  const verdictStr = result.verdict === 'SHIP'
    ? c.ship('SHIP')
    : c.noShip('NO_SHIP');
  const scoreStr = formatScore(result.score, c);
  const summary = formatViolationSummary(result.violations, c);

  let line = `ISL Gate: ${verdictStr} (score: ${scoreStr})`;
  if (summary) {
    line += ' - ' + summary;
  }

  return line;
}
