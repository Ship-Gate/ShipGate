/**
 * Built-in Solver Tests
 * 
 * Tests for the enhanced builtin solver:
 * - Boolean SAT solving
 * - Integer arithmetic with bounds
 * - Timeout handling
 * - Complex constraint solving
 */

import { describe, it, expect } from 'vitest';
import { BuiltinSolver } from '../src/builtin-solver.js';
import { Expr, Sort, Decl } from '@isl-lang/prover';

describe('BuiltinSolver', () => {
  describe('Boolean Formulas', () => {
    it('should solve trivially true formula', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const result = await solver.checkSat(Expr.bool(true), []);
      
      expect(result.status).toBe('sat');
    });
    
    it('should solve trivially false formula', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const result = await solver.checkSat(Expr.bool(false), []);
      
      expect(result.status).toBe('unsat');
    });
    
    it('should solve simple AND formula', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const formula = Expr.and(
        Expr.var('a', Sort.Bool()),
        Expr.var('b', Sort.Bool())
      );
      const decls = [
        Decl.const('a', Sort.Bool()),
        Decl.const('b', Sort.Bool()),
      ];
      
      const result = await solver.checkSat(formula, decls);
      
      expect(result.status).toBe('sat');
      expect(result.model).toBeDefined();
      expect(result.model?.a).toBe(true);
      expect(result.model?.b).toBe(true);
    });
    
    it('should detect unsatisfiable AND', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const a = Expr.var('a', Sort.Bool());
      const formula = Expr.and(a, Expr.not(a));
      
      const result = await solver.checkSat(formula, [Decl.const('a', Sort.Bool())]);
      
      expect(result.status).toBe('unsat');
    });
    
    it('should solve OR formula', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const formula = Expr.or(
        Expr.var('a', Sort.Bool()),
        Expr.var('b', Sort.Bool())
      );
      
      const result = await solver.checkSat(formula, [
        Decl.const('a', Sort.Bool()),
        Decl.const('b', Sort.Bool()),
      ]);
      
      expect(result.status).toBe('sat');
    });
    
    it('should solve implication', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const a = Expr.var('a', Sort.Bool());
      const b = Expr.var('b', Sort.Bool());
      
      // a implies b is satisfiable (a=false or b=true)
      const formula = Expr.implies(a, b);
      
      const result = await solver.checkSat(formula, [
        Decl.const('a', Sort.Bool()),
        Decl.const('b', Sort.Bool()),
      ]);
      
      expect(result.status).toBe('sat');
    });
  });
  
  describe('Integer Arithmetic', () => {
    it('should solve simple comparison', async () => {
      const solver = new BuiltinSolver({ timeout: 1000, maxIntBound: 100 });
      const x = Expr.var('x', Sort.Int());
      
      // x > 0 is satisfiable
      const formula = Expr.gt(x, Expr.int(0));
      
      const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);
      
      expect(result.status).toBe('sat');
      expect(result.model?.x).toBeGreaterThan(0);
    });
    
    it('should solve bounded range', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const x = Expr.var('x', Sort.Int());
      
      // x > 0 AND x < 10
      const formula = Expr.and(
        Expr.gt(x, Expr.int(0)),
        Expr.lt(x, Expr.int(10))
      );
      
      const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);
      
      expect(result.status).toBe('sat');
      const xVal = result.model?.x as number;
      expect(xVal).toBeGreaterThan(0);
      expect(xVal).toBeLessThan(10);
    });
    
    it('should detect unsatisfiable range', async () => {
      const solver = new BuiltinSolver({ timeout: 1000 });
      const x = Expr.var('x', Sort.Int());
      
      // x > 10 AND x < 5 is unsatisfiable
      const formula = Expr.and(
        Expr.gt(x, Expr.int(10)),
        Expr.lt(x, Expr.int(5))
      );
      
      const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);
      
      expect(result.status).toBe('unsat');
    });
    
    it('should solve equality', async () => {
      const solver = new BuiltinSolver({ timeout: 1000, maxIntBound: 50 });
      const x = Expr.var('x', Sort.Int());
      
      // x == 42
      const formula = Expr.eq(x, Expr.int(42));
      
      const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);
      
      expect(result.status).toBe('sat');
      expect(result.model?.x).toBe(42);
    });
    
    it('should solve multiple variables', async () => {
      const solver = new BuiltinSolver({ timeout: 2000, maxIntBound: 20 });
      const x = Expr.var('x', Sort.Int());
      const y = Expr.var('y', Sort.Int());
      
      // x > 0 AND y > 0 AND x + y == 10
      const formula = Expr.and(
        Expr.gt(x, Expr.int(0)),
        Expr.gt(y, Expr.int(0)),
        Expr.eq(Expr.add(x, y), Expr.int(10))
      );
      
      const result = await solver.checkSat(formula, [
        Decl.const('x', Sort.Int()),
        Decl.const('y', Sort.Int()),
      ]);
      
      expect(result.status).toBe('sat');
      const xVal = result.model?.x as number;
      const yVal = result.model?.y as number;
      expect(xVal).toBeGreaterThan(0);
      expect(yVal).toBeGreaterThan(0);
      expect(xVal + yVal).toBe(10);
    });
    
    it('should handle arithmetic expressions', async () => {
      const solver = new BuiltinSolver({ timeout: 1000, maxIntBound: 50 });
      const x = Expr.var('x', Sort.Int());
      
      // 2*x + 1 > 10  =>  x > 4.5  =>  x >= 5
      const formula = Expr.gt(
        Expr.add(Expr.mul(Expr.int(2), x), Expr.int(1)),
        Expr.int(10)
      );
      
      const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);
      
      expect(result.status).toBe('sat');
      const xVal = result.model?.x as number;
      expect(2 * xVal + 1).toBeGreaterThan(10);
    });
  });
  
  describe('Timeout Handling', () => {
    it('should timeout for complex formulas with short timeout', async () => {
      const solver = new BuiltinSolver({ 
        timeout: 1, // 1ms - very short
        maxIterations: 10, // Very few iterations
      });
      
      // Create a complex formula with many variables
      const vars = Array.from({ length: 20 }, (_, i) => 
        Expr.var(`x${i}`, Sort.Int())
      );
      
      const formula = Expr.and(
        ...vars.map(v => Expr.and(
          Expr.gt(v, Expr.int(0)),
          Expr.lt(v, Expr.int(100))
        ))
      );
      
      const decls = vars.map((_, i) => Decl.const(`x${i}`, Sort.Int()));
      
      const result = await solver.checkSat(formula, decls);
      
      // Should either timeout or return unknown due to complexity
      expect(['timeout', 'unknown']).toContain(result.status);
    });
    
    it('should return unknown for too many variables', async () => {
      const solver = new BuiltinSolver({ timeout: 1000, maxIntBound: 10 });
      
      // Create many boolean variables (more than 20)
      const vars = Array.from({ length: 25 }, (_, i) => 
        Expr.var(`b${i}`, Sort.Bool())
      );
      
      const formula = Expr.and(...vars);
      const decls = vars.map((_, i) => Decl.const(`b${i}`, Sort.Bool()));
      
      const result = await solver.checkSat(formula, decls);
      
      expect(result.status).toBe('unknown');
      if (result.status === 'unknown') {
        expect(result.reason).toContain('variable');
      }
    });
  });
  
  describe('Mixed Boolean and Integer', () => {
    it('should solve mixed formula', async () => {
      const solver = new BuiltinSolver({ timeout: 2000, maxIntBound: 20 });
      
      const b = Expr.var('b', Sort.Bool());
      const x = Expr.var('x', Sort.Int());
      
      // b AND x > 5
      const formula = Expr.and(b, Expr.gt(x, Expr.int(5)));
      
      const result = await solver.checkSat(formula, [
        Decl.const('b', Sort.Bool()),
        Decl.const('x', Sort.Int()),
      ]);
      
      expect(result.status).toBe('sat');
      expect(result.model?.b).toBe(true);
      expect(result.model?.x).toBeGreaterThan(5);
    });
    
    it('should solve ITE expression', async () => {
      const solver = new BuiltinSolver({ timeout: 1000, maxIntBound: 20 });
      
      const b = Expr.var('b', Sort.Bool());
      const x = Expr.var('x', Sort.Int());
      
      // (if b then x else 0) > 5  =>  b=true and x > 5
      const formula = Expr.gt(
        Expr.ite(b, x, Expr.int(0)),
        Expr.int(5)
      );
      
      const result = await solver.checkSat(formula, [
        Decl.const('b', Sort.Bool()),
        Decl.const('x', Sort.Int()),
      ]);
      
      expect(result.status).toBe('sat');
    });
  });
});
