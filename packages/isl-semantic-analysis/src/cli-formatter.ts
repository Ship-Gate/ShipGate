/**
 * CLI Output Formatter
 * 
 * Formats semantic analysis diagnostics for CLI output with:
 * - Source spans with code snippets
 * - Suggested fixes with diff-style output
 * - Color support (with fallback for CI)
 * - Machine-readable JSON output mode
 */

import type { Diagnostic, CodeFix, SourceLocation } from '@isl-lang/errors';
import type { AnalysisResult, PassResult } from './types.js';

// ============================================================================
// Output Formats
// ============================================================================

export type OutputFormat = 'pretty' | 'json' | 'compact' | 'github';

export interface FormatterOptions {
  /** Output format */
  format: OutputFormat;
  /** Enable ANSI colors */
  colors: boolean;
  /** Number of context lines around errors */
  contextLines: number;
  /** Show suggested fixes */
  showFixes: boolean;
  /** Show pass timing information */
  showTiming: boolean;
  /** Maximum errors to display */
  maxErrors: number;
  /** Source file contents (path -> content) */
  sources: Map<string, string>;
}

const DEFAULT_OPTIONS: FormatterOptions = {
  format: 'pretty',
  colors: true,
  contextLines: 2,
  showFixes: true,
  showTiming: false,
  maxErrors: 20,
  sources: new Map(),
};

// ============================================================================
// Color Support
// ============================================================================

interface ColorFunctions {
  red: (s: string) => string;
  yellow: (s: string) => string;
  blue: (s: string) => string;
  cyan: (s: string) => string;
  green: (s: string) => string;
  magenta: (s: string) => string;
  gray: (s: string) => string;
  bold: (s: string) => string;
  dim: (s: string) => string;
  underline: (s: string) => string;
}

function createColors(enabled: boolean): ColorFunctions {
  if (!enabled) {
    const identity = (s: string) => s;
    return {
      red: identity,
      yellow: identity,
      blue: identity,
      cyan: identity,
      green: identity,
      magenta: identity,
      gray: identity,
      bold: identity,
      dim: identity,
      underline: identity,
    };
  }

  return {
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    blue: (s) => `\x1b[34m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    magenta: (s) => `\x1b[35m${s}\x1b[0m`,
    gray: (s) => `\x1b[90m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    underline: (s) => `\x1b[4m${s}\x1b[0m`,
  };
}

// ============================================================================
// Main Formatter
// ============================================================================

export class CLIFormatter {
  private options: FormatterOptions;
  private colors: ColorFunctions;

  constructor(options: Partial<FormatterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.colors = createColors(this.options.colors);
  }

  /**
   * Format the complete analysis result
   */
  format(result: AnalysisResult): string {
    switch (this.options.format) {
      case 'json':
        return this.formatJSON(result);
      case 'compact':
        return this.formatCompact(result);
      case 'github':
        return this.formatGitHub(result);
      case 'pretty':
      default:
        return this.formatPretty(result);
    }
  }

  /**
   * Format a single diagnostic
   */
  formatDiagnostic(diagnostic: Diagnostic): string {
    switch (this.options.format) {
      case 'json':
        return JSON.stringify(this.diagnosticToJSON(diagnostic));
      case 'compact':
        return this.formatCompactDiagnostic(diagnostic);
      case 'github':
        return this.formatGitHubDiagnostic(diagnostic);
      case 'pretty':
      default:
        return this.formatPrettyDiagnostic(diagnostic);
    }
  }

  // ============================================================================
  // Pretty Format (Elm/Rust style)
  // ============================================================================

  private formatPretty(result: AnalysisResult): string {
    const lines: string[] = [];
    const { diagnostics, stats, cacheInfo } = result;

    // Display diagnostics
    const displayCount = Math.min(diagnostics.length, this.options.maxErrors);
    for (let i = 0; i < displayCount; i++) {
      const diagnostic = diagnostics[i];
      if (!diagnostic) continue;
      if (i > 0) lines.push('');
      lines.push(this.formatPrettyDiagnostic(diagnostic));
    }

    // Truncation notice
    if (diagnostics.length > this.options.maxErrors) {
      lines.push('');
      lines.push(this.colors.gray(
        `... and ${diagnostics.length - this.options.maxErrors} more diagnostics`
      ));
    }

    // Summary
    lines.push('');
    lines.push(this.formatSummary(stats));

    // Timing info
    if (this.options.showTiming) {
      lines.push('');
      lines.push(this.formatTiming(result.passResults, cacheInfo));
    }

    return lines.join('\n');
  }

  private formatPrettyDiagnostic(d: Diagnostic): string {
    const c = this.colors;
    const lines: string[] = [];

    // Header: severity[code]: message
    const severityColor = this.getSeverityColor(d.severity);
    const header = `${severityColor(d.severity)}[${c.bold(d.code)}]: ${d.message}`;
    lines.push(header);

    // Location: --> file:line:column
    const loc = d.location;
    lines.push(`  ${c.blue('-->')} ${c.cyan(loc.file)}:${loc.line}:${loc.column}`);

    // Code snippet
    const snippet = this.getCodeSnippet(loc);
    if (snippet) {
      lines.push(snippet);
    }

    // Notes
    if (d.notes?.length) {
      for (const note of d.notes) {
        lines.push(`  ${c.blue('=')} ${c.bold('note')}: ${note}`);
      }
    }

    // Help
    if (d.help?.length) {
      for (const help of d.help) {
        lines.push(`  ${c.blue('=')} ${c.green('help')}: ${help}`);
      }
    }

    // Fix suggestion
    if (this.options.showFixes && d.fix) {
      lines.push('');
      lines.push(this.formatFix(d.fix, loc));
    }

    // Related information
    if (d.relatedInformation?.length) {
      for (const related of d.relatedInformation) {
        lines.push('');
        lines.push(`  ${c.blue('-->')} ${c.cyan(related.location?.file || 'unknown')}:${related.location?.line || 1}:${related.location?.column || 1}`);
        lines.push(`  ${c.dim('|')} ${c.gray(related.message)}`);
      }
    }

    return lines.join('\n');
  }

  private getCodeSnippet(loc: SourceLocation): string | undefined {
    const source = this.options.sources.get(loc.file);
    if (!source) return undefined;

    const c = this.colors;
    const lines = source.split('\n');
    const startLine = Math.max(1, loc.line - this.options.contextLines);
    const endLine = Math.min(lines.length, loc.endLine + this.options.contextLines);
    const gutterWidth = String(endLine).length + 1;

    const output: string[] = [];
    output.push(`  ${c.blue(' '.repeat(gutterWidth) + '|')}`);

    for (let i = startLine; i <= endLine; i++) {
      const lineContent = lines[i - 1] || '';
      const lineNum = String(i).padStart(gutterWidth - 1, ' ');
      const isErrorLine = i >= loc.line && i <= loc.endLine;

      // Line number and content
      const prefix = isErrorLine ? c.red(lineNum) : c.blue(lineNum);
      output.push(`  ${prefix} ${c.blue('|')} ${lineContent}`);

      // Underline for error lines
      if (isErrorLine) {
        const underline = this.createUnderline(
          lineContent,
          i === loc.line ? loc.column : 1,
          i === loc.endLine ? loc.endColumn : lineContent.length + 1
        );
        output.push(`  ${' '.repeat(gutterWidth)}${c.blue('|')} ${c.red(underline)}`);
      }
    }

    output.push(`  ${c.blue(' '.repeat(gutterWidth) + '|')}`);
    return output.join('\n');
  }

  private createUnderline(_line: string, startCol: number, endCol: number): string {
    const leadingSpaces = ' '.repeat(Math.max(0, startCol - 1));
    const underlineLength = Math.max(1, endCol - startCol);
    const underline = '^'.repeat(underlineLength);
    return leadingSpaces + underline;
  }

  private formatFix(fix: CodeFix, loc: SourceLocation): string {
    const c = this.colors;
    const lines: string[] = [];

    lines.push(`  ${c.green('=')} ${c.bold('suggested fix')}: ${fix.title}`);

    for (const edit of fix.edits) {
      const range = edit.range;
      lines.push(`  ${c.dim('|')} at ${loc.file}:${range.start.line}:${range.start.column}`);
      
      if (edit.newText) {
        // Show the replacement
        const addedLines = edit.newText.split('\n');
        for (const addedLine of addedLines) {
          lines.push(`  ${c.green('+')} ${addedLine}`);
        }
      }
    }

    if (fix.isPreferred) {
      lines.push(`  ${c.dim('|')} ${c.cyan('(preferred fix)')}`);
    }

    return lines.join('\n');
  }

  private formatSummary(stats: AnalysisResult['stats']): string {
    const c = this.colors;
    const parts: string[] = [];

    if (stats.errorCount > 0) {
      parts.push(c.red(`${stats.errorCount} error${stats.errorCount !== 1 ? 's' : ''}`));
    }
    if (stats.warningCount > 0) {
      parts.push(c.yellow(`${stats.warningCount} warning${stats.warningCount !== 1 ? 's' : ''}`));
    }
    if (stats.hintCount > 0) {
      parts.push(c.blue(`${stats.hintCount} hint${stats.hintCount !== 1 ? 's' : ''}`));
    }

    if (parts.length === 0) {
      return c.green('✓ No issues found');
    }

    return `Found ${parts.join(', ')}`;
  }

  private formatTiming(passResults: PassResult[], cacheInfo: AnalysisResult['cacheInfo']): string {
    const c = this.colors;
    const lines: string[] = [];

    lines.push(c.dim('─'.repeat(40)));
    lines.push(c.bold('Pass Timing:'));

    for (const result of passResults) {
      const status = result.succeeded ? c.green('✓') : c.red('✗');
      const time = `${result.durationMs}ms`.padStart(6);
      lines.push(`  ${status} ${result.passName} ${c.dim(time)}`);
    }

    if (cacheInfo.enabled) {
      lines.push('');
      lines.push(`  Cache: ${c.green(String(cacheInfo.hits))} hits, ${c.yellow(String(cacheInfo.misses))} misses`);
    }

    return lines.join('\n');
  }

  private getSeverityColor(severity: Diagnostic['severity']): (s: string) => string {
    switch (severity) {
      case 'error': return this.colors.red;
      case 'warning': return this.colors.yellow;
      case 'info': return this.colors.blue;
      case 'hint': return this.colors.cyan;
      default: return this.colors.gray;
    }
  }

  // ============================================================================
  // JSON Format
  // ============================================================================

  private formatJSON(result: AnalysisResult): string {
    return JSON.stringify({
      success: result.allPassed,
      diagnostics: result.diagnostics.map(d => this.diagnosticToJSON(d)),
      stats: result.stats,
      cacheInfo: result.cacheInfo,
      passResults: result.passResults.map(r => ({
        passId: r.passId,
        passName: r.passName,
        succeeded: r.succeeded,
        durationMs: r.durationMs,
        diagnosticCount: r.diagnostics.length,
        error: r.error,
      })),
    }, null, 2);
  }

  private diagnosticToJSON(d: Diagnostic): object {
    return {
      code: d.code,
      category: d.category,
      severity: d.severity,
      message: d.message,
      location: d.location ? {
        file: d.location.file,
        line: d.location.line,
        column: d.location.column,
        endLine: d.location.endLine,
        endColumn: d.location.endColumn,
      } : { file: 'unknown', line: 1, column: 1 },
      source: d.source,
      notes: d.notes,
      help: d.help,
      fix: d.fix ? {
        title: d.fix.title,
        isPreferred: d.fix.isPreferred,
        edits: d.fix.edits.map(e => ({
          range: e.range,
          newText: e.newText,
        })),
      } : undefined,
      relatedInformation: d.relatedInformation?.map(r => ({
        message: r.message,
        location: r.location,
      })),
    };
  }

  // ============================================================================
  // Compact Format (single line per diagnostic)
  // ============================================================================

  private formatCompact(result: AnalysisResult): string {
    const lines = result.diagnostics
      .slice(0, this.options.maxErrors)
      .map(d => this.formatCompactDiagnostic(d));

    // Summary
    const { stats } = result;
    lines.push('');
    lines.push(`${stats.errorCount} errors, ${stats.warningCount} warnings`);

    return lines.join('\n');
  }

  private formatCompactDiagnostic(d: Diagnostic): string {
    const { file, line, column } = d.location;
    const severity = d.severity.charAt(0).toUpperCase();
    return `${file}:${line}:${column}: ${severity}[${d.code}] ${d.message}`;
  }

  // ============================================================================
  // GitHub Actions Format
  // ============================================================================

  private formatGitHub(result: AnalysisResult): string {
    return result.diagnostics
      .slice(0, this.options.maxErrors)
      .map(d => this.formatGitHubDiagnostic(d))
      .join('\n');
  }

  private formatGitHubDiagnostic(d: Diagnostic): string {
    const { file, line, column, endLine, endColumn } = d.location;
    const type = d.severity === 'error' ? 'error' : 
                 d.severity === 'warning' ? 'warning' : 'notice';
    
    // GitHub Actions workflow command format
    return `::${type} file=${file},line=${line},col=${column},endLine=${endLine},endColumn=${endColumn},title=${d.code}::${d.message}`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CLI formatter with the given options
 */
export function createFormatter(options?: Partial<FormatterOptions>): CLIFormatter {
  return new CLIFormatter(options);
}

/**
 * Format analysis result with default options
 */
export function formatResult(
  result: AnalysisResult,
  options?: Partial<FormatterOptions>
): string {
  return new CLIFormatter(options).format(result);
}

/**
 * Format a single diagnostic
 */
export function formatSingleDiagnostic(
  diagnostic: Diagnostic,
  options?: Partial<FormatterOptions>
): string {
  return new CLIFormatter(options).formatDiagnostic(diagnostic);
}
