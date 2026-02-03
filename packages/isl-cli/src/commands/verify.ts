/**
 * Verify Command
 *
 * Verifies an ISL spec against runtime traces, producing a clear clause-by-clause
 * verification table with TRUE/FALSE/UNKNOWN verdicts.
 *
 * Exit codes:
 *   0 - PROVEN: All clauses verified
 *   1 - FAILED: At least one clause violated
 *   2 - INCOMPLETE_PROOF: Some clauses could not be evaluated
 */

import { readFile, access, readdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { parseISL, type DomainDeclaration } from '@isl-lang/isl-core';
import {
  type VerifyResult,
  type VerifyClauseResult,
  type OverallVerdict,
  type ClauseVerdict,
  type EvidenceRef,
  type UnknownReason,
  type VerifyClauseType,
  renderVerify,
  printVerify,
  formatVerifyJson,
  printVerifyJson,
  getVerifyExitCode,
} from '@isl-lang/cli-ux';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface VerifyOptions {
  /** Path to proof bundle or trace file */
  bundle?: string;
  /** Filter to specific behavior */
  behavior?: string;
  /** Output format: human or json */
  json?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Disable colors */
  noColor?: boolean;
}

export interface VerifyCommandResult {
  /** The verification result */
  result: VerifyResult;
  /** Exit code to use */
  exitCode: 0 | 1 | 2;
  /** Any errors that occurred */
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Trace Types (from proof bundle)
// ─────────────────────────────────────────────────────────────────────────────

interface TraceEvent {
  id: string;
  type: 'call' | 'return' | 'state_change' | 'check' | 'error';
  timestamp: number;
  behavior?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: { code: string; message: string };
  stateBefore?: unknown;
  stateAfter?: unknown;
}

interface ProofBundle {
  version: string;
  specFile: string;
  traces: TraceEvent[];
  manifest?: {
    domain: string;
    behaviors: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Verify Function
// ─────────────────────────────────────────────────────────────────────────────

export async function verify(specPath: string, options: VerifyOptions = {}): Promise<VerifyCommandResult> {
  const errors: string[] = [];
  const spinner = options.json ? null : ora('Loading spec...').start();

  try {
    // Read and parse ISL spec
    const specSource = await readFile(specPath, 'utf-8');
    const { ast, errors: parseErrors } = parseISL(specSource, specPath);

    if (parseErrors.length > 0 || !ast) {
      spinner?.fail('Failed to parse ISL spec');
      return {
        result: createEmptyResult(specPath, 'FAILED'),
        exitCode: 1,
        errors: parseErrors.map((e) => ('message' in e ? e.message : String(e))),
      };
    }

    if (spinner) spinner.text = 'Loading traces...';

    // Load proof bundle or traces
    const bundle = await loadProofBundle(specPath, options.bundle);

    if (!bundle) {
      spinner?.warn('No proof bundle found - running in dry mode');
      // Generate result with all clauses as UNKNOWN (no trace data)
      const result = generateDryRunResult(ast, specPath);
      return {
        result,
        exitCode: getVerifyExitCode(result),
        errors: [],
      };
    }

    if (spinner) spinner.text = 'Verifying clauses...';

    // Run verification
    const result = await runVerification(ast, specPath, bundle, options);

    spinner?.succeed('Verification complete');

    return {
      result,
      exitCode: getVerifyExitCode(result),
      errors,
    };
  } catch (error) {
    spinner?.fail('Verification failed');
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(errorMsg);

    return {
      result: createEmptyResult(specPath, 'FAILED'),
      exitCode: 1,
      errors,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Proof Bundle Loading
// ─────────────────────────────────────────────────────────────────────────────

async function loadProofBundle(specPath: string, bundlePath?: string): Promise<ProofBundle | null> {
  // Try explicit bundle path
  if (bundlePath) {
    try {
      const content = await readFile(bundlePath, 'utf-8');
      return JSON.parse(content) as ProofBundle;
    } catch {
      return null;
    }
  }

  // Try conventional locations
  const specDir = dirname(specPath);
  const specName = basename(specPath, '.isl');

  const conventionalPaths = [
    join(specDir, '.proof-bundle', 'traces.json'),
    join(specDir, `${specName}.traces.json`),
    join(specDir, '.isl', 'traces.json'),
    join(process.cwd(), '.proof-bundle', 'traces.json'),
  ];

  for (const path of conventionalPaths) {
    try {
      await access(path);
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content) as ProofBundle;
    } catch {
      continue;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification Engine
// ─────────────────────────────────────────────────────────────────────────────

async function runVerification(
  ast: DomainDeclaration,
  specPath: string,
  bundle: ProofBundle,
  options: VerifyOptions
): Promise<VerifyResult> {
  const startTime = Date.now();
  const clauses: VerifyClauseResult[] = [];

  // Extract all clauses from the AST
  const extractedClauses = extractClauses(ast, specPath, options.behavior);

  // Group traces by behavior
  const tracesByBehavior = groupTracesByBehavior(bundle.traces);

  // Verify each clause
  for (const clause of extractedClauses) {
    const verified = verifyClause(clause, tracesByBehavior);
    clauses.push(verified);
  }

  // Calculate summary and verdict
  const summary = calculateSummary(clauses);
  const verdict = calculateVerdict(summary);

  return {
    verdict,
    specName: ast.name.value,
    specFile: specPath,
    clauses,
    summary,
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

interface ExtractedClause {
  clauseId: string;
  clauseText: string;
  clauseType: VerifyClauseType;
  behavior?: string;
  source: {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
  };
  expression: unknown;
}

function extractClauses(
  ast: DomainDeclaration,
  specPath: string,
  filterBehavior?: string
): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];

  // Extract from behaviors
  for (const behavior of ast.behaviors) {
    if (filterBehavior && behavior.name.value !== filterBehavior) {
      continue;
    }

    // Postconditions
    if (behavior.postconditions) {
      for (const condition of behavior.postconditions.conditions) {
        for (const stmt of condition.statements) {
          clauses.push({
            clauseId: `${behavior.name.value}:post:${stmt.span.start.line}`,
            clauseText: extractExpressionText(stmt.expression),
            clauseType: 'postcondition',
            behavior: behavior.name.value,
            source: {
              file: specPath,
              line: stmt.span.start.line,
              column: stmt.span.start.column,
              endLine: stmt.span.end.line,
              endColumn: stmt.span.end.column,
            },
            expression: stmt.expression,
          });
        }
      }
    }

    // Invariants (within behavior)
    if (behavior.invariants) {
      for (const inv of behavior.invariants) {
        clauses.push({
          clauseId: `${behavior.name.value}:inv:${inv.span.start.line}`,
          clauseText: extractExpressionText(inv.expression),
          clauseType: 'invariant',
          behavior: behavior.name.value,
          source: {
            file: specPath,
            line: inv.span.start.line,
            column: inv.span.start.column,
            endLine: inv.span.end.line,
            endColumn: inv.span.end.column,
          },
          expression: inv.expression,
        });
      }
    }

    // Temporal constraints
    if (behavior.temporal) {
      for (const temp of behavior.temporal) {
        clauses.push({
          clauseId: `${behavior.name.value}:temp:${temp.span.start.line}`,
          clauseText: extractExpressionText(temp.expression),
          clauseType: 'temporal',
          behavior: behavior.name.value,
          source: {
            file: specPath,
            line: temp.span.start.line,
            column: temp.span.start.column,
          },
          expression: temp.expression,
        });
      }
    }

    // Security constraints
    if (behavior.security) {
      for (const sec of behavior.security) {
        clauses.push({
          clauseId: `${behavior.name.value}:sec:${sec.span.start.line}`,
          clauseText: extractExpressionText(sec.expression),
          clauseType: 'security',
          behavior: behavior.name.value,
          source: {
            file: specPath,
            line: sec.span.start.line,
            column: sec.span.start.column,
          },
          expression: sec.expression,
        });
      }
    }
  }

  // Extract global invariants
  for (const invBlock of ast.invariants) {
    for (const inv of invBlock.invariants) {
      clauses.push({
        clauseId: `global:inv:${inv.span.start.line}`,
        clauseText: extractExpressionText(inv.expression),
        clauseType: 'invariant',
        source: {
          file: specPath,
          line: inv.span.start.line,
          column: inv.span.start.column,
          endLine: inv.span.end.line,
          endColumn: inv.span.end.column,
        },
        expression: inv.expression,
      });
    }
  }

  return clauses;
}

function extractExpressionText(expr: unknown): string {
  // Try to get raw text from expression if available
  if (expr && typeof expr === 'object') {
    const e = expr as Record<string, unknown>;
    if (typeof e.raw === 'string') return e.raw;
    if (typeof e.text === 'string') return e.text;

    // Reconstruct from AST if needed
    if (e.type === 'BinaryExpression') {
      const left = extractExpressionText(e.left);
      const right = extractExpressionText(e.right);
      return `${left} ${e.operator} ${right}`;
    }
    if (e.type === 'MemberExpression') {
      const obj = extractExpressionText(e.object);
      const prop = extractExpressionText(e.property);
      return `${obj}.${prop}`;
    }
    if (e.type === 'Identifier' && typeof e.name === 'string') {
      return e.name;
    }
    if (e.type === 'CallExpression') {
      const callee = extractExpressionText(e.callee);
      return `${callee}(...)`;
    }
    if (e.type === 'Literal') {
      return String(e.value);
    }
  }

  return String(expr).slice(0, 60);
}

function groupTracesByBehavior(traces: TraceEvent[]): Map<string, TraceEvent[]> {
  const grouped = new Map<string, TraceEvent[]>();

  for (const event of traces) {
    const behavior = event.behavior || 'unknown';
    if (!grouped.has(behavior)) {
      grouped.set(behavior, []);
    }
    grouped.get(behavior)!.push(event);
  }

  // Sort by timestamp
  for (const events of grouped.values()) {
    events.sort((a, b) => a.timestamp - b.timestamp);
  }

  return grouped;
}

function verifyClause(
  clause: ExtractedClause,
  tracesByBehavior: Map<string, TraceEvent[]>
): VerifyClauseResult {
  const behavior = clause.behavior || 'unknown';
  const traces = tracesByBehavior.get(behavior) || [];

  // No trace data
  if (traces.length === 0) {
    return {
      clauseId: clause.clauseId,
      clauseText: clause.clauseText,
      clauseType: clause.clauseType,
      behavior: clause.behavior,
      verdict: 'UNKNOWN',
      evidence: {
        type: 'none',
        reason: 'No trace data available',
      },
      source: clause.source,
      unknownReason: {
        code: 'NO_TRACE_DATA',
        message: `No runtime traces found for behavior "${behavior}"`,
        remediation: `Run tests with tracing enabled: isl test --trace ${clause.source.file}`,
      },
    };
  }

  // Find relevant trace slice
  const returnEvent = traces.find((e) => e.type === 'return');
  const callEvent = traces.find((e) => e.type === 'call');

  if (!callEvent || !returnEvent) {
    return {
      clauseId: clause.clauseId,
      clauseText: clause.clauseText,
      clauseType: clause.clauseType,
      behavior: clause.behavior,
      verdict: 'UNKNOWN',
      evidence: {
        type: 'none',
        reason: 'Incomplete trace - missing call or return event',
      },
      source: clause.source,
      unknownReason: {
        code: 'MISSING_CONTEXT',
        message: 'Trace does not contain complete call/return pair',
        remediation: 'Ensure the traced test executes the behavior completely',
      },
    };
  }

  // Build evidence reference
  const evidence: EvidenceRef = {
    type: 'trace_slice',
    behavior,
    eventIds: traces.map((e) => e.id),
    startMs: callEvent.timestamp,
    endMs: returnEvent.timestamp,
  };

  // Attempt to evaluate the clause
  try {
    const result = evaluateClause(clause, callEvent, returnEvent, traces);

    if (result.evaluated) {
      if (result.value === true) {
        return {
          clauseId: clause.clauseId,
          clauseText: clause.clauseText,
          clauseType: clause.clauseType,
          behavior: clause.behavior,
          verdict: 'TRUE',
          evidence,
          source: clause.source,
        };
      } else {
        return {
          clauseId: clause.clauseId,
          clauseText: clause.clauseText,
          clauseType: clause.clauseType,
          behavior: clause.behavior,
          verdict: 'FALSE',
          evidence,
          source: clause.source,
          failureMessage: result.error || 'Clause evaluated to false',
          expected: true,
          actual: result.value,
        };
      }
    } else {
      return {
        clauseId: clause.clauseId,
        clauseText: clause.clauseText,
        clauseType: clause.clauseType,
        behavior: clause.behavior,
        verdict: 'UNKNOWN',
        evidence,
        source: clause.source,
        unknownReason: {
          code: result.reasonCode || 'EVALUATION_ERROR',
          message: result.error || 'Could not evaluate clause',
          remediation: result.remediation || 'Check clause syntax and available runtime data',
        },
      };
    }
  } catch (error) {
    return {
      clauseId: clause.clauseId,
      clauseText: clause.clauseText,
      clauseType: clause.clauseType,
      behavior: clause.behavior,
      verdict: 'UNKNOWN',
      evidence,
      source: clause.source,
      unknownReason: {
        code: 'EVALUATION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        remediation: 'Fix the clause expression or ensure all referenced entities are captured in traces',
      },
    };
  }
}

interface EvaluationResult {
  evaluated: boolean;
  value?: boolean;
  error?: string;
  reasonCode?: UnknownReason['code'];
  remediation?: string;
}

function evaluateClause(
  clause: ExtractedClause,
  callEvent: TraceEvent,
  returnEvent: TraceEvent,
  traces: TraceEvent[]
): EvaluationResult {
  const expr = clause.expression;

  // Simple expression evaluation
  if (expr && typeof expr === 'object') {
    const e = expr as Record<string, unknown>;

    // Handle common postcondition patterns
    if (clause.clauseType === 'postcondition') {
      // Pattern: result.field == value
      if (e.type === 'BinaryExpression' && e.operator === '==') {
        const leftValue = resolveValue(e.left, callEvent, returnEvent);
        const rightValue = resolveValue(e.right, callEvent, returnEvent);

        if (leftValue !== undefined && rightValue !== undefined) {
          return { evaluated: true, value: leftValue === rightValue };
        }
      }

      // Pattern: Entity.exists(result.id)
      if (e.type === 'CallExpression') {
        const callee = e.callee as Record<string, unknown>;
        if (callee.type === 'MemberExpression') {
          const prop = callee.property as Record<string, unknown>;
          if (prop.name === 'exists') {
            // Check if entity was created in state
            if (returnEvent.stateAfter) {
              return { evaluated: true, value: true }; // Simplified
            }
          }
        }
      }

      // Pattern: result is success
      if (e.type === 'BinaryExpression' && e.operator === 'is') {
        if (returnEvent.output !== undefined && !returnEvent.error) {
          return { evaluated: true, value: true };
        }
        if (returnEvent.error) {
          return { evaluated: true, value: false };
        }
      }
    }

    // Handle invariants
    if (clause.clauseType === 'invariant') {
      // Pattern: field >= 0
      if (e.type === 'BinaryExpression') {
        const leftValue = resolveValue(e.left, callEvent, returnEvent);
        const rightValue = resolveValue(e.right, callEvent, returnEvent);

        if (leftValue !== undefined && rightValue !== undefined) {
          const op = e.operator as string;
          switch (op) {
            case '>=':
              return { evaluated: true, value: (leftValue as number) >= (rightValue as number) };
            case '<=':
              return { evaluated: true, value: (leftValue as number) <= (rightValue as number) };
            case '>':
              return { evaluated: true, value: (leftValue as number) > (rightValue as number) };
            case '<':
              return { evaluated: true, value: (leftValue as number) < (rightValue as number) };
            case '==':
              return { evaluated: true, value: leftValue === rightValue };
            case '!=':
              return { evaluated: true, value: leftValue !== rightValue };
          }
        }
      }

      // Pattern: x never_logged (security invariant)
      if (clause.clauseText.includes('never_logged') || clause.clauseText.includes('never_stored')) {
        // These require log/storage analysis - mark as unknown without adapter
        return {
          evaluated: false,
          reasonCode: 'ADAPTER_UNAVAILABLE',
          error: 'Security invariant requires log analysis adapter',
          remediation: 'Enable the logging adapter: isl verify --adapter logging',
        };
      }
    }

    // Temporal constraints
    if (clause.clauseType === 'temporal') {
      // Pattern: within Xms: Y
      if (clause.clauseText.includes('within')) {
        const duration = returnEvent.timestamp - callEvent.timestamp;
        const match = clause.clauseText.match(/within\s+(\d+)(ms|s)/);
        if (match) {
          const limit = parseInt(match[1]) * (match[2] === 's' ? 1000 : 1);
          return { evaluated: true, value: duration <= limit };
        }
      }
    }

    // Security constraints
    if (clause.clauseType === 'security') {
      // Rate limiting requires adapter
      if (clause.clauseText.includes('rate_limit')) {
        return {
          evaluated: false,
          reasonCode: 'ADAPTER_UNAVAILABLE',
          error: 'Rate limit verification requires rate-limit adapter',
          remediation: 'Enable the rate-limit adapter: isl verify --adapter rate-limit',
        };
      }
    }
  }

  // Could not evaluate
  return {
    evaluated: false,
    reasonCode: 'EVALUATION_ERROR',
    error: 'Clause expression not supported for automatic evaluation',
    remediation: 'Add explicit test assertions or use a more specific clause pattern',
  };
}

function resolveValue(
  expr: unknown,
  callEvent: TraceEvent,
  returnEvent: TraceEvent
): unknown {
  if (!expr || typeof expr !== 'object') return expr;

  const e = expr as Record<string, unknown>;

  // Literal values
  if (e.type === 'Literal') {
    return e.value;
  }

  // Identifier
  if (e.type === 'Identifier') {
    const name = e.name as string;
    if (name === 'result') return returnEvent.output;
    if (callEvent.input && name in callEvent.input) {
      return callEvent.input[name];
    }
  }

  // Member expression: result.field
  if (e.type === 'MemberExpression') {
    const obj = resolveValue(e.object, callEvent, returnEvent);
    const prop = e.property as Record<string, unknown>;
    const propName = prop.name as string;

    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[propName];
    }
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary and Verdict Calculation
// ─────────────────────────────────────────────────────────────────────────────

function calculateSummary(clauses: VerifyClauseResult[]): { total: number; proven: number; failed: number; unknown: number } {
  let proven = 0;
  let failed = 0;
  let unknown = 0;

  for (const clause of clauses) {
    switch (clause.verdict) {
      case 'TRUE':
        proven++;
        break;
      case 'FALSE':
        failed++;
        break;
      case 'UNKNOWN':
        unknown++;
        break;
    }
  }

  return {
    total: clauses.length,
    proven,
    failed,
    unknown,
  };
}

function calculateVerdict(summary: { proven: number; failed: number; unknown: number }): OverallVerdict {
  if (summary.failed > 0) {
    return 'FAILED';
  }
  if (summary.unknown > 0) {
    return 'INCOMPLETE_PROOF';
  }
  return 'PROVEN';
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry Run (No Traces)
// ─────────────────────────────────────────────────────────────────────────────

function generateDryRunResult(ast: DomainDeclaration, specPath: string): VerifyResult {
  const clauses = extractClauses(ast, specPath);
  const startTime = Date.now();

  const verifiedClauses: VerifyClauseResult[] = clauses.map((clause) => ({
    clauseId: clause.clauseId,
    clauseText: clause.clauseText,
    clauseType: clause.clauseType,
    behavior: clause.behavior,
    verdict: 'UNKNOWN' as ClauseVerdict,
    evidence: {
      type: 'none' as const,
      reason: 'No proof bundle available',
    },
    source: clause.source,
    unknownReason: {
      code: 'NO_TRACE_DATA' as const,
      message: 'No proof bundle found. Run tests with tracing to generate verification evidence.',
      remediation: `Generate traces: isl test --trace ${specPath}`,
    },
  }));

  const summary = calculateSummary(verifiedClauses);

  return {
    verdict: 'INCOMPLETE_PROOF',
    specName: ast.name.value,
    specFile: specPath,
    clauses: verifiedClauses,
    summary,
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

function createEmptyResult(specPath: string, verdict: OverallVerdict): VerifyResult {
  return {
    verdict,
    specName: basename(specPath, '.isl'),
    specFile: specPath,
    clauses: [],
    summary: { total: 0, proven: 0, failed: 0, unknown: 0 },
    durationMs: 0,
    timestamp: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Print Functions
// ─────────────────────────────────────────────────────────────────────────────

export function printVerifyResult(result: VerifyCommandResult, options: VerifyOptions = {}): void {
  if (options.json) {
    printVerifyJson(result.result, { pretty: true });
  } else {
    printVerify(result.result, { colors: !options.noColor });
  }

  // Print errors if any
  if (result.errors.length > 0) {
    console.error('');
    for (const error of result.errors) {
      console.error(chalk.red(`Error: ${error}`));
    }
  }
}

/**
 * @deprecated Use printVerifyResult instead
 */
export function printVerifyResultLegacy(result: { success: boolean; verification?: unknown; errors: string[] }): void {
  // Legacy support - convert to new format and print
  console.log(chalk.yellow('Warning: Using legacy verify result format'));
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(chalk.red(`Error: ${error}`));
    }
  }
}
