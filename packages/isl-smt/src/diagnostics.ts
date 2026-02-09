/**
 * SMT Failure Diagnostics
 *
 * Produces actionable failure artifacts when SMT solving fails:
 * - Minimal counterexamples (strip irrelevant variables from models)
 * - Unsat core analysis (which constraint(s) caused unsatisfiability)
 * - Unknown-reason classification
 * - Human-readable diagnostic reports
 *
 * Design principles:
 * - Every failure tells you *what* went wrong and *where* in the ISL spec.
 * - Counterexamples are minimal: only variables that matter are shown.
 * - No guessing: if we can't determine the cause, we say so explicitly.
 */

import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import { Expr, Decl, toSMTLib } from '@isl-lang/prover';
import type { SMTCheckResult } from './types.js';
import type { SMTSourceMap, SourceMappedAssertion } from './smtlib-generator.js';
import { createSolver, type ISMTSolver } from './solver.js';
import type { SMTVerifyOptions } from './types.js';

// ============================================================================
// Counterexample Types
// ============================================================================

/**
 * A minimal counterexample extracted from a SAT model.
 */
export interface MinimalCounterexample {
  /** The full model from the solver */
  fullModel: Record<string, unknown>;
  /** The minimized model (only relevant variables) */
  minimalModel: Record<string, unknown>;
  /** Variables that were removed during minimization */
  removedVariables: string[];
  /** Human-readable explanation */
  explanation: string;
  /** Which assertions are violated by this counterexample */
  violatedAssertions: string[];
}

// ============================================================================
// Unsat Core Types
// ============================================================================

/**
 * Analysis of which constraints caused UNSAT.
 */
export interface UnsatAnalysis {
  /** Tags of the assertions forming the unsat core */
  coreTags: string[];
  /** Source-mapped assertions from the core (if source map provided) */
  coreAssertions: SourceMappedAssertion[];
  /** Human-readable explanation */
  explanation: string;
  /** Whether the core is minimal (single-constraint) */
  isMinimal: boolean;
}

// ============================================================================
// Diagnostic Report
// ============================================================================

/**
 * Classification of unknown results.
 */
export type UnknownReason =
  | { kind: 'timeout'; timeoutMs: number }
  | { kind: 'resource_limit'; detail: string }
  | { kind: 'incomplete_theory'; detail: string }
  | { kind: 'cancelled' }
  | { kind: 'solver_error'; message: string }
  | { kind: 'too_complex'; metrics?: { variables: number; depth: number; nodes: number } }
  | { kind: 'unclassified'; raw: string };

/**
 * Complete diagnostic report for a failed SMT check.
 */
export interface DiagnosticReport {
  /** The original SMT result */
  result: SMTCheckResult;
  /** Counterexample (if result is SAT where we expected UNSAT) */
  counterexample?: MinimalCounterexample;
  /** Unsat analysis (if result is UNSAT) */
  unsatAnalysis?: UnsatAnalysis;
  /** Classified unknown reason */
  unknownReason?: UnknownReason;
  /** Actionable suggestions for the user */
  suggestions: string[];
  /** The SMT-LIB script that was checked (for reproduction) */
  smtLib?: string;
}

// ============================================================================
// Counterexample Minimization
// ============================================================================

/**
 * Extract a minimal counterexample from a SAT result.
 *
 * Strategy: iteratively remove variables from the model and re-check.
 * If the formula is still SAT without variable v, v is irrelevant.
 *
 * For efficiency, this uses a greedy single-pass approach rather than
 * full delta-debugging, bounded by maxAttempts.
 */
export async function minimizeCounterexample(
  formula: SMTExpr,
  fullModel: Record<string, unknown>,
  declarations: SMTDecl[],
  options: SMTVerifyOptions & { maxAttempts?: number } = {},
): Promise<MinimalCounterexample> {
  const maxAttempts = options.maxAttempts ?? 20;
  const solver = createSolver({ ...options, timeout: options.timeout ?? 2000 });

  const currentModel = { ...fullModel };
  const removedVars: string[] = [];
  const varNames = Object.keys(currentModel);
  let attempts = 0;

  for (const varName of varNames) {
    if (attempts >= maxAttempts) break;
    attempts++;

    // Try pinning all variables EXCEPT this one and check if still SAT
    const pinned = buildPinnedFormula(formula, currentModel, varName);
    const filteredDecls = declarations.filter(
      (d) => d.kind === 'DeclareConst' && d.name !== varName,
    );

    const result = await solver.checkSat(pinned, filteredDecls);
    if (result.status === 'sat') {
      // Variable is irrelevant — remove it
      delete currentModel[varName];
      removedVars.push(varName);
    }
  }

  const violatedAssertions = identifyViolatedAssertions(formula, currentModel);

  return {
    fullModel: { ...fullModel },
    minimalModel: currentModel,
    removedVariables: removedVars,
    explanation: formatCounterexample(currentModel, violatedAssertions),
    violatedAssertions,
  };
}

/**
 * Quick counterexample extraction without minimization.
 * Use when you just need the model formatted, not minimized.
 */
export function extractCounterexample(
  model: Record<string, unknown>,
  formula: SMTExpr,
  sourceMap?: SMTSourceMap,
): MinimalCounterexample {
  const violatedAssertions = identifyViolatedAssertions(formula, model);

  return {
    fullModel: { ...model },
    minimalModel: { ...model },
    removedVariables: [],
    explanation: formatCounterexample(model, violatedAssertions),
    violatedAssertions,
  };
}

// ============================================================================
// Unsat Core Analysis
// ============================================================================

/**
 * Analyze an UNSAT result to identify which constraints are responsible.
 *
 * If the solver provides an unsat core (list of named assertion tags),
 * this maps them back to ISL source via the source map.
 *
 * If no core is available, performs single-constraint isolation:
 * check each assertion individually to find which one(s) conflict.
 */
export async function analyzeUnsat(
  assertions: Array<{ tag: string; expr: SMTExpr }>,
  declarations: SMTDecl[],
  sourceMap?: SMTSourceMap,
  unsatCoreTags?: string[],
  options: SMTVerifyOptions = {},
): Promise<UnsatAnalysis> {
  // If solver gave us a core, use it directly
  if (unsatCoreTags && unsatCoreTags.length > 0) {
    return buildUnsatAnalysis(unsatCoreTags, sourceMap);
  }

  // Otherwise, isolate conflicting constraints by binary search
  return await isolateUnsatCore(assertions, declarations, sourceMap, options);
}

/**
 * Isolate the unsat core by incrementally adding assertions.
 */
async function isolateUnsatCore(
  assertions: Array<{ tag: string; expr: SMTExpr }>,
  declarations: SMTDecl[],
  sourceMap: SMTSourceMap | undefined,
  options: SMTVerifyOptions,
): Promise<UnsatAnalysis> {
  const solver = createSolver({ ...options, timeout: options.timeout ?? 2000 });
  const coreTags: string[] = [];

  // First, check each assertion individually — find which are unsat alone
  for (const assertion of assertions) {
    const result = await solver.checkSat(assertion.expr, declarations);
    if (result.status === 'unsat') {
      coreTags.push(assertion.tag);
    }
  }

  if (coreTags.length > 0) {
    return buildUnsatAnalysis(coreTags, sourceMap);
  }

  // No single assertion is unsat — find minimal conflicting pair
  // Use greedy forward: add assertions one by one until UNSAT
  const accumulated: SMTExpr[] = [];
  const accumulatedTags: string[] = [];

  for (const assertion of assertions) {
    accumulated.push(assertion.expr);
    accumulatedTags.push(assertion.tag);

    const conj = accumulated.length === 1
      ? accumulated[0]!
      : Expr.and(...accumulated);
    const result = await solver.checkSat(conj, declarations);

    if (result.status === 'unsat') {
      // The last assertion tipped it over — it's part of the core
      return buildUnsatAnalysis(accumulatedTags, sourceMap);
    }
  }

  // All assertions together are still SAT? Shouldn't happen if we got UNSAT originally.
  return {
    coreTags: assertions.map((a) => a.tag),
    coreAssertions: [],
    explanation: 'Could not isolate unsat core — all assertions appear jointly satisfiable.',
    isMinimal: false,
  };
}

function buildUnsatAnalysis(
  coreTags: string[],
  sourceMap?: SMTSourceMap,
): UnsatAnalysis {
  const coreAssertions: SourceMappedAssertion[] = [];
  if (sourceMap) {
    for (const tag of coreTags) {
      const mapped = sourceMap.resolve(tag);
      if (mapped) coreAssertions.push(mapped);
    }
  }

  const isMinimal = coreTags.length === 1;
  const explanation = formatUnsatExplanation(coreTags, coreAssertions, isMinimal);

  return { coreTags, coreAssertions, explanation, isMinimal };
}

// ============================================================================
// Unknown Reason Classification
// ============================================================================

/**
 * Classify an unknown/timeout/error result into an actionable reason.
 */
export function classifyUnknown(result: SMTCheckResult): UnknownReason {
  if (result.status === 'timeout') {
    return { kind: 'timeout', timeoutMs: 0 }; // caller should fill in actual timeout
  }

  if (result.status === 'error') {
    const msg = result.message ?? '';
    if (msg.includes('cancelled') || msg.includes('abort')) {
      return { kind: 'cancelled' };
    }
    if (msg.includes('memory') || msg.includes('resource')) {
      return { kind: 'resource_limit', detail: msg };
    }
    return { kind: 'solver_error', message: msg };
  }

  if (result.status === 'unknown') {
    const reason = result.reason ?? '';
    if (reason.includes('timeout') || reason.includes('Timeout')) {
      return { kind: 'timeout', timeoutMs: 0 };
    }
    if (reason.includes('complex') || reason.includes('too many')) {
      return { kind: 'too_complex' };
    }
    if (reason.includes('incomplete') || reason.includes('theory')) {
      return { kind: 'incomplete_theory', detail: reason };
    }
    if (reason.includes('memory') || reason.includes('resource')) {
      return { kind: 'resource_limit', detail: reason };
    }
    return { kind: 'unclassified', raw: reason };
  }

  return { kind: 'unclassified', raw: `Unexpected status: ${result.status}` };
}

// ============================================================================
// Diagnostic Report Builder
// ============================================================================

/**
 * Build a complete diagnostic report for a failed SMT check.
 */
export function buildDiagnosticReport(
  result: SMTCheckResult,
  formula?: SMTExpr,
  sourceMap?: SMTSourceMap,
  smtLib?: string,
): DiagnosticReport {
  const report: DiagnosticReport = {
    result,
    suggestions: [],
    smtLib,
  };

  if (result.status === 'sat' && result.model && formula) {
    report.counterexample = extractCounterexample(result.model, formula, sourceMap);
    report.suggestions.push(
      'A counterexample was found — review the variable assignments above.',
    );
    if (sourceMap) {
      report.suggestions.push(
        'Use the source map to trace violated assertions back to ISL source.',
      );
    }
  }

  if (result.status === 'unknown' || result.status === 'timeout' || result.status === 'error') {
    report.unknownReason = classifyUnknown(result);
    report.suggestions.push(...suggestionsForUnknown(report.unknownReason));
  }

  return report;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatCounterexample(
  model: Record<string, unknown>,
  violatedAssertions: string[],
): string {
  const lines: string[] = ['Counterexample found:'];
  for (const [k, v] of Object.entries(model)) {
    lines.push(`  ${k} = ${JSON.stringify(v)}`);
  }
  if (violatedAssertions.length > 0) {
    lines.push('');
    lines.push('This assignment violates:');
    for (const a of violatedAssertions) {
      lines.push(`  - ${a}`);
    }
  }
  return lines.join('\n');
}

function formatUnsatExplanation(
  coreTags: string[],
  coreAssertions: SourceMappedAssertion[],
  isMinimal: boolean,
): string {
  const lines: string[] = [];

  if (isMinimal) {
    lines.push('Single constraint is unsatisfiable:');
  } else {
    lines.push(`${coreTags.length} constraints are mutually unsatisfiable:`);
  }

  for (const tag of coreTags) {
    const mapped = coreAssertions.find((a) => a.tag === tag);
    if (mapped) {
      const loc = mapped.location
        ? ` (line ${mapped.location.line}, col ${mapped.location.column})`
        : '';
      const src = mapped.islSource ? ` — "${mapped.islSource}"` : '';
      lines.push(`  [${tag}] ${mapped.kind} in ${mapped.ownerName}${loc}${src}`);
    } else {
      lines.push(`  [${tag}]`);
    }
  }

  return lines.join('\n');
}

function suggestionsForUnknown(reason: UnknownReason): string[] {
  switch (reason.kind) {
    case 'timeout':
      return [
        'The solver timed out. Try: increase timeout, simplify constraints, or reduce variable count.',
        'Consider splitting the verification into smaller sub-problems.',
      ];
    case 'resource_limit':
      return [
        'The solver ran out of resources. Try reducing the model size or simplifying constraints.',
      ];
    case 'incomplete_theory':
      return [
        'The solver cannot reason about this combination of theories.',
        'Try rewriting constraints to use simpler theory fragments (e.g., linear arithmetic only).',
      ];
    case 'too_complex':
      return [
        'The query is too complex for the built-in solver.',
        'Install Z3 or CVC5 for more powerful solving: `brew install z3` / `apt install z3`.',
      ];
    case 'cancelled':
      return ['The solve was cancelled. No action needed.'];
    case 'solver_error':
      return [
        `Solver error: ${reason.message}`,
        'Check that the SMT-LIB script is well-formed. The script is included in this report.',
      ];
    case 'unclassified':
      return [`Unknown reason: ${reason.raw}. Check the SMT-LIB script for issues.`];
  }
}

// ============================================================================
// Internal: violated assertion identification
// ============================================================================

/**
 * Identify which top-level conjuncts of a formula are violated by a model.
 * Returns human-readable descriptions.
 */
function identifyViolatedAssertions(
  formula: SMTExpr,
  model: Record<string, unknown>,
): string[] {
  const violated: string[] = [];

  // If formula is a conjunction, check each conjunct
  if (formula.kind === 'And') {
    for (let i = 0; i < formula.args.length; i++) {
      const conjunct = formula.args[i]!;
      if (!evaluateSimple(conjunct, model)) {
        violated.push(`conjunct[${i}]: ${toSMTLib(conjunct)}`);
      }
    }
  } else {
    if (!evaluateSimple(formula, model)) {
      violated.push(`formula: ${toSMTLib(formula)}`);
    }
  }

  return violated;
}

/**
 * Simple evaluator for ground formulas with a model.
 * Returns undefined if evaluation is not possible (non-ground).
 */
function evaluateSimple(expr: SMTExpr, model: Record<string, unknown>): boolean | undefined {
  switch (expr.kind) {
    case 'BoolConst':
      return expr.value;

    case 'Var': {
      const val = model[expr.name];
      if (typeof val === 'boolean') return val;
      return undefined;
    }

    case 'Not': {
      const inner = evaluateSimple(expr.arg, model);
      return inner !== undefined ? !inner : undefined;
    }

    case 'And': {
      let allTrue = true;
      for (const arg of expr.args) {
        const val = evaluateSimple(arg, model);
        if (val === false) return false;
        if (val === undefined) allTrue = false;
      }
      return allTrue ? true : undefined;
    }

    case 'Or': {
      let anyTrue = false;
      for (const arg of expr.args) {
        const val = evaluateSimple(arg, model);
        if (val === true) return true;
        if (val === undefined) anyTrue = false;
      }
      return anyTrue ? true : undefined;
    }

    case 'Eq': {
      const l = evaluateNumeric(expr.left, model);
      const r = evaluateNumeric(expr.right, model);
      if (l !== undefined && r !== undefined) return l === r;
      return undefined;
    }

    case 'Lt': {
      const l = evaluateNumeric(expr.left, model);
      const r = evaluateNumeric(expr.right, model);
      if (l !== undefined && r !== undefined) return l < r;
      return undefined;
    }

    case 'Le': {
      const l = evaluateNumeric(expr.left, model);
      const r = evaluateNumeric(expr.right, model);
      if (l !== undefined && r !== undefined) return l <= r;
      return undefined;
    }

    case 'Gt': {
      const l = evaluateNumeric(expr.left, model);
      const r = evaluateNumeric(expr.right, model);
      if (l !== undefined && r !== undefined) return l > r;
      return undefined;
    }

    case 'Ge': {
      const l = evaluateNumeric(expr.left, model);
      const r = evaluateNumeric(expr.right, model);
      if (l !== undefined && r !== undefined) return l >= r;
      return undefined;
    }

    default:
      return undefined;
  }
}

function evaluateNumeric(expr: SMTExpr, model: Record<string, unknown>): number | undefined {
  switch (expr.kind) {
    case 'IntConst':
      return expr.value;
    case 'RealConst':
      return expr.value;
    case 'Var': {
      const val = model[expr.name];
      if (typeof val === 'number') return val;
      return undefined;
    }
    case 'Add': {
      let sum = 0;
      for (const arg of expr.args) {
        const v = evaluateNumeric(arg, model);
        if (v === undefined) return undefined;
        sum += v;
      }
      return sum;
    }
    case 'Sub': {
      const l = evaluateNumeric(expr.left, model);
      const r = evaluateNumeric(expr.right, model);
      if (l !== undefined && r !== undefined) return l - r;
      return undefined;
    }
    case 'Mul': {
      let product = 1;
      for (const arg of expr.args) {
        const v = evaluateNumeric(arg, model);
        if (v === undefined) return undefined;
        product *= v;
      }
      return product;
    }
    case 'Neg': {
      const v = evaluateNumeric(expr.arg, model);
      return v !== undefined ? -v : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Build a formula with all variables pinned to model values except the excluded one.
 */
function buildPinnedFormula(
  formula: SMTExpr,
  model: Record<string, unknown>,
  excludeVar: string,
): SMTExpr {
  const pinConstraints: SMTExpr[] = [formula];

  for (const [name, value] of Object.entries(model)) {
    if (name === excludeVar) continue;

    if (typeof value === 'boolean') {
      const v = Expr.var(name, { kind: 'Bool' } as any);
      pinConstraints.push(value ? v : Expr.not(v));
    } else if (typeof value === 'number') {
      const v = Expr.var(name, { kind: 'Int' } as any);
      pinConstraints.push(
        Number.isInteger(value)
          ? Expr.eq(v, Expr.int(value))
          : Expr.eq(v, Expr.real(value)),
      );
    }
  }

  return pinConstraints.length === 1 ? pinConstraints[0]! : Expr.and(...pinConstraints);
}
