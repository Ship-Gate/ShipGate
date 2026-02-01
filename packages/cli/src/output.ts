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
  if (!config.quiet) {
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
  if (!config.quiet) {
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
  if (!config.quiet) {
    console.log('');
    console.log(chalk.bold.cyan(text));
    console.log(chalk.gray('─'.repeat(Math.min(text.length + 4, 60))));
  }
}

/**
 * Print a section title
 */
export function section(text: string): void {
  if (!config.quiet) {
    console.log('');
    console.log(chalk.bold(text));
  }
}

/**
 * Print a list item
 */
export function listItem(text: string, indent = 0): void {
  if (!config.quiet) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}• ${text}`);
  }
}

/**
 * Print a numbered list item
 */
export function numberedItem(num: number, text: string, indent = 0): void {
  if (!config.quiet) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${chalk.cyan(num.toString() + '.')} ${text}`);
  }
}

/**
 * Print a key-value pair
 */
export function keyValue(key: string, value: string, indent = 0): void {
  if (!config.quiet) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${chalk.gray(key + ':')} ${value}`);
  }
}

/**
 * Print a file path
 */
export function filePath(path: string, status?: 'created' | 'updated' | 'deleted' | 'checked'): void {
  if (!config.quiet) {
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
  if (config.quiet || data.length === 0) return;

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
  message: string;
  severity?: 'error' | 'warning' | 'info';
}

/**
 * Print a diagnostic error with location
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
 * Print multiple diagnostic errors
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

// ─────────────────────────────────────────────────────────────────────────────
// Boxes & Panels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Print a boxed message
 */
export function box(title: string, content: string[], style: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  if (config.quiet) return;

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
