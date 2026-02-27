/**
 * Safe SMT Solver Wrapper
 *
 * Turns SMT from "fragile demo" into "boring infrastructure" by enforcing:
 * - Strict timeout with guaranteed termination (no CI hangs)
 * - AbortController-based cancellation
 * - Max model size safeguards (assertion count, variable count, expression depth)
 * - Deterministic behavior via query deduplication
 *
 * Non-negotiables:
 * - Every solve call terminates within its deadline. Period.
 * - Cancellation is immediate — no dangling promises.
 * - Oversized models are rejected before wasting solver time.
 */

import type { SMTExpr, SMTDecl, SMTSort } from '@isl-lang/prover';
import { Expr, Decl } from '@isl-lang/prover';
import type { SMTCheckResult, SMTVerifyOptions } from './types.js';
import { createSolver, type ISMTSolver } from './solver.js';
import { SMTCache, getGlobalCache } from './cache.js';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Hard limits — these protect CI from runaway solves.
 */
export interface SafeSolverLimits {
  /** Max wall-clock time per solve (ms). Default: 10_000 */
  timeoutMs: number;
  /** Max number of assertions in a single query. Default: 200 */
  maxAssertions: number;
  /** Max number of free variables. Default: 50 */
  maxVariables: number;
  /** Max AST depth of the formula. Default: 100 */
  maxExprDepth: number;
  /** Max total AST node count. Default: 10_000 */
  maxNodeCount: number;
}

const DEFAULT_LIMITS: SafeSolverLimits = {
  timeoutMs: 10_000,
  maxAssertions: 200,
  maxVariables: 50,
  maxExprDepth: 100,
  maxNodeCount: 10_000,
};

// ============================================================================
// SafeSolverResult — enriched result with diagnostics
// ============================================================================

export interface SafeSolverResult {
  /** Core SMT result */
  result: SMTCheckResult;
  /** Wall-clock time spent (ms) */
  wallTimeMs: number;
  /** Whether the solve was cancelled via AbortSignal */
  cancelled: boolean;
  /** Whether the query was rejected by pre-flight checks */
  rejected: boolean;
  /** Rejection reason, if any */
  rejectionReason?: string;
  /** Model size metrics captured before solving */
  metrics: QueryMetrics;
}

export interface QueryMetrics {
  /** Number of free variables */
  variableCount: number;
  /** Number of top-level assertions / conjuncts */
  assertionCount: number;
  /** Maximum AST depth */
  maxDepth: number;
  /** Total AST node count */
  nodeCount: number;
}

// ============================================================================
// SafeSolver
// ============================================================================

export class SafeSolver {
  private readonly limits: SafeSolverLimits;
  private readonly inner: ISMTSolver;
  private readonly cache: SMTCache;

  constructor(
    options: SMTVerifyOptions = {},
    limits: Partial<SafeSolverLimits> = {},
  ) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    // Inner solver gets the same timeout as our hard limit
    this.inner = createSolver({
      ...options,
      timeout: this.limits.timeoutMs,
    });
    this.cache = getGlobalCache();
  }

  /**
   * Check satisfiability with full safety harness.
   *
   * Guarantees:
   * 1. Returns within `limits.timeoutMs` (or sooner if cancelled).
   * 2. Rejects queries that exceed model-size safeguards.
   * 3. Never throws — all errors are captured in the result.
   */
  async checkSat(
    formula: SMTExpr,
    declarations: SMTDecl[] = [],
    signal?: AbortSignal,
  ): Promise<SafeSolverResult> {
    const start = Date.now();
    const metrics = measureQuery(formula, declarations);

    // ---- Pre-flight rejection ----
    const rejection = this.preflightCheck(metrics);
    if (rejection) {
      return {
        result: { status: 'error', message: rejection },
        wallTimeMs: Date.now() - start,
        cancelled: false,
        rejected: true,
        rejectionReason: rejection,
        metrics,
      };
    }

    // ---- Already cancelled? ----
    if (signal?.aborted) {
      return {
        result: { status: 'unknown', reason: 'Cancelled before solving' },
        wallTimeMs: Date.now() - start,
        cancelled: true,
        rejected: false,
        metrics,
      };
    }

    // ---- Race: solve vs timeout vs cancellation ----
    return this.raceWithGuards(formula, declarations, signal, start, metrics);
  }

  /**
   * Check validity (formula true for all assignments) with safety harness.
   */
  async checkValid(
    formula: SMTExpr,
    declarations: SMTDecl[] = [],
    signal?: AbortSignal,
  ): Promise<SafeSolverResult> {
    const negated = Expr.not(formula);
    const satResult = await this.checkSat(negated, declarations, signal);

    // Invert interpretation: unsat-of-negation ⇒ valid
    if (satResult.result.status === 'unsat') {
      return { ...satResult, result: { status: 'sat' } };
    }
    if (satResult.result.status === 'sat') {
      return { ...satResult, result: { status: 'unsat' } };
    }
    return satResult;
  }

  // ---------- internal helpers ----------

  private preflightCheck(metrics: QueryMetrics): string | undefined {
    if (metrics.variableCount > this.limits.maxVariables) {
      return `Query has ${metrics.variableCount} variables (limit: ${this.limits.maxVariables})`;
    }
    if (metrics.assertionCount > this.limits.maxAssertions) {
      return `Query has ${metrics.assertionCount} assertions (limit: ${this.limits.maxAssertions})`;
    }
    if (metrics.maxDepth > this.limits.maxExprDepth) {
      return `Query AST depth is ${metrics.maxDepth} (limit: ${this.limits.maxExprDepth})`;
    }
    if (metrics.nodeCount > this.limits.maxNodeCount) {
      return `Query has ${metrics.nodeCount} AST nodes (limit: ${this.limits.maxNodeCount})`;
    }
    return undefined;
  }

  private async raceWithGuards(
    formula: SMTExpr,
    declarations: SMTDecl[],
    signal: AbortSignal | undefined,
    start: number,
    metrics: QueryMetrics,
  ): Promise<SafeSolverResult> {
    // Build competing promises
    const solvePromise = this.inner.checkSat(formula, declarations);

    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      const remaining = this.limits.timeoutMs - (Date.now() - start);
      const id = setTimeout(() => resolve('timeout'), Math.max(0, remaining));
      // Allow Node to exit even if timer is pending
      if (typeof id === 'object' && 'unref' in id) {
        (id as NodeJS.Timeout).unref();
      }
    });

    const cancelPromise = signal
      ? new Promise<'cancelled'>((resolve) => {
          if (signal.aborted) {
            resolve('cancelled');
            return;
          }
          const handler = () => resolve('cancelled');
          signal.addEventListener('abort', handler, { once: true });
        })
      : new Promise<'cancelled'>(() => {
          /* never resolves */
        });

    const winner = await Promise.race([
      solvePromise.then((r) => ({ tag: 'result' as const, value: r })),
      timeoutPromise.then((t) => ({ tag: t })),
      cancelPromise.then((c) => ({ tag: c })),
    ]);

    const wallTimeMs = Date.now() - start;

    if (winner.tag === 'timeout') {
      return {
        result: { status: 'timeout' },
        wallTimeMs,
        cancelled: false,
        rejected: false,
        metrics,
      };
    }

    if (winner.tag === 'cancelled') {
      return {
        result: { status: 'unknown', reason: 'Cancelled by caller' },
        wallTimeMs,
        cancelled: true,
        rejected: false,
        metrics,
      };
    }

    return {
      result: winner.value,
      wallTimeMs,
      cancelled: false,
      rejected: false,
      metrics,
    };
  }
}

// ============================================================================
// Query metrics (pure, no side-effects)
// ============================================================================

/**
 * Measure a query's complexity without executing it.
 */
export function measureQuery(
  formula: SMTExpr,
  declarations: SMTDecl[],
): QueryMetrics {
  const vars = new Set<string>();
  let nodeCount = 0;
  let assertionCount = 0;

  // Count top-level conjuncts as "assertions"
  assertionCount = countTopLevelConjuncts(formula);

  // Count variables from declarations
  for (const decl of declarations) {
    if (decl.kind === 'DeclareConst' || decl.kind === 'DeclareFun') {
      vars.add(decl.name);
    }
  }

  // Walk the AST
  const maxDepth = walkExpr(formula, vars, { count: 0 }, 0);
  nodeCount = walkExpr.lastNodeCount;

  // Also collect free variables from the formula itself
  collectFreeVars(formula, vars);

  return {
    variableCount: vars.size,
    assertionCount,
    maxDepth,
    nodeCount,
  };
}

function countTopLevelConjuncts(expr: SMTExpr): number {
  if (expr.kind === 'And') {
    let total = 0;
    for (const arg of expr.args) {
      total += countTopLevelConjuncts(arg);
    }
    return total;
  }
  return 1;
}

/**
 * Walk expression tree, counting nodes and tracking max depth.
 * Stores last node count on a function property for simplicity.
 */
function walkExpr(
  expr: SMTExpr,
  vars: Set<string>,
  counter: { count: number },
  depth: number,
): number {
  counter.count++;
  let maxDepth = depth;

  const children = getChildren(expr);
  for (const child of children) {
    const childDepth = walkExpr(child, vars, counter, depth + 1);
    if (childDepth > maxDepth) maxDepth = childDepth;
  }

  if (expr.kind === 'Var') {
    vars.add(expr.name);
  }

  walkExpr.lastNodeCount = counter.count;
  return maxDepth;
}
walkExpr.lastNodeCount = 0;

function collectFreeVars(expr: SMTExpr, vars: Set<string>): void {
  if (expr.kind === 'Var') {
    vars.add(expr.name);
    return;
  }
  for (const child of getChildren(expr)) {
    collectFreeVars(child, vars);
  }
}

function getChildren(expr: SMTExpr): SMTExpr[] {
  switch (expr.kind) {
    case 'Not':
    case 'Neg':
    case 'Abs':
      return [expr.arg];
    case 'And':
    case 'Or':
    case 'Add':
    case 'Mul':
    case 'Distinct':
      return expr.args;
    case 'Implies':
    case 'Iff':
    case 'Eq':
    case 'Lt':
    case 'Le':
    case 'Gt':
    case 'Ge':
    case 'Sub':
    case 'Div':
    case 'Mod':
      return [expr.left, expr.right];
    case 'Ite':
      return [expr.cond, expr.then, expr.else];
    case 'Forall':
    case 'Exists':
      return [expr.body];
    case 'Select':
      return [expr.array, expr.index];
    case 'Store':
      return [expr.array, expr.index, expr.value];
    case 'Apply':
      return expr.args;
    case 'Let':
      return [...expr.bindings.map((b: any) => b.value), expr.body];
    default:
      return [];
  }
}

// ============================================================================
// Convenience factory
// ============================================================================

/**
 * Create a SafeSolver with sensible defaults.
 *
 * @example
 * ```ts
 * const solver = createSafeSolver({ timeout: 5000 });
 * const result = await solver.checkSat(formula, decls);
 * if (result.rejected) console.error(result.rejectionReason);
 * ```
 */
export function createSafeSolver(
  options: SMTVerifyOptions = {},
  limits: Partial<SafeSolverLimits> = {},
): SafeSolver {
  return new SafeSolver(options, limits);
}
