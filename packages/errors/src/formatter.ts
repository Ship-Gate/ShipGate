// ============================================================================
// ISL Error Formatter
// ============================================================================
//
// Beautiful, human-friendly error formatting inspired by Elm, Rust, and Deno.
// Features:
//   - Code snippets with context lines
//   - Colored underlines pointing to the error
//   - Notes and help suggestions
//   - Support for related information
//   - Works with and without colors (CI-friendly)
//
// ============================================================================

import chalk from 'chalk';
import type {
  Diagnostic,
  DiagnosticSeverity,
  FormatOptions,
  RelatedInformation,
  SourceFile,
  SourceLocation,
  DEFAULT_FORMAT_OPTIONS,
} from './types.js';
import { getErrorDef } from './codes.js';
import { getExplanation } from './catalog.js';

// Re-export for convenience
export { DEFAULT_FORMAT_OPTIONS };

// ============================================================================
// COLOR CONFIGURATION
// ============================================================================

interface ColorScheme {
  error: chalk.Chalk;
  warning: chalk.Chalk;
  info: chalk.Chalk;
  hint: chalk.Chalk;
  note: chalk.Chalk;
  help: chalk.Chalk;
  lineNumber: chalk.Chalk;
  separator: chalk.Chalk;
  code: chalk.Chalk;
  highlight: chalk.Chalk;
  path: chalk.Chalk;
  muted: chalk.Chalk;
}

const COLORS: ColorScheme = {
  error: chalk.red.bold,
  warning: chalk.yellow.bold,
  info: chalk.blue.bold,
  hint: chalk.cyan.bold,
  note: chalk.cyan,
  help: chalk.cyan,
  lineNumber: chalk.blue,
  separator: chalk.blue,
  code: chalk.white,
  highlight: chalk.red,
  path: chalk.cyan,
  muted: chalk.gray,
};

const NO_COLORS: ColorScheme = {
  error: chalk.reset,
  warning: chalk.reset,
  info: chalk.reset,
  hint: chalk.reset,
  note: chalk.reset,
  help: chalk.reset,
  lineNumber: chalk.reset,
  separator: chalk.reset,
  code: chalk.reset,
  highlight: chalk.reset,
  path: chalk.reset,
  muted: chalk.reset,
};

// ============================================================================
// SEVERITY LABELS
// ============================================================================

const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  hint: 'hint',
};

function getSeverityColor(severity: DiagnosticSeverity, colors: ColorScheme): chalk.Chalk {
  return colors[severity];
}

// ============================================================================
// SOURCE FILE CACHE
// ============================================================================

const sourceCache = new Map<string, SourceFile>();

/**
 * Register source file content for error formatting.
 * This must be called before formatting errors to show code snippets.
 */
export function registerSource(path: string, content: string): void {
  sourceCache.set(path, {
    path,
    content,
    lines: content.split('\n'),
  });
}

/**
 * Clear the source cache
 */
export function clearSourceCache(): void {
  sourceCache.clear();
}

/**
 * Get a source file from cache
 */
export function getSource(path: string): SourceFile | undefined {
  return sourceCache.get(path);
}

// ============================================================================
// DIAGNOSTIC FORMATTING
// ============================================================================

/**
 * Format a single diagnostic into a beautiful string.
 * 
 * Example output:
 * ```
 * error[E0200]: Type mismatch
 *   --> specs/payment.isl:7:9
 *    |
 *  7 |   post: sender.balance == old(sender.balance) - amount
 *    |         ^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^
 *    |         String             Number
 *    |
 *    = note: sender.balance is typed as String but compared with Number
 *    = help: Did you mean to use sender.balanceAmount? (Number field)
 * ```
 */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  options: Partial<FormatOptions> = {}
): string {
  const opts: FormatOptions = {
    colors: true,
    contextLines: 2,
    showCodes: true,
    showHelp: true,
    maxErrors: 10,
    showRelated: true,
    terminalWidth: 80,
    ...options,
  };

  const colors = opts.colors ? COLORS : NO_COLORS;
  const lines: string[] = [];

  // Header line: error[E0200]: Type mismatch
  const header = formatHeader(diagnostic, colors, opts.showCodes);
  lines.push(header);

  // Location line: --> specs/payment.isl:7:9
  const locationLine = formatLocation(diagnostic.location, colors);
  lines.push(locationLine);

  // Code snippet with underlines
  const source = getSource(diagnostic.location.file);
  if (source) {
    const snippet = formatCodeSnippet(
      source,
      diagnostic.location,
      colors,
      opts.contextLines
    );
    lines.push(...snippet);
  }

  // Notes
  if (opts.showHelp && diagnostic.notes && diagnostic.notes.length > 0) {
    for (const note of diagnostic.notes) {
      lines.push(formatAnnotation('note', note, colors));
    }
  }

  // Help suggestions
  if (opts.showHelp && diagnostic.help && diagnostic.help.length > 0) {
    for (const help of diagnostic.help) {
      lines.push(formatAnnotation('help', help, colors));
    }
  }

  // Related information
  if (opts.showRelated && diagnostic.relatedInformation) {
    for (const related of diagnostic.relatedInformation) {
      lines.push('');
      lines.push(formatRelated(related, colors, opts.contextLines));
    }
  }

  return lines.join('\n');
}

/**
 * Format header line: error[E0200]: Type mismatch
 */
function formatHeader(
  diagnostic: Diagnostic,
  colors: ColorScheme,
  showCode: boolean
): string {
  const severityColor = getSeverityColor(diagnostic.severity, colors);
  const label = SEVERITY_LABELS[diagnostic.severity];
  
  let header = severityColor(label);
  if (showCode) {
    header += severityColor(`[${diagnostic.code}]`);
  }
  header += severityColor(': ');
  
  // Get title from error definition or use message
  const errorDef = getErrorDef(diagnostic.code);
  const title = errorDef?.title || diagnostic.message.split('\n')[0];
  header += severityColor(title!);

  return header;
}

/**
 * Format location line: --> specs/payment.isl:7:9
 */
function formatLocation(location: SourceLocation, colors: ColorScheme): string {
  const path = colors.path(location.file);
  const pos = `${location.line}:${location.column}`;
  return `  ${colors.separator('-->')} ${path}:${pos}`;
}

/**
 * Format code snippet with context and underlines
 */
function formatCodeSnippet(
  source: SourceFile,
  location: SourceLocation,
  colors: ColorScheme,
  contextLines: number
): string[] {
  const lines: string[] = [];
  
  // Calculate line range
  const startLine = Math.max(1, location.line - contextLines);
  const endLine = Math.min(source.lines.length, location.endLine + contextLines);
  
  // Calculate gutter width
  const gutterWidth = String(endLine).length;
  
  // Empty gutter line
  lines.push(`${' '.repeat(gutterWidth + 1)}${colors.separator('|')}`);

  // Print each line
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineContent = source.lines[lineNum - 1] || '';
    const lineNumStr = String(lineNum).padStart(gutterWidth);
    
    // Is this an error line?
    const isErrorLine = lineNum >= location.line && lineNum <= location.endLine;
    
    // Format line number and separator
    const gutter = isErrorLine
      ? colors.lineNumber(`${lineNumStr} ${colors.separator('|')}`)
      : colors.muted(`${lineNumStr} ${colors.separator('|')}`);
    
    lines.push(`${gutter} ${lineContent}`);

    // Add underline for error lines
    if (isErrorLine) {
      const underline = createUnderline(
        lineContent,
        lineNum,
        location,
        colors
      );
      if (underline) {
        lines.push(`${' '.repeat(gutterWidth + 1)}${colors.separator('|')} ${underline}`);
      }
    }
  }

  // Closing gutter line
  lines.push(`${' '.repeat(gutterWidth + 1)}${colors.separator('|')}`);

  return lines;
}

/**
 * Create underline string for an error location
 */
function createUnderline(
  lineContent: string,
  lineNum: number,
  location: SourceLocation,
  colors: ColorScheme
): string | null {
  let startCol: number;
  let endCol: number;

  if (lineNum === location.line && lineNum === location.endLine) {
    // Error on single line
    startCol = location.column - 1;
    endCol = location.endColumn - 1;
  } else if (lineNum === location.line) {
    // First line of multi-line error
    startCol = location.column - 1;
    endCol = lineContent.length;
  } else if (lineNum === location.endLine) {
    // Last line of multi-line error
    startCol = 0;
    endCol = location.endColumn - 1;
  } else {
    // Middle line of multi-line error
    startCol = 0;
    endCol = lineContent.length;
  }

  // Ensure bounds are valid
  startCol = Math.max(0, Math.min(startCol, lineContent.length));
  endCol = Math.max(startCol, Math.min(endCol, lineContent.length));

  if (endCol <= startCol) {
    return null;
  }

  const padding = ' '.repeat(startCol);
  const carets = colors.highlight('^'.repeat(endCol - startCol));
  
  return padding + carets;
}

/**
 * Format annotation line (note or help)
 */
function formatAnnotation(
  type: 'note' | 'help',
  text: string,
  colors: ColorScheme
): string {
  const prefix = colors[type](`   = ${type}: `);
  return prefix + text;
}

/**
 * Format related information
 */
function formatRelated(
  related: RelatedInformation,
  colors: ColorScheme,
  contextLines: number
): string {
  const locationStr = `${related.location.file}:${related.location.line}:${related.location.column}`;
  const header = `${colors.note('note')}: ${related.message}`;
  const loc = `  ${colors.separator('-->')} ${colors.path(locationStr)}`;
  
  const source = getSource(related.location.file);
  if (source) {
    const snippet = formatCodeSnippet(source, related.location, colors, 0);
    return [header, loc, ...snippet].join('\n');
  }
  
  return [header, loc].join('\n');
}

// ============================================================================
// MULTIPLE DIAGNOSTICS
// ============================================================================

/**
 * Format multiple diagnostics with summary
 */
export function formatDiagnostics(
  diagnostics: Diagnostic[],
  options: Partial<FormatOptions> = {}
): string {
  const opts: FormatOptions = {
    colors: true,
    contextLines: 2,
    showCodes: true,
    showHelp: true,
    maxErrors: 10,
    showRelated: true,
    terminalWidth: 80,
    ...options,
  };

  const colors = opts.colors ? COLORS : NO_COLORS;

  if (diagnostics.length === 0) {
    return colors.muted('No errors found.');
  }

  const lines: string[] = [];

  // Format each diagnostic (up to maxErrors)
  const toShow = diagnostics.slice(0, opts.maxErrors);
  for (let i = 0; i < toShow.length; i++) {
    if (i > 0) {
      lines.push(''); // Empty line between diagnostics
    }
    lines.push(formatDiagnostic(toShow[i]!, opts));
  }

  // Show how many more errors if truncated
  if (diagnostics.length > opts.maxErrors) {
    const remaining = diagnostics.length - opts.maxErrors;
    lines.push('');
    lines.push(colors.muted(`... and ${remaining} more error${remaining === 1 ? '' : 's'}`));
  }

  // Summary line
  lines.push('');
  lines.push(formatSummary(diagnostics, colors));

  return lines.join('\n');
}

/**
 * Format summary line
 */
function formatSummary(diagnostics: Diagnostic[], colors: ColorScheme): string {
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  
  const parts: string[] = [];
  
  if (errors > 0) {
    parts.push(colors.error(`${errors} error${errors === 1 ? '' : 's'}`));
  }
  if (warnings > 0) {
    parts.push(colors.warning(`${warnings} warning${warnings === 1 ? '' : 's'}`));
  }
  
  if (parts.length === 0) {
    return colors.muted('No issues found.');
  }
  
  return parts.join(', ') + ' generated';
}

// ============================================================================
// EXPLANATION FORMATTING (for `isl explain`)
// ============================================================================

/**
 * Format an error explanation for `isl explain <code>`
 */
export function formatExplanation(code: string, useColors: boolean = true): string {
  const colors = useColors ? COLORS : NO_COLORS;
  const explanation = getExplanation(code);
  
  if (!explanation) {
    return colors.error(`No explanation available for error code '${code}'.\n`) +
           colors.muted(`Use 'isl explain --list' to see all error codes.`);
  }

  const lines: string[] = [];

  // Header
  lines.push(colors.error.bold(`${code}: ${explanation.title}`));
  lines.push('');

  // Explanation
  lines.push(explanation.explanation);
  lines.push('');

  // Common causes
  if (explanation.causes.length > 0) {
    lines.push(colors.note.bold('Common causes:'));
    for (const cause of explanation.causes) {
      lines.push(`  • ${cause}`);
    }
    lines.push('');
  }

  // Solutions
  if (explanation.solutions.length > 0) {
    lines.push(colors.help.bold('How to fix:'));
    for (const solution of explanation.solutions) {
      lines.push(`  • ${solution}`);
    }
    lines.push('');
  }

  // Bad example
  if (explanation.badExample) {
    lines.push(colors.error.bold('✗ Incorrect:'));
    lines.push(colors.muted(explanation.badExample.description));
    lines.push('');
    lines.push(formatCodeBlock(explanation.badExample.code, colors));
    lines.push('');
  }

  // Good example
  if (explanation.goodExample) {
    lines.push(colors.hint.bold('✓ Correct:'));
    lines.push(colors.muted(explanation.goodExample.description));
    lines.push('');
    lines.push(formatCodeBlock(explanation.goodExample.code, colors));
    lines.push('');
  }

  // See also
  if (explanation.seeAlso && explanation.seeAlso.length > 0) {
    lines.push(colors.muted.bold('See also: ') + 
               colors.muted(explanation.seeAlso.join(', ')));
  }

  return lines.join('\n');
}

/**
 * Format a code block with line numbers
 */
function formatCodeBlock(code: string, colors: ColorScheme): string {
  const codeLines = code.split('\n');
  const gutterWidth = String(codeLines.length).length;
  
  return codeLines.map((line, i) => {
    const lineNum = String(i + 1).padStart(gutterWidth);
    return `${colors.lineNumber(lineNum)} ${colors.separator('│')} ${line}`;
  }).join('\n');
}

/**
 * Format a list of all error codes
 */
export function formatErrorCodeList(useColors: boolean = true): string {
  const colors = useColors ? COLORS : NO_COLORS;
  const lines: string[] = [];

  lines.push(colors.hint.bold('ISL Error Code Reference'));
  lines.push('');

  const categories = [
    { range: 'E0001-E0099', name: 'Lexer', description: 'Tokenization errors' },
    { range: 'E0100-E0199', name: 'Parser', description: 'Syntax errors' },
    { range: 'E0200-E0299', name: 'Type', description: 'Type checking errors' },
    { range: 'E0300-E0399', name: 'Semantic', description: 'Name resolution, scoping' },
    { range: 'E0400-E0499', name: 'Eval', description: 'Runtime evaluation errors' },
    { range: 'E0500-E0599', name: 'Verify', description: 'Verification errors' },
    { range: 'E0600-E0699', name: 'Config', description: 'Configuration errors' },
    { range: 'E0700-E0799', name: 'I/O', description: 'File and import errors' },
  ];

  for (const cat of categories) {
    lines.push(
      `  ${colors.lineNumber(cat.range.padEnd(14))} ` +
      `${colors.note(cat.name.padEnd(10))} ` +
      `${colors.muted(cat.description)}`
    );
  }

  lines.push('');
  lines.push(colors.muted(`Run 'isl explain <CODE>' for detailed information.`));

  return lines.join('\n');
}
