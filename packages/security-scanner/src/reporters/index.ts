// ============================================================================
// Reporters Index
// ============================================================================

export * from './sarif';
export * from './json';
export * from './markdown';

import { ScanResult } from '../severity';
import { generateSarifString, SarifOptions } from './sarif';
import { generateJsonString, JsonReportOptions } from './json';
import { generateMarkdownReport, MarkdownOptions } from './markdown';

// ============================================================================
// Unified Reporter
// ============================================================================

export type OutputFormat = 'json' | 'sarif' | 'markdown' | 'text';

export interface ReportOptions {
  format?: OutputFormat;
  sarif?: SarifOptions;
  json?: JsonReportOptions;
  markdown?: MarkdownOptions;
}

/**
 * Generate report in specified format
 */
export function generateReport(
  scanResult: ScanResult,
  options: ReportOptions = {}
): string {
  const format = options.format || 'json';

  switch (format) {
    case 'sarif':
      return generateSarifString(scanResult, options.sarif);

    case 'json':
      return generateJsonString(scanResult, options.json);

    case 'markdown':
      return generateMarkdownReport(scanResult, options.markdown);

    case 'text':
      return generateTextReport(scanResult);

    default:
      return generateJsonString(scanResult, options.json);
  }
}

/**
 * Simple text report for console output
 */
function generateTextReport(scanResult: ScanResult): string {
  const { summary, findings } = scanResult;
  const lines: string[] = [];

  lines.push('═'.repeat(60));
  lines.push('  ISL Security Scanner Report');
  lines.push('═'.repeat(60));
  lines.push('');
  lines.push('SUMMARY');
  lines.push('─'.repeat(40));
  lines.push(`  Critical: ${summary.critical}`);
  lines.push(`  High:     ${summary.high}`);
  lines.push(`  Medium:   ${summary.medium}`);
  lines.push(`  Low:      ${summary.low}`);
  lines.push(`  Total:    ${summary.total}`);
  lines.push('');

  if (findings.length > 0) {
    lines.push('FINDINGS');
    lines.push('─'.repeat(40));

    // Group by severity
    const bySeverity = {
      critical: findings.filter((f) => f.severity === 'critical'),
      high: findings.filter((f) => f.severity === 'high'),
      medium: findings.filter((f) => f.severity === 'medium'),
      low: findings.filter((f) => f.severity === 'low'),
    };

    for (const [severity, severityFindings] of Object.entries(bySeverity)) {
      if (severityFindings.length === 0) continue;

      const icon =
        severity === 'critical' ? '🔴' :
        severity === 'high' ? '🟠' :
        severity === 'medium' ? '🟡' : '🟢';

      lines.push(`\n  ${icon} ${severity.toUpperCase()} (${severityFindings.length})`);

      for (const finding of severityFindings) {
        lines.push(`    [${finding.id}] ${finding.title}`);
        lines.push(`          ${finding.location.file}:${finding.location.startLine}`);
      }
    }
  } else {
    lines.push('✅ No security issues found!');
  }

  lines.push('');
  lines.push('═'.repeat(60));
  lines.push(`  Scanned at: ${scanResult.scannedAt.toISOString()}`);
  lines.push(`  Duration: ${scanResult.duration}ms`);
  lines.push('═'.repeat(60));

  return lines.join('\n');
}

/**
 * Get file extension for format
 */
export function getFormatExtension(format: OutputFormat): string {
  switch (format) {
    case 'sarif':
      return '.sarif.json';
    case 'json':
      return '.json';
    case 'markdown':
      return '.md';
    case 'text':
      return '.txt';
    default:
      return '.json';
  }
}

/**
 * Get MIME type for format
 */
export function getFormatMimeType(format: OutputFormat): string {
  switch (format) {
    case 'sarif':
    case 'json':
      return 'application/json';
    case 'markdown':
      return 'text/markdown';
    case 'text':
      return 'text/plain';
    default:
      return 'application/json';
  }
}
