/**
 * SMT Resolution Stage
 *
 * Turns "unknown" evaluator verdicts into proved/disproved by routing
 * clause expressions to the isl-smt solver infrastructure.
 *
 * Design principles:
 * - Does NOT touch encoding or solvers — delegates entirely to isl-smt
 * - Per-clause timeout prevents a single hard query from blocking the stage
 * - Global timeout caps the entire stage so CI budgets are respected
 * - Evidence is captured for every solver invocation (proof bundles / audit)
 *
 * @module @isl-lang/verify-pipeline
 */

import type {
  ClauseResult,
  ClauseStatus,
  TriState,
  SMTResolutionResult,
  SMTResolutionOutput,
  SMTSolverEvidence,
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

export interface SMTResolutionConfig {
  /** Clauses whose runtime evaluation returned 'unknown' */
  unknownClauses: UnknownClauseInput[];
  /** Timeout per individual SMT check (ms, default 5000) */
  timeoutPerClause?: number;
  /** Hard cap on total stage duration (ms, default 60 000) */
  globalTimeout?: number;
  /** Solver preference forwarded to isl-smt (default 'builtin') */
  solver?: 'builtin' | 'z3' | 'cvc5';
}

/**
 * Minimal information the stage needs per unknown clause.
 * Intentionally a slim projection — the caller maps from its own types.
 */
export interface UnknownClauseInput {
  clauseId: string;
  /** The expression AST node (opaque — passed straight to isl-smt) */
  expressionAst: unknown;
  /** Human-readable expression string (for diagnostics) */
  expression: string;
  /** Input values available at the time of evaluation (improves solving) */
  inputValues?: Record<string, unknown>;
}

// ============================================================================
// Dynamic import of @isl-lang/isl-smt
// ============================================================================

type ResolveUnknownFn = (
  expression: unknown,
  inputValues?: Record<string, unknown>,
  options?: { timeout?: number; solver?: 'builtin' | 'z3' | 'cvc5' },
) => Promise<{
  originalReason: string;
  attempted: boolean;
  resolved?: {
    verdict: 'proved' | 'disproved' | 'still_unknown';
    model?: Record<string, unknown>;
    reason?: string;
  };
  durationMs: number;
  evidence?: {
    queryHash: string;
    solver: string;
    solverVersion?: string;
    status: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';
    model?: Record<string, unknown>;
    reason?: string;
    durationMs: number;
    smtLibQuery?: string;
    timestamp: string;
  };
}>;

let cachedResolveUnknown: ResolveUnknownFn | null | undefined;

async function loadResolveUnknown(): Promise<ResolveUnknownFn | null> {
  if (cachedResolveUnknown !== undefined) return cachedResolveUnknown;

  try {
    const mod = await import('@isl-lang/isl-smt');
    cachedResolveUnknown = mod.resolveUnknown as ResolveUnknownFn;
    return cachedResolveUnknown;
  } catch {
    cachedResolveUnknown = null;
    return null;
  }
}

// ============================================================================
// Timeout helper
// ============================================================================

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T | { __timedOut: true; label: string }> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<{ __timedOut: true; label: string }>((resolve) => {
    timer = setTimeout(() => resolve({ __timedOut: true, label }), ms);
  });
  return Promise.race([
    promise.then((v) => {
      clearTimeout(timer);
      return v;
    }),
    timeout,
  ]);
}

function isTimeout(v: unknown): v is { __timedOut: true } {
  return typeof v === 'object' && v !== null && '__timedOut' in v;
}

// ============================================================================
// Core resolution logic
// ============================================================================

async function resolveOne(
  clause: UnknownClauseInput,
  resolveUnknown: ResolveUnknownFn,
  perClauseTimeout: number,
  solver: 'builtin' | 'z3' | 'cvc5',
): Promise<SMTResolutionResult> {
  const start = Date.now();

  // Guard: no AST means nothing to send to SMT
  if (!clause.expressionAst) {
    return {
      clauseId: clause.clauseId,
      originalStatus: 'not_proven',
      newStatus: 'not_proven',
      newTriState: 'unknown',
      verdict: 'still_unknown',
      durationMs: Date.now() - start,
      reason: 'No expression AST available for SMT encoding',
    };
  }

  const raw = await withTimeout(
    resolveUnknown(clause.expressionAst, clause.inputValues, {
      timeout: perClauseTimeout,
      solver,
    }),
    // Add 500 ms grace over the solver timeout so the solver's own
    // timeout fires first (cleaner error) before we force-kill.
    perClauseTimeout + 500,
    clause.clauseId,
  );

  if (isTimeout(raw)) {
    return {
      clauseId: clause.clauseId,
      originalStatus: 'not_proven',
      newStatus: 'not_proven',
      newTriState: 'unknown',
      verdict: 'still_unknown',
      durationMs: Date.now() - start,
      reason: `SMT resolution timed out after ${perClauseTimeout}ms`,
    };
  }

  // isl-smt didn't attempt (e.g. encoding failed)
  if (!raw.attempted || !raw.resolved) {
    return {
      clauseId: clause.clauseId,
      originalStatus: 'not_proven',
      newStatus: 'not_proven',
      newTriState: 'unknown',
      verdict: 'still_unknown',
      durationMs: raw.durationMs,
      reason: raw.resolved?.reason ?? 'SMT resolution not attempted (encoding failed)',
    };
  }

  // Map isl-smt verdict → pipeline types
  const evidence: SMTSolverEvidence | undefined = raw.evidence
    ? {
        queryHash: raw.evidence.queryHash,
        solver: raw.evidence.solver,
        solverVersion: raw.evidence.solverVersion,
        status: raw.evidence.status,
        model: raw.evidence.model,
        reason: raw.evidence.reason,
        durationMs: raw.evidence.durationMs,
        smtLibQuery: raw.evidence.smtLibQuery,
        timestamp: raw.evidence.timestamp,
      }
    : undefined;

  switch (raw.resolved.verdict) {
    case 'proved':
      return {
        clauseId: clause.clauseId,
        originalStatus: 'not_proven',
        newStatus: 'proven',
        newTriState: true,
        verdict: 'proved',
        evidence,
        durationMs: raw.durationMs,
        reason: raw.resolved.reason ?? 'SMT proved expression is valid',
      };

    case 'disproved':
      return {
        clauseId: clause.clauseId,
        originalStatus: 'not_proven',
        newStatus: 'violated',
        newTriState: false,
        verdict: 'disproved',
        evidence,
        durationMs: raw.durationMs,
        reason: raw.resolved.reason ?? 'SMT found counterexample',
      };

    case 'still_unknown':
    default:
      return {
        clauseId: clause.clauseId,
        originalStatus: 'not_proven',
        newStatus: 'not_proven',
        newTriState: 'unknown',
        verdict: 'still_unknown',
        evidence,
        durationMs: raw.durationMs,
        reason: raw.resolved.reason ?? 'SMT could not determine verdict',
      };
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolve unknown clause verdicts using SMT.
 *
 * Iterates over every unknown clause, calls `resolveUnknown` from
 * `@isl-lang/isl-smt`, and returns a structured summary.
 *
 * If isl-smt is not installed the stage returns gracefully with
 * all clauses still marked `still_unknown`.
 */
export async function resolveUnknownsWithSMT(
  config: SMTResolutionConfig,
): Promise<SMTResolutionOutput> {
  const perClauseTimeout = config.timeoutPerClause ?? 5_000;
  const globalTimeout = config.globalTimeout ?? 60_000;
  const solver = config.solver ?? 'builtin';

  // Fast path: nothing to do
  if (config.unknownClauses.length === 0) {
    return emptyOutput();
  }

  // Try to load isl-smt
  const resolveUnknown = await loadResolveUnknown();

  if (!resolveUnknown) {
    // Package unavailable — return all as still_unknown
    const total = config.unknownClauses.length;
    return {
      resolutions: config.unknownClauses.map((c) => ({
        clauseId: c.clauseId,
        originalStatus: 'not_proven' as const,
        newStatus: 'not_proven' as ClauseStatus,
        newTriState: 'unknown' as TriState,
        verdict: 'still_unknown' as const,
        durationMs: 0,
        reason: '@isl-lang/isl-smt package not available',
      })),
      summary: {
        totalUnknowns: total,
        resolved: 0,
        proved: 0,
        disproved: 0,
        stillUnknown: total,
        timedOut: 0,
        errors: 0,
        resolutionRate: 0,
        totalDurationMs: 0,
      },
    };
  }

  // Resolve each clause, respecting global timeout
  const resolutions: SMTResolutionResult[] = [];
  const stageStart = Date.now();

  for (const clause of config.unknownClauses) {
    const elapsed = Date.now() - stageStart;
    if (elapsed >= globalTimeout) {
      // Budget exhausted — mark remaining as timed-out
      resolutions.push({
        clauseId: clause.clauseId,
        originalStatus: 'not_proven',
        newStatus: 'not_proven',
        newTriState: 'unknown',
        verdict: 'still_unknown',
        durationMs: 0,
        reason: `Global SMT timeout exceeded (${globalTimeout}ms budget)`,
      });
      continue;
    }

    // Cap per-clause timeout to remaining budget
    const remainingBudget = globalTimeout - elapsed;
    const effectiveTimeout = Math.min(perClauseTimeout, remainingBudget);

    try {
      const result = await resolveOne(clause, resolveUnknown, effectiveTimeout, solver);
      resolutions.push(result);
    } catch (error) {
      resolutions.push({
        clauseId: clause.clauseId,
        originalStatus: 'not_proven',
        newStatus: 'not_proven',
        newTriState: 'unknown',
        verdict: 'still_unknown',
        durationMs: Date.now() - stageStart,
        reason: `SMT resolution error: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const totalDurationMs = Date.now() - stageStart;

  // Compute summary
  const proved = resolutions.filter((r) => r.verdict === 'proved').length;
  const disproved = resolutions.filter((r) => r.verdict === 'disproved').length;
  const stillUnknown = resolutions.filter((r) => r.verdict === 'still_unknown').length;
  const timedOut = resolutions.filter(
    (r) => r.verdict === 'still_unknown' && r.reason?.includes('timed out'),
  ).length;
  const errors = resolutions.filter(
    (r) => r.verdict === 'still_unknown' && r.reason?.includes('error'),
  ).length;
  const totalUnknowns = resolutions.length;
  const resolved = proved + disproved;

  return {
    resolutions,
    summary: {
      totalUnknowns,
      resolved,
      proved,
      disproved,
      stillUnknown,
      timedOut,
      errors,
      resolutionRate: totalUnknowns > 0 ? resolved / totalUnknowns : 0,
      totalDurationMs,
    },
  };
}

/**
 * Apply SMT resolution results back onto an array of ClauseResults.
 *
 * Mutates in place and returns the same array for chaining.
 */
export function applyResolutions(
  clauseResults: ClauseResult[],
  resolutions: SMTResolutionResult[],
): ClauseResult[] {
  const lookup = new Map(resolutions.map((r) => [r.clauseId, r]));

  for (const cr of clauseResults) {
    const res = lookup.get(cr.clauseId);
    if (!res) continue;
    if (res.verdict === 'still_unknown') {
      // Attach evidence even when still unknown (for audit trail)
      if (res.evidence) {
        cr.smtEvidence = res.evidence;
        cr.resolvedBy = 'runtime_then_smt';
      }
      continue;
    }

    // Update the clause
    cr.status = res.newStatus;
    cr.triStateResult = res.newTriState;
    cr.reason = res.reason;
    cr.resolvedBy = 'runtime_then_smt';

    if (res.evidence) {
      cr.smtEvidence = res.evidence;
    }
  }

  return clauseResults;
}

// ============================================================================
// Helpers
// ============================================================================

function emptyOutput(): SMTResolutionOutput {
  return {
    resolutions: [],
    summary: {
      totalUnknowns: 0,
      resolved: 0,
      proved: 0,
      disproved: 0,
      stillUnknown: 0,
      timedOut: 0,
      errors: 0,
      resolutionRate: 0,
      totalDurationMs: 0,
    },
  };
}
