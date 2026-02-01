/**
 * Report Formatter
 * 
 * Formats verification results for console output.
 */

import type { Verdict, CoverageMetrics } from './verifier.js';
import { getVerdictEmoji, getVerdictDescription } from './verifier.js';

// ============================================================================
// Types
// ============================================================================

export interface Diagnostic {
  /** Error/warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Source file path */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** End line number */
  endLine?: number;
  /** End column number */
  endColumn?: number;
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Additional context */
  context?: string;
}

export interface ActionReport {
  /** Verification verdict */
  verdict: Verdict;
  /** Verification score (0-100) */
  score: number;
  /** All errors found */
  errors: Diagnostic[];
  /** All warnings found */
  warnings: Diagnostic[];
  /** Number of spec files checked */
  specsChecked: number;
  /** Coverage metrics */
  coverage: CoverageMetrics;
  /** Total duration in ms */
  duration: number;
}

// ============================================================================
// Report Formatter
// ============================================================================

/**
 * Format the action report for console output
 */
export function formatReport(report: ActionReport): string {
  const lines: string[] = [];

  // Header
  lines.push('═'.repeat(60));
  lines.push('  ISL Verification Report');
  lines.push('═'.repeat(60));
  lines.push('');

  // Summary
  lines.push(`  Verdict:    ${getVerdictEmoji(report.verdict)} ${report.verdict.toUpperCase()}`);
  lines.push(`  Score:      ${report.score}/100`);
  lines.push(`  Duration:   ${formatDuration(report.duration)}`);
  lines.push('');

  // Stats
  lines.push('  Statistics:');
  lines.push(`    Specs Checked: ${report.specsChecked}`);
  lines.push(`    Errors:        ${report.errors.length}`);
  lines.push(`    Warnings:      ${report.warnings.length}`);
  lines.push('');

  // Coverage
  if (report.coverage.preconditions > 0 || report.coverage.postconditions > 0) {
    lines.push('  Coverage:');
    lines.push(`    Preconditions:  ${formatPercentage(report.coverage.preconditions)}`);
    lines.push(`    Postconditions: ${formatPercentage(report.coverage.postconditions)}`);
    lines.push(`    Invariants:     ${formatPercentage(report.coverage.invariants)}`);
    lines.push(`    Temporal:       ${formatPercentage(report.coverage.temporal)}`);
    lines.push('');
  }

  // Errors
  if (report.errors.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('  Errors:');
    lines.push('');
    
    for (const error of report.errors.slice(0, 10)) {
      lines.push(formatDiagnostic(error));
    }
    
    if (report.errors.length > 10) {
      lines.push(`  ... and ${report.errors.length - 10} more errors`);
    }
    lines.push('');
  }

  // Warnings
  if (report.warnings.length > 0) {
    lines.push('─'.repeat(60));
    lines.push('  Warnings:');
    lines.push('');
    
    for (const warning of report.warnings.slice(0, 5)) {
      lines.push(formatDiagnostic(warning));
    }
    
    if (report.warnings.length > 5) {
      lines.push(`  ... and ${report.warnings.length - 5} more warnings`);
    }
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

/**
 * Format a single diagnostic for console output
 */
export function formatDiagnostic(diag: Diagnostic): string {
  const location = `${diag.file}:${diag.line}:${diag.column}`;
  const prefix = diag.severity === 'error' ? '❌' : diag.severity === 'warning' ? '⚠️' : 'ℹ️';
  
  let message = `  ${prefix} [${diag.code}] ${location}`;
  message += `\n     ${diag.message}`;
  
  if (diag.context) {
    message += `\n     Context: ${diag.context}`;
  }
  
  return message;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format percentage with bar
 */
export function formatPercentage(value: number): string {
  const percent = Math.round(value);
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${bar} ${percent}%`;
}

/**
 * Format report as JSON
 */
export function formatReportJson(report: ActionReport): string {
  return JSON.stringify({
    verdict: report.verdict,
    score: report.score,
    specsChecked: report.specsChecked,
    errors: report.errors.length,
    warnings: report.warnings.length,
    coverage: report.coverage,
    duration: report.duration,
    diagnostics: {
      errors: report.errors,
      warnings: report.warnings,
    },
  }, null, 2);
}

/**
 * Get color for verdict (for GitHub annotations)
 */
export function getVerdictColor(verdict: Verdict): 'success' | 'warning' | 'failure' {
  switch (verdict) {
    case 'verified':
    case 'checked':
      return 'success';
    case 'risky':
      return 'warning';
    default:
      return 'failure';
  }
}
