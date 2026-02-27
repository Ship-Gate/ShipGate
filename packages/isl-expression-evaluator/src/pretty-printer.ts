// ============================================================================
// ISL Expression Evaluator - Pretty Printer for Diagnostics
// ============================================================================
//
// Displays failing sub-expressions with visual carets and context.
// Inspired by Rust/Elm error formatting.
//
// Example output:
// ```
// error[EVAL_UNKNOWN_IDENTIFIER]: Unknown identifier
//   --> specs/payment.isl:7:9
//    |
//  7 |   post: sender.balance == old(sender.balance) - ammount
//    |                                                 ^^^^^^^ identifier 'ammount' is not defined
//    |
//    = help: Did you mean: amount?
// ```
//
// ============================================================================

import type { Expression, SourceLocation } from '@isl-lang/parser';
import type { EvaluatorDiagnostic, DiagnosticSpan, DiagnosticSeverity } from './diagnostics.js';

// ============================================================================
// ANSI COLOR CODES (optional, no external dependencies)
// ============================================================================

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
};

function colorize(text: string, ...codes: string[]): string {
  if (codes.length === 0) return text;
  return codes.join('') + text + ANSI.reset;
}

// ============================================================================
// FORMATTING OPTIONS
// ============================================================================

export interface PrettyPrintOptions {
  /** Enable ANSI colors */
  colors?: boolean;
  
  /** Number of context lines before/after error */
  contextLines?: number;
  
  /** Show the error code */
  showCode?: boolean;
  
  /** Show suggestions/help text */
  showHelp?: boolean;
  
  /** Terminal width for wrapping */
  terminalWidth?: number;
  
  /** Show nested child diagnostics */
  showChildren?: boolean;
  
  /** Maximum depth for nested diagnostics */
  maxChildDepth?: number;
}

const DEFAULT_OPTIONS: Required<PrettyPrintOptions> = {
  colors: true,
  contextLines: 2,
  showCode: true,
  showHelp: true,
  terminalWidth: 80,
  showChildren: true,
  maxChildDepth: 3,
};

// ============================================================================
// COLOR SCHEME
// ============================================================================

type ColorFn = (text: string) => string;

interface ColorScheme {
  error: ColorFn;
  warning: ColorFn;
  info: ColorFn;
  hint: ColorFn;
  note: ColorFn;
  help: ColorFn;
  lineNumber: ColorFn;
  separator: ColorFn;
  code: ColorFn;
  caret: ColorFn;
  underline: ColorFn;
  path: ColorFn;
  muted: ColorFn;
}

const COLORS: ColorScheme = {
  error: (s: string) => colorize(s, ANSI.red, ANSI.bold),
  warning: (s: string) => colorize(s, ANSI.yellow, ANSI.bold),
  info: (s: string) => colorize(s, ANSI.blue, ANSI.bold),
  hint: (s: string) => colorize(s, ANSI.cyan, ANSI.bold),
  note: (s: string) => colorize(s, ANSI.cyan),
  help: (s: string) => colorize(s, ANSI.cyan),
  lineNumber: (s: string) => colorize(s, ANSI.blue),
  separator: (s: string) => colorize(s, ANSI.blue),
  code: (s: string) => colorize(s, ANSI.white),
  caret: (s: string) => colorize(s, ANSI.red, ANSI.bold),
  underline: (s: string) => colorize(s, ANSI.red),
  path: (s: string) => colorize(s, ANSI.cyan),
  muted: (s: string) => colorize(s, ANSI.gray),
};

const NO_COLORS: ColorScheme = {
  error: (s: string) => s,
  warning: (s: string) => s,
  info: (s: string) => s,
  hint: (s: string) => s,
  note: (s: string) => s,
  help: (s: string) => s,
  lineNumber: (s: string) => s,
  separator: (s: string) => s,
  code: (s: string) => s,
  caret: (s: string) => s,
  underline: (s: string) => s,
  path: (s: string) => s,
  muted: (s: string) => s,
};

// ============================================================================
// SOURCE FILE CACHE
// ============================================================================

const sourceCache = new Map<string, string[]>();

/**
 * Register source file content for error formatting
 */
export function registerSource(path: string, content: string): void {
  sourceCache.set(path, content.split('\n'));
}

/**
 * Clear the source cache
 */
export function clearSourceCache(): void {
  sourceCache.clear();
}

/**
 * Get source lines for a file
 */
export function getSourceLines(path: string): string[] | undefined {
  return sourceCache.get(path);
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format an evaluator diagnostic into a pretty-printed string
 */
export function formatDiagnostic(
  diagnostic: EvaluatorDiagnostic,
  options: PrettyPrintOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const colors = opts.colors ? COLORS : NO_COLORS;
  const lines: string[] = [];

  // Header line
  lines.push(formatHeader(diagnostic, colors, opts.showCode));

  // Location line
  lines.push(formatLocation(diagnostic.span, colors));

  // Code snippet with caret
  const sourceLines = getSourceLines(diagnostic.span.file);
  if (sourceLines) {
    const snippet = formatCodeSnippet(
      sourceLines,
      diagnostic.span,
      diagnostic.message,
      colors,
      opts.contextLines
    );
    lines.push(...snippet);
  }

  // Suggestion/help
  if (opts.showHelp && diagnostic.suggestion) {
    lines.push(formatHelp(diagnostic.suggestion, colors));
  }

  // Child diagnostics
  if (opts.showChildren && diagnostic.children && diagnostic.children.length > 0) {
    lines.push('');
    lines.push(colors.muted('  Caused by:'));
    for (const child of diagnostic.children.slice(0, 3)) {
      const childStr = formatDiagnostic(child, {
        ...opts,
        maxChildDepth: opts.maxChildDepth - 1,
        showChildren: opts.maxChildDepth > 1,
      });
      // Indent child diagnostics
      const indentedChild = childStr
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n');
      lines.push(indentedChild);
    }
    if (diagnostic.children.length > 3) {
      lines.push(colors.muted(`    ... and ${diagnostic.children.length - 3} more`));
    }
  }

  return lines.join('\n');
}

/**
 * Format multiple diagnostics with summary
 */
export function formatDiagnostics(
  diagnostics: EvaluatorDiagnostic[],
  options: PrettyPrintOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const colors = opts.colors ? COLORS : NO_COLORS;

  if (diagnostics.length === 0) {
    return colors.muted('No evaluation errors.');
  }

  const lines: string[] = [];

  // Format each diagnostic
  for (let i = 0; i < diagnostics.length; i++) {
    if (i > 0) {
      lines.push('');
    }
    lines.push(formatDiagnostic(diagnostics[i]!, opts));
  }

  // Summary
  lines.push('');
  lines.push(formatSummary(diagnostics, colors));

  return lines.join('\n');
}

// ============================================================================
// COMPONENT FORMATTERS
// ============================================================================

/**
 * Format header line: error[EVAL_UNKNOWN_IDENTIFIER]: Unknown identifier
 */
function formatHeader(
  diagnostic: EvaluatorDiagnostic,
  colors: ColorScheme,
  showCode: boolean
): string {
  const severityColor = getSeverityColor(diagnostic.severity, colors);
  const label = diagnostic.severity;
  
  let header = severityColor(label);
  if (showCode) {
    header += severityColor(`[${diagnostic.code}]`);
  }
  header += severityColor(': ');
  header += severityColor(diagnostic.message);

  return header;
}

/**
 * Format location line: --> specs/payment.isl:7:9
 */
function formatLocation(span: DiagnosticSpan, colors: ColorScheme): string {
  const path = colors.path(span.file);
  const pos = `${span.line}:${span.col}`;
  return `  ${colors.separator('-->')} ${path}:${pos}`;
}

/**
 * Format code snippet with caret pointing to error
 */
function formatCodeSnippet(
  sourceLines: string[],
  span: DiagnosticSpan,
  message: string,
  colors: ColorScheme,
  contextLines: number
): string[] {
  const lines: string[] = [];
  
  // Calculate line range
  const startLine = Math.max(1, span.line - contextLines);
  const endLine = Math.min(sourceLines.length, (span.endLine ?? span.line) + contextLines);
  
  // Calculate gutter width
  const gutterWidth = String(endLine).length;
  
  // Empty gutter line
  lines.push(`${' '.repeat(gutterWidth + 1)}${colors.separator('|')}`);

  // Print each line
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineContent = sourceLines[lineNum - 1] ?? '';
    const lineNumStr = String(lineNum).padStart(gutterWidth);
    
    // Is this the error line?
    const isErrorLine = lineNum >= span.line && lineNum <= (span.endLine ?? span.line);
    
    // Format line number and separator
    const gutter = isErrorLine
      ? colors.lineNumber(`${lineNumStr} ${colors.separator('|')}`)
      : colors.muted(`${lineNumStr} ${colors.separator('|')}`);
    
    lines.push(`${gutter} ${lineContent}`);

    // Add caret underline for error lines
    if (isErrorLine && lineNum === span.line) {
      const underline = createCaretUnderline(
        lineContent,
        span,
        message,
        colors,
        gutterWidth
      );
      lines.push(underline);
    }
  }

  // Closing gutter line
  lines.push(`${' '.repeat(gutterWidth + 1)}${colors.separator('|')}`);

  return lines;
}

/**
 * Create caret underline: ^^^^^^^
 */
function createCaretUnderline(
  lineContent: string,
  span: DiagnosticSpan,
  message: string,
  colors: ColorScheme,
  gutterWidth: number
): string {
  // Calculate start position (0-indexed)
  const startCol = span.col - 1;
  
  // Calculate underline length
  const underlineLen = Math.max(1, span.len);
  
  // Ensure we don't exceed line length
  const maxLen = Math.max(0, lineContent.length - startCol);
  const actualLen = Math.min(underlineLen, maxLen > 0 ? maxLen : underlineLen);
  
  // Build the caret string
  const gutter = ' '.repeat(gutterWidth + 1) + colors.separator('|');
  const padding = ' '.repeat(startCol + 1);
  const carets = colors.caret('^'.repeat(actualLen));
  const label = colors.caret(` ${extractShortMessage(message)}`);
  
  return `${gutter}${padding}${carets}${label}`;
}

/**
 * Extract short message for caret label
 */
function extractShortMessage(message: string): string {
  // Truncate to reasonable length
  const maxLen = 50;
  if (message.length <= maxLen) {
    return message;
  }
  return message.substring(0, maxLen - 3) + '...';
}

/**
 * Format help/suggestion line: = help: Did you mean: amount?
 */
function formatHelp(suggestion: string, colors: ColorScheme): string {
  return `   ${colors.help('= help:')} ${suggestion}`;
}

/**
 * Format summary line
 */
function formatSummary(diagnostics: EvaluatorDiagnostic[], colors: ColorScheme): string {
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  
  const parts: string[] = [];
  
  if (errors > 0) {
    parts.push(colors.error(`${errors} evaluation error${errors === 1 ? '' : 's'}`));
  }
  if (warnings > 0) {
    parts.push(colors.warning(`${warnings} warning${warnings === 1 ? '' : 's'}`));
  }
  
  if (parts.length === 0) {
    return colors.muted('No issues found.');
  }
  
  return parts.join(', ') + ' found';
}

/**
 * Get color function for severity
 */
function getSeverityColor(severity: DiagnosticSeverity, colors: ColorScheme): ColorFn {
  switch (severity) {
    case 'error':
      return colors.error;
    case 'warning':
      return colors.warning;
    case 'info':
      return colors.info;
    case 'hint':
      return colors.hint;
    default:
      return colors.error;
  }
}

// ============================================================================
// EXPRESSION PRETTY PRINTER
// ============================================================================

/**
 * Pretty print an expression for diagnostic display
 */
export function prettyPrintExpression(expr: Expression): string {
  switch (expr.kind) {
    case 'Identifier':
      return expr.name;
    
    case 'StringLiteral':
      return `"${expr.value}"`;
    
    case 'NumberLiteral':
      return String(expr.value);
    
    case 'BooleanLiteral':
      return String(expr.value);
    
    case 'NullLiteral':
      return 'null';
    
    case 'BinaryExpr':
      return `${prettyPrintExpression(expr.left)} ${expr.operator} ${prettyPrintExpression(expr.right)}`;
    
    case 'UnaryExpr':
      return `${expr.operator}${prettyPrintExpression(expr.operand)}`;
    
    case 'MemberExpr':
      return `${prettyPrintExpression(expr.object)}.${expr.property.name}`;
    
    case 'CallExpr': {
      const callee = prettyPrintExpression(expr.callee);
      const args = expr.arguments.map(prettyPrintExpression).join(', ');
      return `${callee}(${args})`;
    }
    
    case 'IndexExpr':
      return `${prettyPrintExpression(expr.object)}[${prettyPrintExpression(expr.index)}]`;
    
    case 'QuantifierExpr': {
      const collection = prettyPrintExpression(expr.collection);
      const predicate = prettyPrintExpression(expr.predicate);
      return `${expr.quantifier} ${expr.variable.name} in ${collection}: ${predicate}`;
    }
    
    case 'ConditionalExpr':
      return `${prettyPrintExpression(expr.condition)} ? ${prettyPrintExpression(expr.thenBranch)} : ${prettyPrintExpression(expr.elseBranch)}`;
    
    case 'OldExpr':
      return `old(${prettyPrintExpression(expr.expression)})`;
    
    case 'ResultExpr':
      return expr.property ? `result.${expr.property.name}` : 'result';
    
    case 'InputExpr':
      return `input.${expr.property.name}`;
    
    case 'ListExpr':
      return `[${expr.elements.map(prettyPrintExpression).join(', ')}]`;
    
    default:
      return `<${(expr as Expression).kind}>`;
  }
}

// ============================================================================
// EXPRESSION HIGHLIGHT FORMATTER
// ============================================================================

/**
 * Format an expression with the failing sub-expression highlighted
 */
export function highlightFailingSubExpression(
  fullExpression: string,
  failingSpan: DiagnosticSpan,
  fullSpan: DiagnosticSpan,
  colors: ColorScheme = COLORS
): string {
  // Calculate relative position within the expression
  if (failingSpan.line !== fullSpan.line) {
    // Multi-line - just return the expression as-is
    return fullExpression;
  }
  
  const relativeStart = failingSpan.col - fullSpan.col;
  const relativeEnd = relativeStart + failingSpan.len;
  
  if (relativeStart < 0 || relativeEnd > fullExpression.length) {
    return fullExpression;
  }
  
  const before = fullExpression.substring(0, relativeStart);
  const failing = fullExpression.substring(relativeStart, relativeEnd);
  const after = fullExpression.substring(relativeEnd);
  
  return before + colors.underline(failing) + after;
}

// ============================================================================
// DIAGNOSTIC TO STRING UTILITIES
// ============================================================================

/**
 * Convert a diagnostic to a single-line string (for logging)
 */
export function diagnosticToLine(diagnostic: EvaluatorDiagnostic): string {
  const loc = `${diagnostic.span.file}:${diagnostic.span.line}:${diagnostic.span.col}`;
  return `${diagnostic.severity}[${diagnostic.code}]: ${diagnostic.message} at ${loc}`;
}

/**
 * Convert a diagnostic to JSON (for structured output)
 */
export function diagnosticToJson(diagnostic: EvaluatorDiagnostic): object {
  return {
    code: diagnostic.code,
    catalogCode: diagnostic.catalogCode,
    severity: diagnostic.severity,
    message: diagnostic.message,
    suggestion: diagnostic.suggestion,
    span: diagnostic.span,
    children: diagnostic.children?.map(diagnosticToJson),
  };
}
