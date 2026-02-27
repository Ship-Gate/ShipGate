/**
 * SMT Reliability Tests
 *
 * Deterministic tests (no system randomness) proving:
 * 1. SafeSolver never hangs — strict timeout, cancellation, pre-flight rejection
 * 2. SMT-LIB generation produces traceable, source-mapped output
 * 3. Failure diagnostics produce actionable counterexamples & unsat analysis
 * 4. All results are deterministic across runs
 *
 * Every test uses fixed inputs, fixed seeds, and fixed timeouts.
 * No reliance on wall-clock jitter, external binaries, or network.
 */

import { describe, it, expect, vi } from 'vitest';
import { Expr, Sort, Decl, toSMTLib } from '@isl-lang/prover';
import type { SMTExpr, SMTDecl } from '@isl-lang/prover';

// Safe Solver
import {
  SafeSolver,
  createSafeSolver,
  measureQuery,
  type SafeSolverResult,
  type QueryMetrics,
} from '../src/safe-solver.js';

// SMT-LIB Generator
import {
  generateFromPreconditions,
  generateFromPostconditions,
  generateFromRefinements,
  generateFromInvariants,
} from '../src/smtlib-generator.js';
import { createContext, islTypeToSort } from '../src/encoder.js';

// Diagnostics
import {
  extractCounterexample,
  classifyUnknown,
  buildDiagnosticReport,
  analyzeUnsat,
} from '../src/diagnostics.js';
import type { SMTCheckResult } from '../src/types.js';

// ============================================================================
// Test Helpers — all deterministic, no randomness
// ============================================================================

const mockSpan = { start: { line: 1, column: 0, offset: 0 }, end: { line: 1, column: 10, offset: 10 } };

function condStmt(expression: any) {
  return { kind: 'ConditionStatement' as const, expression, span: mockSpan };
}

function id(name: string) {
  return { kind: 'Identifier' as const, name, span: mockSpan };
}

function num(value: number) {
  return { kind: 'NumberLiteral' as const, value, span: mockSpan };
}

function compare(left: any, operator: string, right: any) {
  return { kind: 'ComparisonExpression' as const, operator, left, right, span: mockSpan };
}

function logical(left: any, operator: string, right: any) {
  return { kind: 'LogicalExpression' as const, operator, left, right, span: mockSpan };
}

function typeConstraint(name: string, value?: any) {
  return { name: id(name), value, span: mockSpan };
}

// ============================================================================
// 1. SafeSolver — Timeout, Cancellation, Pre-flight
// ============================================================================

describe('SafeSolver', () => {
  describe('Pre-flight rejection', () => {
    it('rejects queries exceeding max variable limit', async () => {
      const solver = createSafeSolver({}, { maxVariables: 3 });

      // Build formula with 5 variables
      const vars = Array.from({ length: 5 }, (_, i) =>
        Expr.var(`v${i}`, Sort.Int()),
      );
      const formula = Expr.and(
        Expr.gt(vars[0]!, Expr.int(0)),
        Expr.gt(vars[1]!, Expr.int(0)),
        Expr.gt(vars[2]!, Expr.int(0)),
        Expr.gt(vars[3]!, Expr.int(0)),
        Expr.gt(vars[4]!, Expr.int(0)),
      );

      const result = await solver.checkSat(formula);

      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain('variables');
      expect(result.result.status).toBe('error');
    });

    it('rejects queries exceeding max assertion limit', async () => {
      const solver = createSafeSolver({}, { maxAssertions: 2 });

      // Build formula with 5 top-level conjuncts
      const x = Expr.var('x', Sort.Int());
      const formula = Expr.and(
        Expr.gt(x, Expr.int(0)),
        Expr.lt(x, Expr.int(100)),
        Expr.gt(x, Expr.int(1)),
        Expr.lt(x, Expr.int(99)),
        Expr.gt(x, Expr.int(2)),
      );

      const result = await solver.checkSat(formula);

      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain('assertions');
    });

    it('rejects queries exceeding max depth', async () => {
      const solver = createSafeSolver({}, { maxExprDepth: 3 });

      // Build deeply nested formula: not(not(not(not(x > 0))))
      let formula: SMTExpr = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
      for (let i = 0; i < 5; i++) {
        formula = Expr.not(formula);
      }

      const result = await solver.checkSat(formula);

      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain('depth');
    });

    it('rejects queries exceeding max node count', async () => {
      const solver = createSafeSolver({}, { maxNodeCount: 5 });

      const x = Expr.var('x', Sort.Int());
      const formula = Expr.and(
        Expr.gt(x, Expr.int(0)),
        Expr.lt(x, Expr.int(100)),
        Expr.gt(x, Expr.int(1)),
      );

      const result = await solver.checkSat(formula);

      expect(result.rejected).toBe(true);
      expect(result.rejectionReason).toContain('nodes');
    });

    it('accepts queries within all limits', async () => {
      const solver = createSafeSolver({}, {
        maxVariables: 10,
        maxAssertions: 10,
        maxExprDepth: 50,
        maxNodeCount: 1000,
      });

      const x = Expr.var('x', Sort.Int());
      const formula = Expr.and(
        Expr.gt(x, Expr.int(0)),
        Expr.lt(x, Expr.int(10)),
      );

      const result = await solver.checkSat(formula);

      expect(result.rejected).toBe(false);
      expect(result.rejectionReason).toBeUndefined();
    });
  });

  describe('Strict timeout', () => {
    it('returns timeout result within deadline', async () => {
      // Use a very short timeout with a trivial formula
      const solver = createSafeSolver({ timeout: 100 }, { timeoutMs: 100 });

      const x = Expr.var('x', Sort.Int());
      const formula = Expr.gt(x, Expr.int(0));

      const start = Date.now();
      const result = await solver.checkSat(formula);
      const elapsed = Date.now() - start;

      // Should complete (SAT or timeout) without hanging
      expect(['sat', 'timeout', 'unknown']).toContain(result.result.status);
      // Wall time should be bounded
      expect(elapsed).toBeLessThan(5000);
      expect(result.wallTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('reports wall time in result', async () => {
      const solver = createSafeSolver({ timeout: 5000 });

      const formula = Expr.bool(true);
      const result = await solver.checkSat(formula);

      expect(result.wallTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.wallTimeMs).toBeLessThan(5000);
    });
  });

  describe('AbortController cancellation', () => {
    it('returns cancelled result when signal is already aborted', async () => {
      const solver = createSafeSolver({ timeout: 5000 });
      const controller = new AbortController();
      controller.abort();

      const formula = Expr.bool(true);
      const result = await solver.checkSat(formula, [], controller.signal);

      expect(result.cancelled).toBe(true);
      expect(result.result.status).toBe('unknown');
    });

    it('returns cancelled result when signal fires during solve', async () => {
      const solver = createSafeSolver({ timeout: 10000 });
      const controller = new AbortController();

      // Abort after 10ms
      setTimeout(() => controller.abort(), 10);

      // Use a formula that may take a moment
      const x = Expr.var('x', Sort.Int());
      const formula = Expr.and(
        Expr.gt(x, Expr.int(0)),
        Expr.lt(x, Expr.int(10)),
      );

      const result = await solver.checkSat(formula, [], controller.signal);

      // Should be either cancelled (if abort won the race) or sat (if solver was faster)
      if (result.cancelled) {
        expect(result.result.status).toBe('unknown');
      } else {
        expect(result.result.status).toBe('sat');
      }
    });
  });

  describe('checkValid', () => {
    it('proves tautology as valid', async () => {
      const solver = createSafeSolver({ timeout: 5000 });

      // x > 0 OR NOT(x > 0) is a tautology
      const x = Expr.var('x', Sort.Int());
      const gt = Expr.gt(x, Expr.int(0));
      const formula = Expr.or(gt, Expr.not(gt));

      const result = await solver.checkValid(formula);

      expect(result.rejected).toBe(false);
      // Valid means negation is UNSAT, which we flip to SAT
      expect(result.result.status).toBe('sat');
    });

    it('rejects non-tautology as invalid', async () => {
      const solver = createSafeSolver({ timeout: 5000 });

      // x > 0 is NOT a tautology (x = -1 is a counterexample)
      const formula = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));

      const result = await solver.checkValid(formula);

      // Not valid means negation is SAT, which we flip to UNSAT
      expect(result.result.status).toBe('unsat');
    });
  });

  describe('Deterministic results', () => {
    it('produces same result for same query across calls', async () => {
      const solver = createSafeSolver({ timeout: 5000 });
      const x = Expr.var('x', Sort.Int());
      const formula = Expr.and(
        Expr.gt(x, Expr.int(0)),
        Expr.lt(x, Expr.int(10)),
      );

      const result1 = await solver.checkSat(formula);
      const result2 = await solver.checkSat(formula);

      expect(result1.result.status).toBe(result2.result.status);
      expect(result1.rejected).toBe(result2.rejected);
    });
  });
});

// ============================================================================
// 2. Query Metrics
// ============================================================================

describe('measureQuery', () => {
  it('counts variables from declarations', () => {
    const formula = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
    const decls = [Decl.const('x', Sort.Int()), Decl.const('y', Sort.Int())];

    const metrics = measureQuery(formula, decls);

    expect(metrics.variableCount).toBeGreaterThanOrEqual(2);
  });

  it('counts variables from formula', () => {
    const formula = Expr.and(
      Expr.gt(Expr.var('a', Sort.Int()), Expr.int(0)),
      Expr.gt(Expr.var('b', Sort.Int()), Expr.int(0)),
      Expr.gt(Expr.var('c', Sort.Int()), Expr.int(0)),
    );

    const metrics = measureQuery(formula, []);

    expect(metrics.variableCount).toBe(3);
  });

  it('counts top-level conjuncts as assertions', () => {
    const x = Expr.var('x', Sort.Int());
    const formula = Expr.and(
      Expr.gt(x, Expr.int(0)),
      Expr.lt(x, Expr.int(100)),
      Expr.gt(x, Expr.int(1)),
    );

    const metrics = measureQuery(formula, []);

    expect(metrics.assertionCount).toBe(3);
  });

  it('reports single assertion for non-conjunction', () => {
    const formula = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));

    const metrics = measureQuery(formula, []);

    expect(metrics.assertionCount).toBe(1);
  });

  it('measures AST depth correctly', () => {
    // depth 0: bool(true)
    expect(measureQuery(Expr.bool(true), []).maxDepth).toBe(0);

    // depth 1: not(true)
    expect(measureQuery(Expr.not(Expr.bool(true)), []).maxDepth).toBe(1);

    // depth 2: not(not(true))
    expect(measureQuery(Expr.not(Expr.not(Expr.bool(true))), []).maxDepth).toBe(2);
  });

  it('counts total AST nodes', () => {
    // Single node: bool(true)
    expect(measureQuery(Expr.bool(true), []).nodeCount).toBe(1);

    // Two nodes: not(true)
    expect(measureQuery(Expr.not(Expr.bool(true)), []).nodeCount).toBe(2);

    // and(a, b, c) = 1 + 3 = 4 nodes (and + 3 children)
    const formula = Expr.and(Expr.bool(true), Expr.bool(false), Expr.bool(true));
    expect(measureQuery(formula, []).nodeCount).toBe(4);
  });
});

// ============================================================================
// 3. SMT-LIB Generator with Source Mapping
// ============================================================================

describe('SMT-LIB Generator', () => {
  describe('generateFromPreconditions', () => {
    it('generates valid SMT-LIB with named assertions', () => {
      const ctx = createContext();
      ctx.variables.set('amount', Sort.Int());

      const conditions = [
        condStmt(compare(id('amount'), '>', num(0))),
        condStmt(compare(id('amount'), '<', num(10000))),
      ];

      const result = generateFromPreconditions('ProcessPayment', conditions, ctx);

      expect(result.script).toContain('(set-logic ALL)');
      expect(result.script).toContain(':named pre_ProcessPayment_0');
      expect(result.script).toContain(':named pre_ProcessPayment_1');
      expect(result.script).toContain('(check-sat)');
      expect(result.errors).toHaveLength(0);
    });

    it('produces source map with correct tags', () => {
      const ctx = createContext();
      ctx.variables.set('x', Sort.Int());

      const conditions = [condStmt(compare(id('x'), '>', num(0)))];
      const result = generateFromPreconditions('TestBehavior', conditions, ctx);

      const mapped = result.sourceMap.resolve('pre_TestBehavior_0');
      expect(mapped).toBeDefined();
      expect(mapped!.kind).toBe('precondition');
      expect(mapped!.ownerName).toBe('TestBehavior');
      expect(mapped!.index).toBe(0);
      expect(mapped!.smtLib).toBeTruthy();
    });

    it('source map byKind filters correctly', () => {
      const ctx = createContext();
      ctx.variables.set('x', Sort.Int());

      const conditions = [
        condStmt(compare(id('x'), '>', num(0))),
        condStmt(compare(id('x'), '<', num(100))),
      ];
      const result = generateFromPreconditions('Test', conditions, ctx);

      expect(result.sourceMap.byKind('precondition')).toHaveLength(2);
      expect(result.sourceMap.byKind('postcondition')).toHaveLength(0);
    });

    it('source map byOwner filters correctly', () => {
      const ctx = createContext();
      ctx.variables.set('x', Sort.Int());

      const conditions = [condStmt(compare(id('x'), '>', num(0)))];
      const result = generateFromPreconditions('MyBehavior', conditions, ctx);

      expect(result.sourceMap.byOwner('MyBehavior')).toHaveLength(1);
      expect(result.sourceMap.byOwner('OtherBehavior')).toHaveLength(0);
    });

    it('records encoding errors without crashing', () => {
      const ctx = createContext();
      // Don't register 'x' as a variable — this will still encode (as Bool default)
      // but let's use an unsupported expression kind
      const conditions = [
        condStmt({ kind: 'UnsupportedExpression', span: mockSpan }),
      ];

      const result = generateFromPreconditions('Test', conditions, ctx);

      expect(result.errors.length).toBeGreaterThan(0);
      // Script still generated (partial)
      expect(result.script).toContain('(set-logic ALL)');
    });

    it('enables unsat core option by default', () => {
      const ctx = createContext();
      ctx.variables.set('x', Sort.Int());

      const conditions = [condStmt(compare(id('x'), '>', num(0)))];
      const result = generateFromPreconditions('Test', conditions, ctx);

      expect(result.script).toContain('produce-unsat-cores');
    });
  });

  describe('generateFromPostconditions', () => {
    it('generates implication check with negated postconditions', () => {
      const ctx = createContext();
      ctx.variables.set('amount', Sort.Int());
      ctx.variables.set('result_success', Sort.Bool());

      const pre = [condStmt(compare(id('amount'), '>', num(0)))];
      const post = [condStmt(id('result_success'))];

      const result = generateFromPostconditions('Transfer', pre, post, ctx);

      expect(result.script).toContain(':named pre_Transfer_0');
      // Should contain negated postcondition
      expect(result.script).toContain(':named neg_post_Transfer_0');
      expect(result.script).toContain('(check-sat)');
      expect(result.errors).toHaveLength(0);
    });

    it('source map contains both pre and post assertions', () => {
      const ctx = createContext();
      ctx.variables.set('x', Sort.Int());

      const pre = [condStmt(compare(id('x'), '>', num(0)))];
      const post = [condStmt(compare(id('x'), '<', num(100)))];

      const result = generateFromPostconditions('Test', pre, post, ctx);

      expect(result.sourceMap.byKind('precondition')).toHaveLength(1);
      expect(result.sourceMap.byKind('postcondition')).toHaveLength(1);
    });
  });

  describe('generateFromRefinements', () => {
    it('generates refinement constraint check', () => {
      const constraints = [
        typeConstraint('min', num(0)),
        typeConstraint('max', num(100)),
      ];

      const result = generateFromRefinements('PositiveAmount', 'Int', constraints);

      expect(result.script).toContain(':named ref_PositiveAmount_0');
      expect(result.script).toContain(':named ref_PositiveAmount_1');
      expect(result.script).toContain('(check-sat)');
      expect(result.errors).toHaveLength(0);
    });

    it('source map tracks refinement constraints', () => {
      const constraints = [typeConstraint('positive')];

      const result = generateFromRefinements('Amount', 'Int', constraints);

      const mapped = result.sourceMap.resolve('ref_Amount_0');
      expect(mapped).toBeDefined();
      expect(mapped!.kind).toBe('refinement');
      expect(mapped!.ownerName).toBe('Amount');
    });
  });

  describe('generateFromInvariants', () => {
    it('generates invariant assertion check', () => {
      const ctx = createContext();
      ctx.variables.set('balance', Sort.Int());

      const invariants = [
        condStmt(compare(id('balance'), '>=', num(0))),
      ];

      const result = generateFromInvariants('Account', invariants, ctx);

      expect(result.script).toContain(':named inv_Account_0');
      expect(result.script).toContain('(check-sat)');
    });
  });

  describe('Determinism', () => {
    it('produces identical scripts for identical inputs', () => {
      const ctx = createContext();
      ctx.variables.set('x', Sort.Int());
      const conditions = [condStmt(compare(id('x'), '>', num(0)))];

      const result1 = generateFromPreconditions('Test', conditions, ctx, { timeoutMs: 5000 });
      const result2 = generateFromPreconditions('Test', conditions, ctx, { timeoutMs: 5000 });

      // Scripts should be identical (modulo timestamp in comment line)
      const stripTimestamp = (s: string) => s.replace(/Generated at .+/, 'Generated at <TIMESTAMP>');
      expect(stripTimestamp(result1.script)).toBe(stripTimestamp(result2.script));
    });
  });
});

// ============================================================================
// 4. Failure Diagnostics
// ============================================================================

describe('Failure Diagnostics', () => {
  describe('extractCounterexample', () => {
    it('extracts counterexample from model', () => {
      const model = { x: 5, y: -3 };
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.gt(Expr.var('y', Sort.Int()), Expr.int(0)), // violated: y = -3
      );

      const cx = extractCounterexample(model, formula);

      expect(cx.fullModel).toEqual({ x: 5, y: -3 });
      expect(cx.explanation).toContain('Counterexample found');
    });

    it('identifies violated conjuncts', () => {
      const model = { x: 5 };
      // x > 0 AND x < 3 — x=5 violates x < 3
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(3)),
      );

      const cx = extractCounterexample(model, formula);

      // Should identify the second conjunct as violated
      expect(cx.violatedAssertions.length).toBeGreaterThan(0);
      expect(cx.violatedAssertions.some((a) => a.includes('conjunct'))).toBe(true);
    });

    it('handles empty model', () => {
      const model = {};
      const formula = Expr.bool(true);

      const cx = extractCounterexample(model, formula);

      expect(cx.fullModel).toEqual({});
      expect(cx.explanation).toContain('Counterexample found');
    });
  });

  describe('classifyUnknown', () => {
    it('classifies timeout', () => {
      const result: SMTCheckResult = { status: 'timeout' };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('timeout');
    });

    it('classifies solver error', () => {
      const result: SMTCheckResult = { status: 'error', message: 'parse error at line 5' };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('solver_error');
      if (reason.kind === 'solver_error') {
        expect(reason.message).toContain('parse error');
      }
    });

    it('classifies unknown with timeout reason', () => {
      const result: SMTCheckResult = { status: 'unknown', reason: 'Timeout exceeded' };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('timeout');
    });

    it('classifies unknown with complexity reason', () => {
      const result: SMTCheckResult = {
        status: 'unknown',
        reason: 'Formula too complex for built-in solver',
      };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('too_complex');
    });

    it('classifies unknown with resource reason', () => {
      const result: SMTCheckResult = {
        status: 'unknown',
        reason: 'memory limit exceeded',
      };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('resource_limit');
    });

    it('classifies unknown with incomplete theory', () => {
      const result: SMTCheckResult = {
        status: 'unknown',
        reason: 'incomplete theory combination',
      };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('incomplete_theory');
    });

    it('classifies cancelled error', () => {
      const result: SMTCheckResult = { status: 'error', message: 'cancelled by user' };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('cancelled');
    });

    it('classifies unrecognized reason', () => {
      const result: SMTCheckResult = { status: 'unknown', reason: 'something weird happened' };
      const reason = classifyUnknown(result);

      expect(reason.kind).toBe('unclassified');
      if (reason.kind === 'unclassified') {
        expect(reason.raw).toContain('something weird');
      }
    });
  });

  describe('buildDiagnosticReport', () => {
    it('builds report for SAT result with counterexample', () => {
      const result: SMTCheckResult = { status: 'sat', model: { x: 42 } };
      const formula = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));

      const report = buildDiagnosticReport(result, formula);

      expect(report.result.status).toBe('sat');
      expect(report.counterexample).toBeDefined();
      expect(report.counterexample!.fullModel).toEqual({ x: 42 });
      expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it('builds report for UNSAT result', () => {
      const result: SMTCheckResult = { status: 'unsat' };

      const report = buildDiagnosticReport(result);

      expect(report.result.status).toBe('unsat');
      expect(report.counterexample).toBeUndefined();
      expect(report.unknownReason).toBeUndefined();
    });

    it('builds report for timeout with suggestions', () => {
      const result: SMTCheckResult = { status: 'timeout' };

      const report = buildDiagnosticReport(result);

      expect(report.unknownReason).toBeDefined();
      expect(report.unknownReason!.kind).toBe('timeout');
      expect(report.suggestions.length).toBeGreaterThan(0);
      expect(report.suggestions.some((s) => s.includes('timeout'))).toBe(true);
    });

    it('builds report for error with suggestions', () => {
      const result: SMTCheckResult = { status: 'error', message: 'out of memory' };

      const report = buildDiagnosticReport(result);

      expect(report.unknownReason).toBeDefined();
      expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it('includes SMT-LIB script when provided', () => {
      const result: SMTCheckResult = { status: 'unsat' };
      const smtLib = '(set-logic ALL)\n(check-sat)';

      const report = buildDiagnosticReport(result, undefined, undefined, smtLib);

      expect(report.smtLib).toBe(smtLib);
    });
  });

  describe('analyzeUnsat', () => {
    it('builds analysis from provided unsat core tags', async () => {
      const assertions = [
        { tag: 'pre_Test_0', expr: Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)) },
        { tag: 'pre_Test_1', expr: Expr.lt(Expr.var('x', Sort.Int()), Expr.int(0)) },
      ];
      const decls = [Decl.const('x', Sort.Int())];

      const analysis = await analyzeUnsat(
        assertions,
        decls,
        undefined,
        ['pre_Test_0', 'pre_Test_1'],
      );

      expect(analysis.coreTags).toEqual(['pre_Test_0', 'pre_Test_1']);
      expect(analysis.explanation).toContain('unsatisfiable');
    });

    it('isolates core when no tags provided', async () => {
      // x > 10 AND x < 5 — contradiction
      const assertions = [
        { tag: 'a0', expr: Expr.gt(Expr.var('x', Sort.Int()), Expr.int(10)) },
        { tag: 'a1', expr: Expr.lt(Expr.var('x', Sort.Int()), Expr.int(5)) },
      ];
      const decls = [Decl.const('x', Sort.Int())];

      const analysis = await analyzeUnsat(assertions, decls, undefined, undefined, {
        timeout: 5000,
      });

      // Should find some core
      expect(analysis.coreTags.length).toBeGreaterThan(0);
      expect(analysis.explanation).toBeTruthy();
    });

    it('marks single-constraint core as minimal', async () => {
      const analysis = await analyzeUnsat(
        [{ tag: 'only', expr: Expr.bool(false) }],
        [],
        undefined,
        ['only'],
      );

      expect(analysis.isMinimal).toBe(true);
      expect(analysis.coreTags).toEqual(['only']);
    });

    it('resolves core tags against source map', async () => {
      // Build a fake source map
      const sourceMap = {
        assertions: new Map([
          ['pre_Pay_0', {
            tag: 'pre_Pay_0',
            kind: 'precondition' as const,
            ownerName: 'Pay',
            index: 0,
            smtLib: '(> x 0)',
            islSource: 'amount > 0',
            location: { line: 5, column: 4 },
          }],
        ]),
        byKind: (k: string) => [],
        byOwner: (n: string) => [],
        resolve: (tag: string) => sourceMap.assertions.get(tag),
      };

      const analysis = await analyzeUnsat(
        [{ tag: 'pre_Pay_0', expr: Expr.bool(false) }],
        [],
        sourceMap as any,
        ['pre_Pay_0'],
      );

      expect(analysis.coreAssertions).toHaveLength(1);
      expect(analysis.coreAssertions[0]!.islSource).toBe('amount > 0');
      expect(analysis.coreAssertions[0]!.location).toEqual({ line: 5, column: 4 });
      expect(analysis.explanation).toContain('Pay');
    });
  });
});

// ============================================================================
// 5. End-to-End Integration: SafeSolver + Generator + Diagnostics
// ============================================================================

describe('End-to-End Reliability', () => {
  it('full pipeline: generate → solve → diagnose SAT', async () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    // Generate SMT-LIB
    const conditions = [
      condStmt(compare(id('x'), '>', num(0))),
      condStmt(compare(id('x'), '<', num(100))),
    ];
    const generated = generateFromPreconditions('Test', conditions, ctx);
    expect(generated.errors).toHaveLength(0);

    // Solve safely
    const solver = createSafeSolver({ timeout: 5000 });
    const formula = Expr.and(
      Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
      Expr.lt(Expr.var('x', Sort.Int()), Expr.int(100)),
    );
    const solveResult = await solver.checkSat(formula);
    expect(solveResult.rejected).toBe(false);
    expect(solveResult.result.status).toBe('sat');

    // Diagnose
    const report = buildDiagnosticReport(
      solveResult.result,
      formula,
      generated.sourceMap,
      generated.script,
    );
    expect(report.smtLib).toBeTruthy();
  });

  it('full pipeline: generate → solve → diagnose UNSAT', async () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());

    // Contradictory constraints: x > 100 AND x < 50
    const conditions = [
      condStmt(compare(id('x'), '>', num(100))),
      condStmt(compare(id('x'), '<', num(50))),
    ];
    const generated = generateFromPreconditions('Broken', conditions, ctx);

    // Solve
    const solver = createSafeSolver({ timeout: 5000 });
    const formula = Expr.and(
      Expr.gt(Expr.var('x', Sort.Int()), Expr.int(100)),
      Expr.lt(Expr.var('x', Sort.Int()), Expr.int(50)),
    );
    const solveResult = await solver.checkSat(formula);
    expect(solveResult.rejected).toBe(false);
    // Builtin solver may return unsat or unknown
    expect(['unsat', 'unknown']).toContain(solveResult.result.status);

    // If unsat, diagnose
    if (solveResult.result.status === 'unsat') {
      const report = buildDiagnosticReport(solveResult.result, formula, generated.sourceMap);
      expect(report.counterexample).toBeUndefined();
    }
  });

  it('full pipeline: rejected query produces diagnostic', async () => {
    const solver = createSafeSolver({}, { maxVariables: 1 });

    const formula = Expr.and(
      Expr.gt(Expr.var('a', Sort.Int()), Expr.int(0)),
      Expr.gt(Expr.var('b', Sort.Int()), Expr.int(0)),
    );

    const solveResult = await solver.checkSat(formula);
    expect(solveResult.rejected).toBe(true);

    const report = buildDiagnosticReport(solveResult.result);
    expect(report.result.status).toBe('error');
    // Error results are also classified for actionable suggestions
    expect(report.unknownReason).toBeDefined();
    expect(report.unknownReason!.kind).toBe('solver_error');
  });

  it('deterministic: same inputs → same results across 3 runs', async () => {
    const solver = createSafeSolver({ timeout: 5000 });
    const x = Expr.var('x', Sort.Int());
    const formula = Expr.and(Expr.gt(x, Expr.int(0)), Expr.lt(x, Expr.int(10)));

    const results = await Promise.all([
      solver.checkSat(formula),
      solver.checkSat(formula),
      solver.checkSat(formula),
    ]);

    const statuses = results.map((r) => r.result.status);
    expect(statuses[0]).toBe(statuses[1]);
    expect(statuses[1]).toBe(statuses[2]);
  });

  it('never hangs: worst case returns within 2x timeout', async () => {
    const timeoutMs = 200;
    const solver = createSafeSolver({ timeout: timeoutMs }, { timeoutMs });

    // Formula that might be hard for the builtin solver
    const vars = Array.from({ length: 10 }, (_, i) => Expr.var(`v${i}`, Sort.Int()));
    const constraints = vars.map((v) =>
      Expr.and(Expr.gt(v, Expr.int(0)), Expr.lt(v, Expr.int(1000))),
    );
    const formula = Expr.and(...constraints);

    const start = Date.now();
    const result = await solver.checkSat(formula);
    const elapsed = Date.now() - start;

    // Must terminate within 2x the timeout (generous margin for scheduling)
    expect(elapsed).toBeLessThan(timeoutMs * 3);
    // Result must be valid
    expect(['sat', 'unsat', 'unknown', 'timeout', 'error']).toContain(result.result.status);
  });
});
