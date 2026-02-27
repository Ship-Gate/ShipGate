// ============================================================================
// Failure Formatter - Human-friendly PBT failure output
// ============================================================================
//
// Produces output that shows the ISL element responsible for the failure,
// NOT "random seed: 123". Each failure report includes:
//   - Which ISL postcondition / invariant / precondition was violated
//   - The source location in the .isl file
//   - The minimal counterexample after shrinking
//   - A reproduction command (--seed)
//   - A diff between original and minimal input
// ============================================================================

import type * as AST from '@isl-lang/parser';
import type { Property } from './types.js';
import type { ISLAttribution, MinimalCounterexample, ScenarioIteration } from './scenario-runner.js';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * A structured failure report suitable for rendering in CLI, CI, or IDE.
 */
export interface FailureReport {
  /** One-line summary of the failure */
  summary: string;
  /** The ISL element that was violated */
  attribution: ISLAttribution;
  /** Minimal counterexample input */
  minimalInput: Record<string, unknown>;
  /** Original (un-shrunk) failing input */
  originalInput: Record<string, unknown>;
  /** Fields that were shrunk, with before → after */
  shrunkFields: ShrunkField[];
  /** Number of shrink steps taken */
  shrinkSteps: number;
  /** Reproduction seed */
  seed: number;
  /** Full formatted text */
  text: string;
}

export interface ShrunkField {
  name: string;
  original: unknown;
  shrunk: unknown;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Build a human-friendly failure report from a PBT scenario failure.
 */
export function formatFailure(
  failure: ScenarioIteration,
  counterexample: MinimalCounterexample | undefined,
  seed: number,
  behaviorName: string,
  domainName: string,
): FailureReport {
  const attribution = failure.attribution ?? {
    elementKind: 'postcondition' as const,
    expression: failure.error ?? 'unknown',
    location: { file: '<unknown>', line: 0, column: 0, endLine: 0, endColumn: 0 },
  };

  const minimalInput = counterexample?.input ?? failure.input;
  const originalInput = counterexample?.originalInput ?? failure.input;
  const shrinkSteps = counterexample?.shrinkSteps ?? 0;

  const shrunkFields = computeShrunkFields(originalInput, minimalInput);

  const text = renderText(
    behaviorName,
    domainName,
    failure,
    attribution,
    minimalInput,
    originalInput,
    shrunkFields,
    shrinkSteps,
    seed,
  );

  return {
    summary: buildSummary(behaviorName, attribution),
    attribution,
    minimalInput,
    originalInput,
    shrunkFields,
    shrinkSteps,
    seed,
    text,
  };
}

/**
 * Format a failure report for JSON output (CI-friendly).
 */
export function formatFailureJSON(report: FailureReport): Record<string, unknown> {
  return {
    summary: report.summary,
    attribution: {
      kind: report.attribution.elementKind,
      expression: report.attribution.expression,
      location: `${report.attribution.location.file}:${report.attribution.location.line}:${report.attribution.location.column}`,
      guard: report.attribution.guard ?? null,
    },
    minimalInput: report.minimalInput,
    originalInput: report.originalInput,
    shrunkFields: report.shrunkFields,
    shrinkSteps: report.shrinkSteps,
    seed: report.seed,
  };
}

// ============================================================================
// TEXT RENDERING
// ============================================================================

function renderText(
  behaviorName: string,
  domainName: string,
  failure: ScenarioIteration,
  attribution: ISLAttribution,
  minimalInput: Record<string, unknown>,
  originalInput: Record<string, unknown>,
  shrunkFields: ShrunkField[],
  shrinkSteps: number,
  seed: number,
): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('┌──────────────────────────────────────────────────────────────┐');
  lines.push(`│  PBT FAILURE: ${behaviorName}`.padEnd(63) + '│');
  lines.push(`│  Domain: ${domainName}`.padEnd(63) + '│');
  lines.push('└──────────────────────────────────────────────────────────────┘');
  lines.push('');

  // Responsible ISL element (the key differentiator from "seed: 123")
  lines.push('  VIOLATED ISL ELEMENT:');
  lines.push(`  ┌─ ${attribution.elementKind.toUpperCase()}`);
  lines.push(`  │  Expression: ${attribution.expression}`);
  lines.push(`  │  File:       ${attribution.location.file}`);
  lines.push(`  │  Line:       ${attribution.location.line}:${attribution.location.column} → ${attribution.location.endLine}:${attribution.location.endColumn}`);
  if (attribution.guard) {
    lines.push(`  │  Guard:      ${attribution.guard}`);
  }
  lines.push(`  └──────────`);
  lines.push('');

  // Error message
  if (failure.error) {
    lines.push(`  Error: ${failure.error}`);
    lines.push('');
  }

  // Minimal counterexample
  lines.push('  MINIMAL COUNTEREXAMPLE:');
  for (const [key, value] of Object.entries(minimalInput)) {
    if (value === undefined) continue;
    const isShrunk = shrunkFields.some((f) => f.name === key);
    const marker = isShrunk ? ' ← shrunk' : '';
    lines.push(`    ${key}: ${formatValue(value)}${marker}`);
  }
  lines.push('');

  // Shrink diff (if any shrinking occurred)
  if (shrinkSteps > 0 && shrunkFields.length > 0) {
    lines.push(`  SHRINK DIFF (${shrinkSteps} steps):`);
    for (const field of shrunkFields) {
      lines.push(`    ${field.name}:`);
      lines.push(`      before: ${formatValue(field.original)}`);
      lines.push(`      after:  ${formatValue(field.shrunk)}`);
    }
    lines.push('');
  }

  // Reproduction
  lines.push('  REPRODUCE:');
  lines.push(`    isl-pbt --seed ${seed} --behavior ${behaviorName}`);
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// UTILITIES
// ============================================================================

function buildSummary(behaviorName: string, attribution: ISLAttribution): string {
  const kind = attribution.elementKind;
  const guardStr = attribution.guard ? ` [${attribution.guard}]` : '';
  return `${behaviorName}: ${kind}${guardStr} violated — ${attribution.expression} (${attribution.location.file}:${attribution.location.line})`;
}

function computeShrunkFields(
  original: Record<string, unknown>,
  minimal: Record<string, unknown>,
): ShrunkField[] {
  const fields: ShrunkField[] = [];
  for (const key of Object.keys(original)) {
    const orig = original[key];
    const min = minimal[key];
    if (!deepEqual(orig, min)) {
      fields.push({ name: key, original: orig, shrunk: min });
    }
  }
  return fields;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    const display = value.length > 80 ? value.slice(0, 80) + '…' : value;
    return `"${display}"`;
  }
  if (typeof value === 'object' && value !== null) {
    const json = JSON.stringify(value);
    return json.length > 120 ? json.slice(0, 120) + '…' : json;
  }
  return String(value);
}
