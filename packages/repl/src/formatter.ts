// ============================================================================
// ISL REPL Output Formatting
// Syntax highlighting and pretty-printing
// ============================================================================

import type { Intent, Condition } from './session';

// ─────────────────────────────────────────────────────────────────────────────
// ANSI Color Codes
// ─────────────────────────────────────────────────────────────────────────────

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright foreground
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// ─────────────────────────────────────────────────────────────────────────────
// Message Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return `${colors.green}✓${colors.reset} ${message}`;
}

/**
 * Format an error message
 */
export function formatError(message: string): string {
  return `${colors.red}✗ Error:${colors.reset} ${message}`;
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return `${colors.yellow}⚠${colors.reset} ${message}`;
}

/**
 * Format an info message
 */
export function formatInfo(message: string): string {
  return `${colors.cyan}ℹ${colors.reset} ${message}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an intent for display
 */
export function formatIntent(intent: Intent): string {
  const lines: string[] = [
    '',
    `${colors.bold}Intent: ${colors.cyan}${intent.name}${colors.reset}`,
    colors.gray + '─'.repeat(40) + colors.reset,
  ];

  // Preconditions
  if (intent.preconditions.length > 0) {
    lines.push('');
    lines.push(`${colors.bold}Preconditions:${colors.reset}`);
    for (const pre of intent.preconditions) {
      lines.push(`  ${colors.magenta}pre:${colors.reset} ${highlightExpression(pre.expression)}`);
    }
  }

  // Postconditions
  if (intent.postconditions.length > 0) {
    lines.push('');
    lines.push(`${colors.bold}Postconditions:${colors.reset}`);
    for (const post of intent.postconditions) {
      lines.push(`  ${colors.magenta}post:${colors.reset} ${highlightExpression(post.expression)}`);
    }
  }

  // Invariants
  if (intent.invariants.length > 0) {
    lines.push('');
    lines.push(`${colors.bold}Invariants:${colors.reset}`);
    for (const inv of intent.invariants) {
      lines.push(`  ${colors.magenta}invariant:${colors.reset} ${highlightExpression(inv.expression)}`);
    }
  }

  // Scenarios
  if (intent.scenarios.length > 0) {
    lines.push('');
    lines.push(`${colors.bold}Scenarios:${colors.reset}`);
    for (const scenario of intent.scenarios) {
      lines.push(`  ${colors.yellow}${scenario.name}${colors.reset}`);
    }
  }

  // Raw source (if verbose)
  // lines.push('');
  // lines.push(`${colors.gray}Source:${colors.reset}`);
  // lines.push(colors.gray + intent.rawSource + colors.reset);

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a condition
 */
export function formatCondition(condition: Condition, type: 'pre' | 'post' | 'invariant'): string {
  const prefix = {
    pre: colors.magenta + 'pre' + colors.reset,
    post: colors.magenta + 'post' + colors.reset,
    invariant: colors.magenta + 'invariant' + colors.reset,
  }[type];

  return `${prefix}: ${highlightExpression(condition.expression)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Syntax Highlighting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Highlight an ISL expression
 */
export function highlightExpression(expr: string): string {
  return expr
    // Operators
    .replace(/\b(and|or|not|implies)\b/g, `${colors.yellow}$1${colors.reset}`)
    .replace(/(>=|<=|==|!=|>|<)/g, `${colors.yellow}$1${colors.reset}`)
    // Keywords
    .replace(/\b(true|false|null)\b/g, `${colors.magenta}$1${colors.reset}`)
    .replace(/\b(forall|exists|in)\b/g, `${colors.yellow}$1${colors.reset}`)
    // Numbers
    .replace(/\b(\d+(?:\.\d+)?)\b/g, `${colors.cyan}$1${colors.reset}`)
    // Strings
    .replace(/"([^"]*)"/g, `${colors.green}"$1"${colors.reset}`)
    // Method calls
    .replace(/\.(\w+)\(/g, `.${colors.blue}$1${colors.reset}(`)
    // Properties
    .replace(/\.(\w+)(?!\()/g, `.${colors.cyan}$1${colors.reset}`);
}

/**
 * Highlight ISL source code
 */
export function highlightISL(source: string): string {
  return source
    // Keywords
    .replace(/\b(intent|behavior|entity|domain|type|enum)\b/g, `${colors.yellow}$1${colors.reset}`)
    .replace(/\b(pre|post|invariant|scenario)\b/g, `${colors.magenta}$1${colors.reset}`)
    .replace(/\b(input|output|success|errors?)\b/g, `${colors.blue}$1${colors.reset}`)
    // Types
    .replace(/\b(String|Int|Boolean|UUID|Timestamp|Decimal|Duration|List|Map|Optional)\b/g, 
      `${colors.green}$1${colors.reset}`)
    // Operators
    .replace(/\b(and|or|not|implies|forall|exists|in)\b/g, `${colors.yellow}$1${colors.reset}`)
    // Booleans
    .replace(/\b(true|false|null)\b/g, `${colors.magenta}$1${colors.reset}`)
    // Numbers
    .replace(/\b(\d+(?:\.\d+)?)\b/g, `${colors.cyan}$1${colors.reset}`)
    // Strings
    .replace(/"([^"]*)"/g, `${colors.green}"$1"${colors.reset}`)
    // Comments
    .replace(/(\/\/[^\n]*)/g, `${colors.gray}$1${colors.reset}`)
    .replace(/(#[^\n]*)/g, `${colors.gray}$1${colors.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a table
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options: { colors?: boolean } = {}
): string {
  const useColors = options.colors !== false;

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const cellWidths = [h.length, ...rows.map(r => (r[i] ?? '').length)];
    return Math.max(...cellWidths);
  });

  // Format header
  const headerRow = headers.map((h, i) => h.padEnd(widths[i]!)).join(' │ ');
  const separator = widths.map(w => '─'.repeat(w)).join('─┼─');

  // Format rows
  const dataRows = rows.map(row =>
    row.map((cell, i) => (cell ?? '').padEnd(widths[i]!)).join(' │ ')
  );

  const headerFormatted = useColors ? `${colors.bold}${headerRow}${colors.reset}` : headerRow;
  const sepFormatted = useColors ? `${colors.gray}${separator}${colors.reset}` : separator;

  return [headerFormatted, sepFormatted, ...dataRows].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a parse error with caret pointing to position
 */
export function formatParseError(
  source: string,
  message: string,
  line: number,
  column: number
): string {
  const lines = source.split('\n');
  const errorLine = lines[line - 1] || '';
  
  const output = [
    formatError(message),
    '',
    `${colors.gray}${String(line).padStart(4)} │${colors.reset} ${errorLine}`,
    `${colors.gray}     │${colors.reset} ${' '.repeat(column - 1)}${colors.red}^${colors.reset}`,
  ];

  return output.join('\n');
}

/**
 * Format a type error with expected vs actual
 */
export function formatTypeError(
  message: string,
  expected: string,
  actual: string,
  context?: string
): string {
  const output = [
    formatError(message),
    '',
    `  Expected: ${colors.green}${expected}${colors.reset}`,
    `  Actual:   ${colors.red}${actual}${colors.reset}`,
  ];

  if (context) {
    output.push('');
    output.push(`  Context: ${colors.gray}${context}${colors.reset}`);
  }

  return output.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a value for display
 */
export function formatValue(value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  
  if (value === null) return `${colors.gray}null${colors.reset}`;
  if (value === undefined) return `${colors.gray}undefined${colors.reset}`;
  
  if (typeof value === 'string') {
    return `${colors.green}"${value}"${colors.reset}`;
  }
  
  if (typeof value === 'number') {
    return `${colors.cyan}${value}${colors.reset}`;
  }
  
  if (typeof value === 'boolean') {
    return `${colors.magenta}${value}${colors.reset}`;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(v => formatValue(v, indent + 2));
    return `[\n${pad}  ${items.join(`,\n${pad}  `)}\n${pad}]`;
  }
  
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const items = entries.map(([k, v]) => 
      `${colors.blue}${k}${colors.reset}: ${formatValue(v, indent + 2)}`
    );
    return `{\n${pad}  ${items.join(`,\n${pad}  `)}\n${pad}}`;
  }
  
  return String(value);
}

/**
 * Strip ANSI color codes from a string
 */
export function stripColors(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Wrap text to a maximum width
 */
export function wrapText(text: string, maxWidth: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (stripColors(testLine).length > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Box Drawing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a box around text
 */
export function drawBox(lines: string[], title?: string): string {
  const maxLen = Math.max(...lines.map(l => stripColors(l).length), title ? title.length + 4 : 0);
  
  const top = title 
    ? `╔═ ${title} ${'═'.repeat(maxLen - title.length - 3)}╗`
    : `╔${'═'.repeat(maxLen + 2)}╗`;
  
  const bottom = `╚${'═'.repeat(maxLen + 2)}╝`;
  
  const paddedLines = lines.map(l => {
    const padding = maxLen - stripColors(l).length;
    return `║ ${l}${' '.repeat(padding)} ║`;
  });

  return [top, ...paddedLines, bottom].join('\n');
}
