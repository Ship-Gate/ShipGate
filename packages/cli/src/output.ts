/**
 * Output Utilities
 * 
 * Console formatting and colorful output for the ISL CLI.
 */

import chalk from 'chalk';

/** Log levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

/** Output format options */
export type OutputFormat = 'pretty' | 'json' | 'quiet';

/** Output configuration */
export interface OutputConfig {
  verbose: boolean;
  quiet: boolean;
  noColor: boolean;
  format: OutputFormat;
}

const defaultConfig: OutputConfig = {
  verbose: false,
  quiet: false,
  noColor: false,
  format: 'pretty',
};

let config = { ...defaultConfig };

/**
 * Check if output should be JSON
 */
export function isJsonOutput(): boolean {
  return config.format === 'json';
}

/**
 * Check if output should be quiet
 */
export function isQuietOutput(): boolean {
  return config.format === 'quiet' || config.quiet;
}

/**
 * Configure output settings
 */
export function configureOutput(options: Partial<OutputConfig>): void {
  config = { ...config, ...options };
  if (config.noColor || config.format === 'json') {
    chalk.level = 0;
  }
}

/**
 * Output JSON data (only if in JSON mode)
 */
export function json(data: unknown): void {
  if (config.format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Output JSON or pretty based on mode
 */
export function outputResult<T>(data: T, prettyPrinter: (data: T) => void): void {
  if (config.format === 'json') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    prettyPrinter(data);
  }
}

/**
 * Reset output configuration
 */
export function resetOutput(): void {
  config = { ...defaultConfig };
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic Logging
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log a debug message (only in verbose mode)
 */
export function debug(message: string): void {
  if (config.verbose && !config.quiet) {
    console.log(chalk.gray(`[debug] ${message}`));
  }
}

/**
 * Log an info message
 */
export function info(message: string): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    console.log(message);
  }
}

/**
 * Log a warning message
 */
export function warn(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

/**
 * Log an error message
 */
export function error(message: string): void {
  console.error(chalk.red(`✗ ${message}`));
}

/**
 * Log a success message
 */
export function success(message: string): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    console.log(chalk.green(`✓ ${message}`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatted Output
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a header/title
 */
export function header(text: string): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    console.log('');
    console.log(chalk.bold.cyan(text));
    console.log(chalk.gray('─'.repeat(Math.min(text.length + 4, 60))));
  }
}

/**
 * Print a section title
 */
export function section(text: string): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    console.log('');
    console.log(chalk.bold(text));
  }
}

/**
 * Print a list item
 */
export function listItem(text: string, indent = 0): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}• ${text}`);
  }
}

/**
 * Print a numbered list item
 */
export function numberedItem(num: number, text: string, indent = 0): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${chalk.cyan(num.toString() + '.')} ${text}`);
  }
}

/**
 * Print a key-value pair
 */
export function keyValue(key: string, value: string, indent = 0): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${chalk.gray(key + ':')} ${value}`);
  }
}

/**
 * Print a file path
 */
export function filePath(path: string, status?: 'created' | 'updated' | 'deleted' | 'checked'): void {
  if (!isQuietOutput() && !isJsonOutput()) {
    const statusIcon = status === 'created' ? chalk.green('+')
      : status === 'updated' ? chalk.yellow('~')
      : status === 'deleted' ? chalk.red('-')
      : status === 'checked' ? chalk.cyan('✓')
      : chalk.gray('→');
    console.log(`  ${statusIcon} ${chalk.gray(path)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress & Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a progress bar
 */
export function progressBar(current: number, total: number, width = 20): string {
  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${percent}%`;
}

/**
 * Print a score with color coding
 */
export function score(value: number, max = 100): string {
  const color = value >= 95 ? chalk.green
    : value >= 85 ? chalk.cyan
    : value >= 70 ? chalk.yellow
    : chalk.red;
  
  return color(`${value}/${max}`);
}

/**
 * Print a status badge
 */
export function badge(text: string, type: 'success' | 'warning' | 'error' | 'info'): string {
  const styles = {
    success: chalk.bgGreen.black,
    warning: chalk.bgYellow.black,
    error: chalk.bgRed.white,
    info: chalk.bgBlue.white,
  };
  return styles[type](` ${text} `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────────────────────

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

/**
 * Print a simple table
 */
export function table<T extends Record<string, unknown>>(
  data: T[],
  columns: TableColumn[]
): void {
  if (isQuietOutput() || isJsonOutput() || data.length === 0) return;

  // Calculate column widths
  const widths = columns.map(col => {
    if (col.width) return col.width;
    const headerLen = col.header.length;
    const maxDataLen = Math.max(...data.map(row => String(row[col.key] ?? '').length));
    return Math.max(headerLen, maxDataLen);
  });

  // Print header
  const headerRow = columns.map((col, i) => {
    return chalk.bold(col.header.padEnd(widths[i]));
  }).join('  ');
  console.log(headerRow);
  console.log(chalk.gray('─'.repeat(widths.reduce((a, b) => a + b, 0) + (columns.length - 1) * 2)));

  // Print rows
  for (const row of data) {
    const dataRow = columns.map((col, i) => {
      const value = String(row[col.key] ?? '');
      if (col.align === 'right') return value.padStart(widths[i]);
      if (col.align === 'center') {
        const padding = widths[i] - value.length;
        const left = Math.floor(padding / 2);
        return ' '.repeat(left) + value + ' '.repeat(padding - left);
      }
      return value.padEnd(widths[i]);
    }).join('  ');
    console.log(dataRow);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Formatting
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosticError {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  notes?: string[];
  help?: string[];
}

/**
 * Print a diagnostic error with location (legacy format)
 */
export function diagnostic(err: DiagnosticError): void {
  const severity = err.severity ?? 'error';
  const color = severity === 'error' ? chalk.red
    : severity === 'warning' ? chalk.yellow
    : chalk.blue;
  
  const icon = severity === 'error' ? '✗'
    : severity === 'warning' ? '⚠'
    : 'ℹ';

  let location = '';
  if (err.file) {
    location = chalk.gray(err.file);
    if (err.line !== undefined) {
      location += chalk.gray(`:${err.line}`);
      if (err.column !== undefined) {
        location += chalk.gray(`:${err.column}`);
      }
    }
    location += ' ';
  }

  console.log(`${color(icon)} ${location}${err.message}`);
}

/**
 * Print multiple diagnostic errors (legacy format)
 */
export function diagnostics(errors: DiagnosticError[]): void {
  for (const err of errors) {
    diagnostic(err);
  }
  
  const errorCount = errors.filter(e => e.severity === 'error' || !e.severity).length;
  const warnCount = errors.filter(e => e.severity === 'warning').length;
  
  if (errorCount > 0 || warnCount > 0) {
    console.log('');
    const parts: string[] = [];
    if (errorCount > 0) parts.push(chalk.red(`${errorCount} error${errorCount === 1 ? '' : 's'}`));
    if (warnCount > 0) parts.push(chalk.yellow(`${warnCount} warning${warnCount === 1 ? '' : 's'}`));
    console.log(parts.join(', '));
  }
}

/**
 * Print a beautiful diagnostic error with code snippet (Elm/Rust style)
 * 
 * Example output:
 * ```
 * error[E0200]: Type mismatch
 *   --> specs/payment.isl:7:9
 *    |
 *  7 |   post: sender.balance == old(sender.balance) - amount
 *    |         ^^^^^^^^^^^^^^
 *    |
 *    = note: sender.balance is typed as String
 *    = help: Did you mean sender.balanceAmount?
 * ```
 */
export function prettyDiagnostic(
  err: DiagnosticError,
  sourceLines?: string[],
  options: { colors?: boolean } = {}
): void {
  const useColors = options.colors ?? !config.noColor;
  const color = useColors
    ? (err.severity === 'error' ? chalk.red : err.severity === 'warning' ? chalk.yellow : chalk.blue)
    : chalk.reset;
  const dimColor = useColors ? chalk.gray : chalk.reset;
  const cyanColor = useColors ? chalk.cyan : chalk.reset;

  // Header: error[E0200]: Type mismatch
  const codeStr = err.code ? `[${err.code}]` : '';
  console.log(color.bold(`${err.severity ?? 'error'}${codeStr}: ${err.message}`));

  // Location: --> file:line:column
  if (err.file) {
    const pos = err.line ? `:${err.line}${err.column ? `:${err.column}` : ''}` : '';
    console.log(`  ${dimColor('-->')} ${cyanColor(err.file)}${pos}`);
  }

  // Code snippet with underline
  if (sourceLines && err.line !== undefined) {
    const lineNum = err.line;
    const line = sourceLines[lineNum - 1];
    
    if (line !== undefined) {
      const gutterWidth = String(lineNum).length;
      const gutter = dimColor(`${String(lineNum).padStart(gutterWidth)} |`);
      const emptyGutter = dimColor(`${' '.repeat(gutterWidth)} |`);

      console.log(emptyGutter);
      console.log(`${gutter} ${line}`);

      // Underline
      if (err.column !== undefined) {
        const startCol = err.column - 1;
        const endCol = err.endColumn ? err.endColumn - 1 : startCol + 1;
        const underline = ' '.repeat(startCol) + color('^'.repeat(Math.max(1, endCol - startCol)));
        console.log(`${emptyGutter} ${underline}`);
      }

      console.log(emptyGutter);
    }
  }

  // Notes
  if (err.notes) {
    for (const note of err.notes) {
      console.log(cyanColor(`   = note: ${note}`));
    }
  }

  // Help
  if (err.help) {
    for (const help of err.help) {
      console.log(cyanColor(`   = help: ${help}`));
    }
  }
}

/**
 * Print multiple diagnostics with pretty formatting
 */
export function prettyDiagnostics(
  errors: DiagnosticError[],
  sourceLines?: string[],
  options: { colors?: boolean; maxErrors?: number } = {}
): void {
  const maxErrors = options.maxErrors ?? 10;
  const toShow = errors.slice(0, maxErrors);

  for (let i = 0; i < toShow.length; i++) {
    if (i > 0) console.log();
    prettyDiagnostic(toShow[i]!, sourceLines, options);
  }

  if (errors.length > maxErrors) {
    console.log();
    console.log(chalk.gray(`... and ${errors.length - maxErrors} more error(s)`));
  }

  // Summary
  const errorCount = errors.filter(e => e.severity === 'error' || !e.severity).length;
  const warnCount = errors.filter(e => e.severity === 'warning').length;

  if (errorCount > 0 || warnCount > 0) {
    console.log();
    const parts: string[] = [];
    if (errorCount > 0) parts.push(chalk.red.bold(`${errorCount} error${errorCount === 1 ? '' : 's'}`));
    if (warnCount > 0) parts.push(chalk.yellow.bold(`${warnCount} warning${warnCount === 1 ? '' : 's'}`));
    console.log(parts.join(', ') + ' generated');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Boxes & Panels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a boxed message
 */
export function box(title: string, content: string[], style: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  if (isQuietOutput() || isJsonOutput()) return;

  const colors = {
    info: chalk.cyan,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
  };
  const color = colors[style];

  const maxLen = Math.max(title.length, ...content.map(l => l.length));
  const width = Math.min(maxLen + 4, 70);

  console.log('');
  console.log(color('┌' + '─'.repeat(width - 2) + '┐'));
  console.log(color('│') + chalk.bold(` ${title.padEnd(width - 3)}`) + color('│'));
  console.log(color('├' + '─'.repeat(width - 2) + '┤'));
  
  for (const line of content) {
    console.log(color('│') + ` ${line.padEnd(width - 3)}` + color('│'));
  }
  
  console.log(color('└' + '─'.repeat(width - 2) + '┘'));
  console.log('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export const output = {
  configure: configureOutput,
  reset: resetOutput,
  isJson: isJsonOutput,
  isQuiet: isQuietOutput,
  json,
  outputResult,
  debug,
  info,
  warn,
  error,
  success,
  header,
  section,
  listItem,
  numberedItem,
  keyValue,
  filePath,
  progressBar,
  score,
  badge,
  table,
  diagnostic,
  diagnostics,
  box,
};

export default output;
