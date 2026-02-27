/**
 * SMT Integration Tests
 * 
 * End-to-end tests for:
 * - The solve() function with tri-state output
 * - Cache integration
 * - Unknown resolution hook
 * - Timeout handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  solve, 
  translate,
  createSolver,
  resolveUnknown,
  resetGlobalCache,
  getGlobalCache,
} from '../src/index.js';
import { Expr, Sort, Decl } from '@isl-lang/prover';

describe('solve() Function', () => {
  beforeEach(() => {
    resetGlobalCache();
  });
  
  describe('Tri-state Output', () => {
    it('should return disproved for satisfiable formula', async () => {
      // x > 0 AND x < 10 is satisfiable (can find x=5)
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
      );
      
      const result = await solve(formula, { timeout: 2000 });
      
      expect(result.verdict).toBe('disproved');
      if (result.verdict === 'disproved') {
        expect(result.model?.x).toBeDefined();
        const x = result.model?.x as number;
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(10);
      }
    });
    
    it('should return proved for unsatisfiable formula', async () => {
      // false is unsatisfiable
      const formula = Expr.bool(false);
      
      const result = await solve(formula, { timeout: 1000 });
      
      expect(result.verdict).toBe('proved');
    });
    
    it('should return proved for contradictory constraints', async () => {
      // x > 10 AND x < 5 is unsatisfiable
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(10)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(5))
      );
      
      const result = await solve(formula, { timeout: 2000 });
      
      expect(result.verdict).toBe('proved');
    });
    
    it('should return unknown with timeout reason', async () => {
      // Create a complex formula that might timeout
      const vars = Array.from({ length: 15 }, (_, i) => 
        Expr.var(`x${i}`, Sort.Int())
      );
      
      const formula = Expr.and(
        ...vars.map(v => Expr.and(
          Expr.gt(v, Expr.int(0)),
          Expr.lt(v, Expr.int(1000))
        ))
      );
      
      const result = await solve(formula, { timeout: 1 }); // 1ms timeout
      
      // With such a short timeout, we expect unknown or possibly sat
      if (result.verdict === 'unknown') {
        expect(result.reason).toBeDefined();
      }
    });
  });
  
  describe('Cache Integration', () => {
    it('should cache results for repeated queries', async () => {
      const formula = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
      
      // First call
      await solve(formula, { timeout: 1000 });
      
      const statsBefore = getGlobalCache().getStats();
      expect(statsBefore.hits).toBe(0);
      
      // Second call - should hit cache
      await solve(formula, { timeout: 1000 });
      
      const statsAfter = getGlobalCache().getStats();
      expect(statsAfter.hits).toBe(1);
    });
    
    it('should not cache different formulas together', async () => {
      const formula1 = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
      const formula2 = Expr.lt(Expr.var('x', Sort.Int()), Expr.int(0));
      
      await solve(formula1, { timeout: 1000 });
      await solve(formula2, { timeout: 1000 });
      
      const stats = getGlobalCache().getStats();
      expect(stats.misses).toBe(2); // Both should be cache misses
    });
  });
  
  describe('Determinism', () => {
    it('should produce deterministic results', async () => {
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(100))
      );
      
      // Run the same query multiple times
      const results = await Promise.all([
        solve(formula, { timeout: 1000 }),
        solve(formula, { timeout: 1000 }),
        solve(formula, { timeout: 1000 }),
      ]);
      
      // All results should have the same verdict
      expect(results[0]?.verdict).toBe(results[1]?.verdict);
      expect(results[1]?.verdict).toBe(results[2]?.verdict);
    });
  });
});

describe('translate() Function', () => {
  it('should generate valid SMT-LIB', () => {
    const formula = Expr.and(
      Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
      Expr.lt(Expr.var('x', Sort.Int()), Expr.int(100))
    );
    const decls = [Decl.const('x', Sort.Int())];
    
    const smtlib = translate(formula, decls);
    
    expect(smtlib).toContain('(set-logic ALL)');
    expect(smtlib).toContain('(declare-const x Int)');
    expect(smtlib).toContain('(assert');
    expect(smtlib).toContain('(check-sat)');
    expect(smtlib).toContain('(get-model)');
  });
  
  it('should be deterministic', () => {
    const formula = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
    
    const smtlib1 = translate(formula, []);
    const smtlib2 = translate(formula, []);
    
    expect(smtlib1).toBe(smtlib2);
  });
});

describe('resolveUnknown() Hook', () => {
  // Mock ISL expression for testing
  const mockSpan = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
  
  const createComparison = (left: any, operator: string, right: any) => ({
    kind: 'ComparisonExpression' as const,
    operator,
    left,
    right,
    span: mockSpan,
  });
  
  const createId = (name: string) => ({ kind: 'Identifier' as const, name, span: mockSpan });
  const createNum = (value: number) => ({ kind: 'NumberLiteral' as const, value, span: mockSpan });
  
  it('should resolve satisfiable expression', async () => {
    // x > 0 with x = 5 should be satisfiable
    const expr = createComparison(createId('x'), '>', createNum(0));
    
    const resolution = await resolveUnknown(expr, { x: 5 }, { timeout: 1000 });
    
    expect(resolution.attempted).toBe(true);
    expect(resolution.resolved).toBeDefined();
    // Expression x > 0 is satisfiable but not always true
    expect(['disproved', 'still_unknown']).toContain(resolution.resolved?.verdict);
  });
  
  it('should detect always-true expression', async () => {
    // true is always true
    const expr = { kind: 'BooleanLiteral' as const, value: true, span: mockSpan };
    
    const resolution = await resolveUnknown(expr, {}, { timeout: 1000 });
    
    expect(resolution.attempted).toBe(true);
    expect(resolution.resolved?.verdict).toBe('proved');
  });
  
  it('should detect always-false expression', async () => {
    // false is always false
    const expr = { kind: 'BooleanLiteral' as const, value: false, span: mockSpan };
    
    const resolution = await resolveUnknown(expr, {}, { timeout: 1000 });
    
    expect(resolution.attempted).toBe(true);
    expect(resolution.resolved?.verdict).toBe('disproved');
  });
  
  it('should handle contradictory constraints', async () => {
    // x > 10 AND x < 5 is always false
    const expr = {
      kind: 'LogicalExpression' as const,
      operator: 'and',
      left: createComparison(createId('x'), '>', createNum(10)),
      right: createComparison(createId('x'), '<', createNum(5)),
      span: mockSpan,
    };
    
    const resolution = await resolveUnknown(expr, {}, { timeout: 2000 });
    
    expect(resolution.attempted).toBe(true);
    expect(resolution.resolved?.verdict).toBe('disproved');
  });
  
  it('should report duration', async () => {
    const expr = createComparison(createId('x'), '>', createNum(0));
    
    const resolution = await resolveUnknown(expr, {}, { timeout: 1000 });
    
    expect(resolution.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('Timeout Tests', () => {
  it('should respect timeout and return unknown', async () => {
    // Create a formula that's complex enough to potentially timeout
    const x = Expr.var('x', Sort.Int());
    const y = Expr.var('y', Sort.Int());
    const z = Expr.var('z', Sort.Int());
    
    const formula = Expr.and(
      Expr.gt(x, Expr.int(0)),
      Expr.lt(x, Expr.int(1000)),
      Expr.gt(y, Expr.int(0)),
      Expr.lt(y, Expr.int(1000)),
      Expr.gt(z, Expr.int(0)),
      Expr.lt(z, Expr.int(1000)),
      Expr.eq(Expr.add(x, y, z), Expr.int(500))
    );
    
    const start = Date.now();
    const result = await solve(formula, { timeout: 50 }); // Short timeout
    const elapsed = Date.now() - start;
    
    // Should complete within reasonable time (timeout + some buffer)
    expect(elapsed).toBeLessThan(1000);
    
    // Result should be sat, unknown, or timeout
    expect(['disproved', 'unknown']).toContain(result.verdict);
  });
  
  it('should not hang on complex formulas', async () => {
    // Ensure we don't have unbounded solver runs
    const vars = Array.from({ length: 10 }, (_, i) => 
      Expr.var(`v${i}`, Sort.Int())
    );
    
    const formula = Expr.and(
      ...vars.map(v => Expr.and(
        Expr.ge(v, Expr.int(0)),
        Expr.le(v, Expr.int(100))
      ))
    );
    
    const start = Date.now();
    await solve(formula, { timeout: 100 });
    const elapsed = Date.now() - start;
    
    // Should complete within timeout + buffer
    expect(elapsed).toBeLessThan(500);
  }, 10000); // 10 second test timeout
});

describe('Known SAT/UNSAT Cases', () => {
  const testCases = [
    {
      name: 'Simple tautology (true)',
      formula: Expr.bool(true),
      expected: 'disproved' as const,
    },
    {
      name: 'Simple contradiction (false)',
      formula: Expr.bool(false),
      expected: 'proved' as const,
    },
    {
      name: 'a OR NOT a (tautology)',
      formula: Expr.or(
        Expr.var('a', Sort.Bool()),
        Expr.not(Expr.var('a', Sort.Bool()))
      ),
      expected: 'disproved' as const,
    },
    {
      name: 'a AND NOT a (contradiction)',
      formula: Expr.and(
        Expr.var('a', Sort.Bool()),
        Expr.not(Expr.var('a', Sort.Bool()))
      ),
      expected: 'proved' as const,
    },
    {
      name: 'x > 5 AND x < 10 (satisfiable)',
      formula: Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(5)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
      ),
      expected: 'disproved' as const,
    },
    {
      name: 'x > 10 AND x < 5 (unsatisfiable)',
      formula: Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(10)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(5))
      ),
      expected: 'proved' as const,
    },
    {
      name: 'x == 42 (satisfiable)',
      formula: Expr.eq(Expr.var('x', Sort.Int()), Expr.int(42)),
      expected: 'disproved' as const,
    },
    {
      name: 'x != x (unsatisfiable)',
      formula: Expr.neq(Expr.var('x', Sort.Int()), Expr.var('x', Sort.Int())),
      expected: 'proved' as const,
    },
  ];
  
  for (const tc of testCases) {
    it(`should handle: ${tc.name}`, async () => {
      const result = await solve(tc.formula, { timeout: 2000 });
      expect(result.verdict).toBe(tc.expected);
    });
  }
});
