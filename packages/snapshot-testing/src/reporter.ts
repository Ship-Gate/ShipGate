/**
 * Diff Reporter
 * 
 * Generate human-readable diff reports for snapshot failures.
 */

import * as diff from 'diff';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Reporter options */
export interface ReporterOptions {
  /** Number of context lines around changes */
  contextLines?: number;
  /** Use colors in output */
  colors?: boolean;
  /** Maximum diff size before truncating */
  maxDiffSize?: number;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Expand all changes (no collapsing) */
  expand?: boolean;
}

/** Diff hunk */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/** Diff line */
export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  lineNumber?: number;
}

/** Full diff result */
export interface DiffResult {
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  hasChanges: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────────────────────────────

const Colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function colorize(text: string, color: string, useColors: boolean): string {
  return useColors ? `${color}${text}${Colors.reset}` : text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate diff between two strings
 */
export function generateDiff(
  expected: string,
  actual: string,
  options: ReporterOptions = {}
): DiffResult {
  const contextLines = options.contextLines ?? 3;
  
  const changes = diff.diffLines(expected, actual);
  
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNumber = 1;
  let newLineNumber = 1;
  let additions = 0;
  let deletions = 0;
  let contextBuffer: DiffLine[] = [];

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, '').split('\n');
    
    if (change.added) {
      // Start new hunk if needed
      if (!currentHunk) {
        currentHunk = createHunk(oldLineNumber, newLineNumber, contextBuffer.slice(-contextLines));
      } else if (contextBuffer.length > 0) {
        // Add buffered context
        for (const line of contextBuffer.slice(-contextLines)) {
          currentHunk.lines.push(line);
        }
      }
      contextBuffer = [];

      for (const line of lines) {
        currentHunk.lines.push({
          type: 'add',
          content: line,
          lineNumber: newLineNumber,
        });
        newLineNumber++;
        additions++;
      }
    } else if (change.removed) {
      // Start new hunk if needed
      if (!currentHunk) {
        currentHunk = createHunk(oldLineNumber, newLineNumber, contextBuffer.slice(-contextLines));
      } else if (contextBuffer.length > 0) {
        // Add buffered context
        for (const line of contextBuffer.slice(-contextLines)) {
          currentHunk.lines.push(line);
        }
      }
      contextBuffer = [];

      for (const line of lines) {
        currentHunk.lines.push({
          type: 'remove',
          content: line,
          lineNumber: oldLineNumber,
        });
        oldLineNumber++;
        deletions++;
      }
    } else {
      // Context
      const contextArray: DiffLine[] = [];
      for (const line of lines) {
        contextArray.push({
          type: 'context',
          content: line,
          lineNumber: oldLineNumber,
        });
        oldLineNumber++;
        newLineNumber++;
      }

      if (currentHunk) {
        // Add leading context to current hunk
        const leading = contextArray.slice(0, contextLines);
        for (const line of leading) {
          currentHunk.lines.push(line);
        }

        // If we have more context than needed, close hunk
        if (contextArray.length > contextLines * 2) {
          currentHunk.oldLines = countLines(currentHunk.lines, ['context', 'remove']);
          currentHunk.newLines = countLines(currentHunk.lines, ['context', 'add']);
          hunks.push(currentHunk);
          currentHunk = null;
          contextBuffer = contextArray.slice(-contextLines);
        } else {
          contextBuffer = contextArray.slice(contextLines);
        }
      } else {
        contextBuffer = contextArray;
      }
    }
  }

  // Close final hunk
  if (currentHunk) {
    currentHunk.oldLines = countLines(currentHunk.lines, ['context', 'remove']);
    currentHunk.newLines = countLines(currentHunk.lines, ['context', 'add']);
    hunks.push(currentHunk);
  }

  return {
    hunks,
    additions,
    deletions,
    hasChanges: additions > 0 || deletions > 0,
  };
}

function createHunk(oldStart: number, newStart: number, context: DiffLine[]): DiffHunk {
  return {
    oldStart: Math.max(1, oldStart - context.length),
    oldLines: 0,
    newStart: Math.max(1, newStart - context.length),
    newLines: 0,
    lines: [...context],
  };
}

function countLines(lines: DiffLine[], types: DiffLine['type'][]): number {
  return lines.filter(l => types.includes(l.type)).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format diff as unified diff string
 */
export function formatUnifiedDiff(
  diffResult: DiffResult,
  options: ReporterOptions = {}
): string {
  const useColors = options.colors ?? true;
  const lineNumbers = options.lineNumbers ?? true;
  const maxSize = options.maxDiffSize ?? 10000;

  const lines: string[] = [];

  for (const hunk of diffResult.hunks) {
    // Hunk header
    const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
    lines.push(colorize(header, Colors.cyan, useColors));

    for (const line of hunk.lines) {
      let prefix: string;
      let color: string;

      switch (line.type) {
        case 'add':
          prefix = '+';
          color = Colors.green;
          break;
        case 'remove':
          prefix = '-';
          color = Colors.red;
          break;
        default:
          prefix = ' ';
          color = Colors.reset;
      }

      let formatted = `${prefix}${line.content}`;
      
      if (lineNumbers && line.lineNumber !== undefined) {
        const num = line.lineNumber.toString().padStart(4);
        formatted = colorize(num, Colors.gray, useColors) + ' ' + formatted;
      }

      lines.push(colorize(formatted, color, useColors));
    }
  }

  let result = lines.join('\n');

  // Truncate if too long
  if (result.length > maxSize) {
    result = result.slice(0, maxSize) + '\n... (truncated)';
  }

  return result;
}

/**
 * Format diff as inline comparison
 */
export function formatInlineDiff(
  expected: string,
  actual: string,
  options: ReporterOptions = {}
): string {
  const useColors = options.colors ?? true;
  const lines: string[] = [];

  lines.push(colorize('Expected:', Colors.green, useColors));
  lines.push(colorize(formatValue(expected), Colors.green, useColors));
  lines.push('');
  lines.push(colorize('Received:', Colors.red, useColors));
  lines.push(colorize(formatValue(actual), Colors.red, useColors));

  return lines.join('\n');
}

/**
 * Format value for display
 */
function formatValue(value: string): string {
  // Limit length
  const maxLen = 1000;
  if (value.length > maxLen) {
    return value.slice(0, maxLen) + '...(truncated)';
  }
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Diff Reporter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate snapshot failure report
 */
export function generateSnapshotReport(
  testName: string,
  snapshotName: string,
  expected: string,
  actual: string,
  options: ReporterOptions = {}
): string {
  const useColors = options.colors ?? true;
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(colorize('Snapshot name:', Colors.bold, useColors) + ` ${snapshotName}`);
  lines.push('');

  // Generate diff
  const diffResult = generateDiff(expected, actual, options);

  if (diffResult.hasChanges) {
    lines.push(formatUnifiedDiff(diffResult, options));
    lines.push('');
    lines.push(colorize(
      `  ${diffResult.deletions} deletion${diffResult.deletions === 1 ? '' : 's'}, ` +
      `${diffResult.additions} addition${diffResult.additions === 1 ? '' : 's'}`,
      Colors.gray,
      useColors
    ));
  } else {
    lines.push(colorize('No visible differences', Colors.gray, useColors));
  }

  // Footer
  lines.push('');
  lines.push(colorize(
    'Inspect your code changes or run with `-u` to update the snapshot.',
    Colors.gray,
    useColors
  ));

  return lines.join('\n');
}

/**
 * Generate summary of all snapshot failures
 */
export function generateSummaryReport(
  failures: Array<{ testName: string; snapshotName: string; expected: string; actual: string }>,
  options: ReporterOptions = {}
): string {
  const useColors = options.colors ?? true;
  const lines: string[] = [];

  lines.push('');
  lines.push(colorize('Snapshot Failures', Colors.bold + Colors.red, useColors));
  lines.push(colorize('═'.repeat(40), Colors.gray, useColors));
  lines.push('');

  for (const failure of failures) {
    lines.push(generateSnapshotReport(
      failure.testName,
      failure.snapshotName,
      failure.expected,
      failure.actual,
      options
    ));
    lines.push('');
    lines.push(colorize('─'.repeat(40), Colors.gray, useColors));
  }

  lines.push('');
  lines.push(colorize(
    `${failures.length} snapshot${failures.length === 1 ? '' : 's'} failed`,
    Colors.red,
    useColors
  ));

  return lines.join('\n');
}
