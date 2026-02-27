/**
 * ISL Diff Formatter
 *
 * Formats diff output for stable UI display.
 * Output is deterministic and suitable for terminal or UI rendering.
 */

import type {
  DomainDiff,
  EntityDiff,
  BehaviorDiff,
  TypeDiff,
  FieldChange,
  ClauseChange,
  ErrorChange,
  ChangeSeverity,
  ChangeType,
} from './diffTypes.js';

// ============================================================================
// SYMBOLS
// ============================================================================

const SYMBOLS = {
  added: '+',
  removed: '-',
  changed: '~',
  breaking: '!',
  compatible: '•',
  patch: '·',
  indent: '  ',
  bullet: '•',
  arrow: '→',
};

// ============================================================================
// COLORS (ANSI escape codes for terminal)
// ============================================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ============================================================================
// FORMAT OPTIONS
// ============================================================================

export interface FormatOptions {
  /** Use ANSI colors in output */
  colors?: boolean;
  /** Include severity indicators */
  showSeverity?: boolean;
  /** Include summary at the end */
  showSummary?: boolean;
  /** Maximum width for wrapping */
  maxWidth?: number;
  /** Indentation string */
  indent?: string;
  /** Compact mode (less whitespace) */
  compact?: boolean;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
  colors: false,
  showSeverity: true,
  showSummary: true,
  maxWidth: 80,
  indent: '  ',
  compact: false,
};

// ============================================================================
// HELPERS
// ============================================================================

function color(text: string, colorCode: string, useColors: boolean): string {
  return useColors ? `${colorCode}${text}${COLORS.reset}` : text;
}

function changeSymbol(change: ChangeType): string {
  return SYMBOLS[change];
}

function severitySymbol(severity: ChangeSeverity): string {
  return SYMBOLS[severity];
}

function changeColor(change: ChangeType, useColors: boolean): string {
  const colorMap: Record<ChangeType, string> = {
    added: COLORS.green,
    removed: COLORS.red,
    changed: COLORS.yellow,
  };
  return useColors ? colorMap[change] : '';
}

function severityColor(severity: ChangeSeverity, useColors: boolean): string {
  const colorMap: Record<ChangeSeverity, string> = {
    breaking: COLORS.red,
    compatible: COLORS.yellow,
    patch: COLORS.green,
  };
  return useColors ? colorMap[severity] : '';
}

// ============================================================================
// FIELD FORMATTING
// ============================================================================

function formatFieldChange(fc: FieldChange, opts: Required<FormatOptions>): string {
  const { colors: useColors, indent } = opts;
  const sym = changeSymbol(fc.change);
  const col = changeColor(fc.change, useColors);

  let line = `${indent}${indent}${color(sym, col, useColors)} ${fc.name}`;

  if (fc.change === 'added') {
    line += `: ${fc.newType}`;
    if (fc.newOptional) line += ' (optional)';
  } else if (fc.change === 'removed') {
    line += `: ${fc.oldType}`;
  } else {
    // changed
    if (fc.oldType !== fc.newType) {
      line += `: ${fc.oldType} ${SYMBOLS.arrow} ${fc.newType}`;
    }
    if (fc.oldOptional !== fc.newOptional) {
      const optChange = fc.newOptional ? 'required→optional' : 'optional→required';
      line += ` (${optChange})`;
    }
  }

  return line;
}

// ============================================================================
// CLAUSE FORMATTING
// ============================================================================

function formatClauseChange(cc: ClauseChange, opts: Required<FormatOptions>): string {
  const { colors: useColors, indent } = opts;
  const sym = changeSymbol(cc.change);
  const col = changeColor(cc.change, useColors);

  const expr = cc.change === 'removed' ? cc.oldExpression : cc.newExpression;
  return `${indent}${indent}${color(sym, col, useColors)} ${cc.clauseType}: ${expr}`;
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

function formatErrorChange(ec: ErrorChange, opts: Required<FormatOptions>): string {
  const { colors: useColors, indent } = opts;
  const sym = changeSymbol(ec.change);
  const col = changeColor(ec.change, useColors);

  let line = `${indent}${indent}${color(sym, col, useColors)} error ${ec.name}`;

  if (ec.change === 'changed') {
    const changes: string[] = [];
    if (ec.oldWhen !== ec.newWhen) {
      changes.push(`when: "${ec.oldWhen}" ${SYMBOLS.arrow} "${ec.newWhen}"`);
    }
    if (ec.oldRetriable !== ec.newRetriable) {
      changes.push(`retriable: ${ec.oldRetriable} ${SYMBOLS.arrow} ${ec.newRetriable}`);
    }
    if (changes.length > 0) {
      line += ` (${changes.join(', ')})`;
    }
  }

  return line;
}

// ============================================================================
// ENTITY FORMATTING
// ============================================================================

function formatEntityDiff(diff: EntityDiff, opts: Required<FormatOptions>): string[] {
  const { colors: useColors, indent, showSeverity } = opts;
  const lines: string[] = [];

  const sym = changeSymbol(diff.change);
  const col = changeColor(diff.change, useColors);
  const sevSym = showSeverity ? ` [${severitySymbol(diff.severity)}]` : '';
  const sevCol = severityColor(diff.severity, useColors);

  lines.push(
    `${indent}${color(sym, col, useColors)} entity ${color(diff.name, COLORS.bold, useColors)}${color(sevSym, sevCol, useColors)}`
  );

  if (diff.change === 'changed') {
    // Field changes
    if (diff.fieldChanges.length > 0) {
      lines.push(`${indent}${indent}${color('fields:', COLORS.dim, useColors)}`);
      for (const fc of diff.fieldChanges) {
        lines.push(formatFieldChange(fc, opts));
      }
    }

    // Invariant changes
    if (diff.invariantChanges.length > 0) {
      lines.push(`${indent}${indent}${color('invariants:', COLORS.dim, useColors)}`);
      for (const ic of diff.invariantChanges) {
        lines.push(formatClauseChange(ic, opts));
      }
    }

    // Lifecycle change
    if (diff.lifecycleChanged) {
      lines.push(
        `${indent}${indent}${color('~', COLORS.yellow, useColors)} lifecycle changed`
      );
    }
  }

  return lines;
}

// ============================================================================
// BEHAVIOR FORMATTING
// ============================================================================

function formatBehaviorDiff(diff: BehaviorDiff, opts: Required<FormatOptions>): string[] {
  const { colors: useColors, indent, showSeverity, compact } = opts;
  const lines: string[] = [];

  const sym = changeSymbol(diff.change);
  const col = changeColor(diff.change, useColors);
  const sevSym = showSeverity ? ` [${severitySymbol(diff.severity)}]` : '';
  const sevCol = severityColor(diff.severity, useColors);

  lines.push(
    `${indent}${color(sym, col, useColors)} behavior ${color(diff.name, COLORS.bold, useColors)}${color(sevSym, sevCol, useColors)}`
  );

  if (diff.change === 'changed') {
    // Description change
    if (diff.descriptionChanged) {
      lines.push(
        `${indent}${indent}${color('~', COLORS.yellow, useColors)} description changed`
      );
    }

    // Input changes
    if (diff.inputDiff.changed && diff.inputDiff.fieldChanges.length > 0) {
      lines.push(`${indent}${indent}${color('input:', COLORS.dim, useColors)}`);
      for (const fc of diff.inputDiff.fieldChanges) {
        lines.push(formatFieldChange(fc, opts));
      }
    }

    // Output changes
    if (diff.outputDiff.changed) {
      lines.push(`${indent}${indent}${color('output:', COLORS.dim, useColors)}`);
      if (diff.outputDiff.successTypeChanged) {
        lines.push(
          `${indent}${indent}${indent}${color('~', COLORS.yellow, useColors)} success: ${diff.outputDiff.oldSuccessType} ${SYMBOLS.arrow} ${diff.outputDiff.newSuccessType}`
        );
      }
      for (const ec of diff.outputDiff.errorChanges) {
        lines.push(formatErrorChange(ec, opts));
      }
    }

    // Clause changes
    const clauseGroups = [
      { name: 'preconditions', changes: diff.preconditionChanges },
      { name: 'postconditions', changes: diff.postconditionChanges },
      { name: 'invariants', changes: diff.invariantChanges },
      { name: 'temporal', changes: diff.temporalChanges },
      { name: 'security', changes: diff.securityChanges },
    ];

    for (const group of clauseGroups) {
      if (group.changes.length > 0) {
        lines.push(`${indent}${indent}${color(`${group.name}:`, COLORS.dim, useColors)}`);
        for (const cc of group.changes) {
          lines.push(formatClauseChange(cc, opts));
        }
      }
    }
  }

  if (!compact) {
    lines.push('');
  }

  return lines;
}

// ============================================================================
// TYPE FORMATTING
// ============================================================================

function formatTypeDiff(diff: TypeDiff, opts: Required<FormatOptions>): string[] {
  const { colors: useColors, indent, showSeverity } = opts;
  const lines: string[] = [];

  const sym = changeSymbol(diff.change);
  const col = changeColor(diff.change, useColors);
  const sevSym = showSeverity ? ` [${severitySymbol(diff.severity)}]` : '';
  const sevCol = severityColor(diff.severity, useColors);

  lines.push(
    `${indent}${color(sym, col, useColors)} type ${color(diff.name, COLORS.bold, useColors)}${color(sevSym, sevCol, useColors)}`
  );

  if (diff.definitionChanged) {
    lines.push(
      `${indent}${indent}${diff.oldDefinition} ${SYMBOLS.arrow} ${diff.newDefinition}`
    );
  }

  return lines;
}

// ============================================================================
// SUMMARY FORMATTING
// ============================================================================

function formatSummary(diff: DomainDiff, opts: Required<FormatOptions>): string[] {
  const { colors: useColors } = opts;
  const lines: string[] = [];
  const s = diff.summary;

  lines.push('');
  lines.push(color('═'.repeat(60), COLORS.dim, useColors));
  lines.push(color('SUMMARY', COLORS.bold, useColors));
  lines.push(color('─'.repeat(60), COLORS.dim, useColors));

  // Entities
  if (s.entitiesAdded + s.entitiesRemoved + s.entitiesChanged > 0) {
    const parts: string[] = [];
    if (s.entitiesAdded > 0) parts.push(color(`+${s.entitiesAdded}`, COLORS.green, useColors));
    if (s.entitiesRemoved > 0) parts.push(color(`-${s.entitiesRemoved}`, COLORS.red, useColors));
    if (s.entitiesChanged > 0) parts.push(color(`~${s.entitiesChanged}`, COLORS.yellow, useColors));
    lines.push(`Entities:  ${parts.join(' ')}`);
  }

  // Behaviors
  if (s.behaviorsAdded + s.behaviorsRemoved + s.behaviorsChanged > 0) {
    const parts: string[] = [];
    if (s.behaviorsAdded > 0) parts.push(color(`+${s.behaviorsAdded}`, COLORS.green, useColors));
    if (s.behaviorsRemoved > 0) parts.push(color(`-${s.behaviorsRemoved}`, COLORS.red, useColors));
    if (s.behaviorsChanged > 0) parts.push(color(`~${s.behaviorsChanged}`, COLORS.yellow, useColors));
    lines.push(`Behaviors: ${parts.join(' ')}`);
  }

  // Types
  if (s.typesAdded + s.typesRemoved + s.typesChanged > 0) {
    const parts: string[] = [];
    if (s.typesAdded > 0) parts.push(color(`+${s.typesAdded}`, COLORS.green, useColors));
    if (s.typesRemoved > 0) parts.push(color(`-${s.typesRemoved}`, COLORS.red, useColors));
    if (s.typesChanged > 0) parts.push(color(`~${s.typesChanged}`, COLORS.yellow, useColors));
    lines.push(`Types:     ${parts.join(' ')}`);
  }

  lines.push('');

  // Severity breakdown
  if (s.breakingChanges > 0) {
    lines.push(color(`! ${s.breakingChanges} breaking change(s)`, COLORS.red, useColors));
  }
  if (s.compatibleChanges > 0) {
    lines.push(color(`• ${s.compatibleChanges} compatible change(s)`, COLORS.yellow, useColors));
  }
  if (s.patchChanges > 0) {
    lines.push(color(`· ${s.patchChanges} patch change(s)`, COLORS.green, useColors));
  }

  lines.push(color('═'.repeat(60), COLORS.dim, useColors));

  return lines;
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format a domain diff for display.
 *
 * @param diff - The diff to format
 * @param options - Formatting options
 * @returns Stable, formatted text suitable for terminal or UI display
 */
export function formatDiff(diff: DomainDiff, options: FormatOptions = {}): string {
  const opts: Required<FormatOptions> = { ...DEFAULT_OPTIONS, ...options };
  const { colors: useColors, showSummary, compact } = opts;

  if (diff.isEmpty) {
    return color('No changes detected.', COLORS.dim, useColors);
  }

  const lines: string[] = [];

  // Header
  lines.push(color(`Diff for domain: ${diff.domainName}`, COLORS.bold, useColors));

  // Version change
  if (diff.versionChange) {
    lines.push(
      `${color('~', COLORS.yellow, useColors)} version: ${diff.versionChange.oldVersion} ${SYMBOLS.arrow} ${diff.versionChange.newVersion}`
    );
  }

  if (!compact) {
    lines.push('');
  }

  // Entity diffs
  if (diff.entityDiffs.length > 0) {
    lines.push(color('ENTITIES', COLORS.cyan, useColors));
    for (const entityDiff of diff.entityDiffs) {
      lines.push(...formatEntityDiff(entityDiff, opts));
    }
    if (!compact) {
      lines.push('');
    }
  }

  // Behavior diffs
  if (diff.behaviorDiffs.length > 0) {
    lines.push(color('BEHAVIORS', COLORS.cyan, useColors));
    for (const behaviorDiff of diff.behaviorDiffs) {
      lines.push(...formatBehaviorDiff(behaviorDiff, opts));
    }
  }

  // Type diffs
  if (diff.typeDiffs.length > 0) {
    lines.push(color('TYPES', COLORS.cyan, useColors));
    for (const typeDiff of diff.typeDiffs) {
      lines.push(...formatTypeDiff(typeDiff, opts));
    }
    if (!compact) {
      lines.push('');
    }
  }

  // Summary
  if (showSummary) {
    lines.push(...formatSummary(diff, opts));
  }

  return lines.join('\n');
}

/**
 * Format diff as JSON for programmatic consumption.
 *
 * @param diff - The diff to format
 * @param pretty - Whether to pretty-print the JSON
 * @returns JSON string representation of the diff
 */
export function formatDiffJson(diff: DomainDiff, pretty = true): string {
  return JSON.stringify(diff, null, pretty ? 2 : 0);
}

/**
 * Format a compact one-line summary of the diff.
 *
 * @param diff - The diff to summarize
 * @returns A single line summary
 */
export function formatDiffOneLine(diff: DomainDiff): string {
  if (diff.isEmpty) {
    return 'No changes';
  }

  const s = diff.summary;
  const parts: string[] = [];

  if (s.entitiesAdded > 0) parts.push(`+${s.entitiesAdded}E`);
  if (s.entitiesRemoved > 0) parts.push(`-${s.entitiesRemoved}E`);
  if (s.entitiesChanged > 0) parts.push(`~${s.entitiesChanged}E`);
  if (s.behaviorsAdded > 0) parts.push(`+${s.behaviorsAdded}B`);
  if (s.behaviorsRemoved > 0) parts.push(`-${s.behaviorsRemoved}B`);
  if (s.behaviorsChanged > 0) parts.push(`~${s.behaviorsChanged}B`);
  if (s.typesAdded > 0) parts.push(`+${s.typesAdded}T`);
  if (s.typesRemoved > 0) parts.push(`-${s.typesRemoved}T`);
  if (s.typesChanged > 0) parts.push(`~${s.typesChanged}T`);

  const severity = s.breakingChanges > 0
    ? `[!${s.breakingChanges} breaking]`
    : '';

  return `${diff.domainName}: ${parts.join(' ')} ${severity}`.trim();
}
