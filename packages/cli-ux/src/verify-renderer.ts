/**
 * Verification Table Renderer
 *
 * Renders clause-level verification results as a clear table with:
 * - Clause ID + text
 * - TRUE/FALSE/UNKNOWN verdict
 * - Evidence reference
 * - Remediation for UNKNOWN clauses
 */

import chalk, { type ChalkInstance } from 'chalk';
import type {
  VerifyResult,
  VerifyClauseResult,
  VerifyRenderOptions,
  ClauseVerdict,
  OverallVerdict,
  EvidenceRef,
  UnknownReason,
} from './verify-types.js';
import { DEFAULT_VERIFY_RENDER_OPTIONS } from './verify-types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Color Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface VerifyColorScheme {
  success: ChalkInstance;
  error: ChalkInstance;
  warning: ChalkInstance;
  info: ChalkInstance;
  dim: ChalkInstance;
  bold: ChalkInstance;
  verdictTrue: ChalkInstance;
  verdictFalse: ChalkInstance;
  verdictUnknown: ChalkInstance;
  header: ChalkInstance;
  clauseId: ChalkInstance;
  evidence: ChalkInstance;
}

function getColors(enabled: boolean): VerifyColorScheme {
  if (!enabled) {
    const identity = chalk.reset;
    return {
      success: identity,
      error: identity,
      warning: identity,
      info: identity,
      dim: identity,
      bold: identity,
      verdictTrue: identity,
      verdictFalse: identity,
      verdictUnknown: identity,
      header: identity,
      clauseId: identity,
      evidence: identity,
    };
  }
  return {
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    info: chalk.cyan,
    dim: chalk.gray,
    bold: chalk.bold,
    verdictTrue: chalk.bgGreen.black.bold,
    verdictFalse: chalk.bgRed.white.bold,
    verdictUnknown: chalk.bgYellow.black.bold,
    header: chalk.bold.cyan,
    clauseId: chalk.magenta,
    evidence: chalk.blue,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Header Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the verification header with overall verdict
 */
export function renderVerifyHeader(result: VerifyResult, options: VerifyRenderOptions = {}): string {
  const opts = { ...DEFAULT_VERIFY_RENDER_OPTIONS, ...options };
  const c = getColors(opts.colors);
  const lines: string[] = [];

  const width = Math.min(opts.terminalWidth, 100);

  // Top border
  lines.push(c.dim('╔' + '═'.repeat(width - 2) + '╗'));

  // Title
  const title = ` ISL Verification: ${result.specName} `;
  const padding = Math.floor((width - title.length - 2) / 2);
  lines.push(
    c.dim('║') +
      ' '.repeat(padding) +
      c.bold(title) +
      ' '.repeat(width - padding - title.length - 2) +
      c.dim('║')
  );

  // Separator
  lines.push(c.dim('╟' + '─'.repeat(width - 2) + '╢'));

  // Verdict line
  const verdictBadge = getVerdictBadge(result.verdict, c);
  const verdictLine = `  Verdict: ${verdictBadge}`;
  const verdictRaw = `  Verdict: ${result.verdict}`;
  lines.push(
    c.dim('║') + verdictLine + ' '.repeat(width - verdictRaw.length - 2) + c.dim('║')
  );

  // Summary line
  const summaryText = `  ${c.success(result.summary.proven.toString())} proven  ${c.error(result.summary.failed.toString())} failed  ${c.warning(result.summary.unknown.toString())} unknown  (${result.summary.total} total)`;
  const summaryRaw = `  ${result.summary.proven} proven  ${result.summary.failed} failed  ${result.summary.unknown} unknown  (${result.summary.total} total)`;
  lines.push(
    c.dim('║') + summaryText + ' '.repeat(width - summaryRaw.length - 2) + c.dim('║')
  );

  // Duration and file
  const fileText = `  File: ${c.info(result.specFile)}`;
  const fileRaw = `  File: ${result.specFile}`;
  lines.push(
    c.dim('║') + fileText + ' '.repeat(Math.max(0, width - fileRaw.length - 2)) + c.dim('║')
  );

  const durationText = `  Duration: ${result.durationMs}ms`;
  lines.push(
    c.dim('║') + c.dim(durationText) + ' '.repeat(width - durationText.length - 2) + c.dim('║')
  );

  // Bottom border
  lines.push(c.dim('╚' + '═'.repeat(width - 2) + '╝'));

  return lines.join('\n');
}

function getVerdictBadge(verdict: OverallVerdict, c: VerifyColorScheme): string {
  switch (verdict) {
    case 'PROVEN':
      return c.verdictTrue(` PROVEN `);
    case 'FAILED':
      return c.verdictFalse(` FAILED `);
    case 'INCOMPLETE_PROOF':
      return c.verdictUnknown(` INCOMPLETE `);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the clause verification table
 */
export function renderVerifyTable(result: VerifyResult, options: VerifyRenderOptions = {}): string {
  const opts = { ...DEFAULT_VERIFY_RENDER_OPTIONS, ...options };
  const c = getColors(opts.colors);
  const lines: string[] = [];

  // Filter clauses if needed
  let clauses = result.clauses;
  if (opts.filterBehavior) {
    clauses = clauses.filter((cl) => cl.behavior === opts.filterBehavior);
  }
  if (opts.filterType) {
    clauses = clauses.filter((cl) => cl.clauseType === opts.filterType);
  }

  if (clauses.length === 0) {
    lines.push(c.dim('No clauses to display.'));
    return lines.join('\n');
  }

  // Table header
  lines.push('');
  lines.push(c.header('┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐'));
  lines.push(c.header('│ CLAUSE ID              │ CLAUSE TEXT                                    │ VERDICT  │ EVIDENCE           │'));
  lines.push(c.header('├────────────────────────┼────────────────────────────────────────────────┼──────────┼────────────────────┤'));

  // Table rows
  for (const clause of clauses) {
    lines.push(renderClauseRow(clause, c, opts));
  }

  // Table footer
  lines.push(c.header('└────────────────────────┴────────────────────────────────────────────────┴──────────┴────────────────────┘'));

  return lines.join('\n');
}

function renderClauseRow(
  clause: VerifyClauseResult,
  c: VerifyColorScheme,
  opts: Required<VerifyRenderOptions>
): string {
  // Format each column
  const idCol = formatColumn(clause.clauseId, 20, c.clauseId);
  const textCol = formatColumn(clause.clauseText, 44, c.dim);
  const verdictCol = formatVerdictCell(clause.verdict, c);
  const evidenceCol = formatEvidenceColumn(clause.evidence, c);

  return c.dim('│ ') + idCol + c.dim(' │ ') + textCol + c.dim(' │ ') + verdictCol + c.dim(' │ ') + evidenceCol + c.dim(' │');
}

function formatColumn(text: string, width: number, colorFn: ChalkInstance): string {
  const truncated = text.length > width ? text.slice(0, width - 3) + '...' : text;
  return colorFn(truncated.padEnd(width));
}

function formatVerdictCell(verdict: ClauseVerdict, c: VerifyColorScheme): string {
  const width = 8;
  switch (verdict) {
    case 'TRUE':
      return c.success('TRUE'.padEnd(width));
    case 'FALSE':
      return c.error('FALSE'.padEnd(width));
    case 'UNKNOWN':
      return c.warning('UNKNOWN'.padEnd(width));
  }
}

function formatEvidenceColumn(evidence: EvidenceRef, c: VerifyColorScheme): string {
  const width = 18;
  switch (evidence.type) {
    case 'trace_slice':
      return c.evidence(`trace:${evidence.behavior}`.slice(0, width).padEnd(width));
    case 'adapter_snapshot':
      return c.evidence(`snap:${evidence.adapter}`.slice(0, width).padEnd(width));
    case 'none':
      return c.dim('(none)'.padEnd(width));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Details Renderer (for UNKNOWN and FAILED clauses)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render detailed information for non-TRUE clauses
 */
export function renderVerifyDetails(result: VerifyResult, options: VerifyRenderOptions = {}): string {
  const opts = { ...DEFAULT_VERIFY_RENDER_OPTIONS, ...options };
  const c = getColors(opts.colors);
  const lines: string[] = [];

  // Failed clauses
  const failed = result.clauses.filter((cl) => cl.verdict === 'FALSE');
  if (failed.length > 0) {
    lines.push('');
    lines.push(c.error.bold('✗ Failed Clauses'));
    lines.push(c.dim('─'.repeat(80)));
    
    for (const clause of failed) {
      lines.push(renderFailedClause(clause, c, opts));
      lines.push('');
    }
  }

  // Unknown clauses
  const unknown = result.clauses.filter((cl) => cl.verdict === 'UNKNOWN');
  if (unknown.length > 0) {
    lines.push('');
    lines.push(c.warning.bold('? Unknown Clauses (require additional data)'));
    lines.push(c.dim('─'.repeat(80)));
    
    for (const clause of unknown) {
      lines.push(renderUnknownClause(clause, c, opts));
      lines.push('');
    }
  }

  return lines.join('\n');
}

function renderFailedClause(
  clause: VerifyClauseResult,
  c: VerifyColorScheme,
  opts: Required<VerifyRenderOptions>
): string {
  const lines: string[] = [];

  // Clause header
  lines.push(`  ${c.clauseId(clause.clauseId)} ${c.dim(`[${clause.clauseType}]`)}`);
  
  // Source location
  if (opts.showSource) {
    lines.push(`  ${c.dim('at')} ${c.info(clause.source.file)}:${c.dim(clause.source.line.toString())}`);
  }

  // Clause text
  lines.push(`  ${c.dim('Clause:')} ${clause.clauseText}`);

  // Failure details
  if (clause.failureMessage) {
    lines.push(`  ${c.error('Error:')} ${clause.failureMessage}`);
  }

  if (clause.expected !== undefined && clause.actual !== undefined) {
    lines.push(`  ${c.dim('Expected:')} ${JSON.stringify(clause.expected)}`);
    lines.push(`  ${c.dim('Actual:')}   ${JSON.stringify(clause.actual)}`);
  }

  // Evidence
  if (opts.showEvidence && clause.evidence.type !== 'none') {
    lines.push(`  ${c.dim('Evidence:')} ${formatEvidenceDetail(clause.evidence, c)}`);
  }

  return lines.join('\n');
}

function renderUnknownClause(
  clause: VerifyClauseResult,
  c: VerifyColorScheme,
  opts: Required<VerifyRenderOptions>
): string {
  const lines: string[] = [];

  // Clause header
  lines.push(`  ${c.clauseId(clause.clauseId)} ${c.dim(`[${clause.clauseType}]`)}`);
  
  // Source location
  if (opts.showSource) {
    lines.push(`  ${c.dim('at')} ${c.info(clause.source.file)}:${c.dim(clause.source.line.toString())}`);
  }

  // Clause text
  lines.push(`  ${c.dim('Clause:')} ${clause.clauseText}`);

  // Reason
  if (clause.unknownReason) {
    lines.push(`  ${c.warning('Reason:')} [${clause.unknownReason.code}] ${clause.unknownReason.message}`);
    lines.push(`  ${c.info('To fix:')} ${clause.unknownReason.remediation}`);
  }

  return lines.join('\n');
}

function formatEvidenceDetail(evidence: EvidenceRef, c: VerifyColorScheme): string {
  switch (evidence.type) {
    case 'trace_slice':
      return `trace from ${c.evidence(evidence.behavior)} (${evidence.eventIds.length} events, ${evidence.endMs - evidence.startMs}ms)`;
    case 'adapter_snapshot':
      return `snapshot from ${c.evidence(evidence.adapter)} (${evidence.snapshotId})`;
    case 'none':
      return c.dim('none');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the exit summary
 */
export function renderVerifySummary(result: VerifyResult, options: VerifyRenderOptions = {}): string {
  const opts = { ...DEFAULT_VERIFY_RENDER_OPTIONS, ...options };
  const c = getColors(opts.colors);
  const lines: string[] = [];

  lines.push('');
  
  switch (result.verdict) {
    case 'PROVEN':
      lines.push(c.success.bold('✓ All clauses proven. Contract verified.'));
      lines.push(c.dim('  Exit code: 0 (PROVEN)'));
      break;
    case 'FAILED':
      lines.push(c.error.bold(`✗ ${result.summary.failed} clause(s) violated. Contract not satisfied.`));
      lines.push(c.dim('  Exit code: 1 (FAILED)'));
      break;
    case 'INCOMPLETE_PROOF':
      lines.push(c.warning.bold(`? ${result.summary.unknown} clause(s) could not be evaluated. Proof incomplete.`));
      lines.push(c.dim('  Exit code: 2 (INCOMPLETE_PROOF)'));
      break;
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Render
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render complete verification output
 */
export function renderVerify(result: VerifyResult, options: VerifyRenderOptions = {}): string {
  const parts: string[] = [];

  parts.push(renderVerifyHeader(result, options));
  parts.push(renderVerifyTable(result, options));
  parts.push(renderVerifyDetails(result, options));
  parts.push(renderVerifySummary(result, options));

  return parts.filter(Boolean).join('\n');
}

/**
 * Print rendered verification output to console
 */
export function printVerify(result: VerifyResult, options: VerifyRenderOptions = {}): void {
  const output = renderVerify(result, options);
  process.stdout.write(output + '\n');
}

/**
 * Get exit code for verification result
 */
export function getVerifyExitCode(result: VerifyResult): 0 | 1 | 2 {
  switch (result.verdict) {
    case 'PROVEN':
      return 0;
    case 'FAILED':
      return 1;
    case 'INCOMPLETE_PROOF':
      return 2;
  }
}
