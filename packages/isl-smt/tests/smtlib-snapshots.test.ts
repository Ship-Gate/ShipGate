/**
 * SMT-LIB Generation Snapshot Tests
 * 
 * Tests to ensure SMT-LIB generation is stable and produces
 * correct, deterministic output.
 */

import { describe, it, expect } from 'vitest';
import { translate } from '../src/solver.js';
import { Expr, Sort, Decl } from '@isl-lang/prover';

describe('SMT-LIB Generation Snapshots', () => {
  describe('Boolean Formulas', () => {
    it('should generate correct true constant', () => {
      const formula = Expr.bool(true);
      const smtlib = translate(formula);
      
      expect(smtlib).toMatchInlineSnapshot(`
        "; ISL SMT Query
        (set-logic ALL)
        (set-option :produce-models true)

        ; Declarations

        ; Formula
        (assert true)

        (check-sat)
        (get-model)"
      `);
    });
    
    it('should generate correct false constant', () => {
      const formula = Expr.bool(false);
      const smtlib = translate(formula);
      
      expect(smtlib).toMatchInlineSnapshot(`
        "; ISL SMT Query
        (set-logic ALL)
        (set-option :produce-models true)

        ; Declarations

        ; Formula
        (assert false)

        (check-sat)
        (get-model)"
      `);
    });
    
    it('should generate correct NOT', () => {
      const formula = Expr.not(Expr.var('a', Sort.Bool()));
      const decls = [Decl.const('a', Sort.Bool())];
      const smtlib = translate(formula, decls);
      
      expect(smtlib).toContain('(declare-const a Bool)');
      expect(smtlib).toContain('(assert (not a))');
    });
    
    it('should generate correct AND', () => {
      const formula = Expr.and(
        Expr.var('a', Sort.Bool()),
        Expr.var('b', Sort.Bool())
      );
      const decls = [
        Decl.const('a', Sort.Bool()),
        Decl.const('b', Sort.Bool()),
      ];
      const smtlib = translate(formula, decls);
      
      expect(smtlib).toContain('(declare-const a Bool)');
      expect(smtlib).toContain('(declare-const b Bool)');
      expect(smtlib).toContain('(assert (and a b))');
    });
    
    it('should generate correct OR', () => {
      const formula = Expr.or(
        Expr.var('a', Sort.Bool()),
        Expr.var('b', Sort.Bool())
      );
      const decls = [
        Decl.const('a', Sort.Bool()),
        Decl.const('b', Sort.Bool()),
      ];
      const smtlib = translate(formula, decls);
      
      expect(smtlib).toContain('(assert (or a b))');
    });
    
    it('should generate correct IMPLIES', () => {
      const formula = Expr.implies(
        Expr.var('a', Sort.Bool()),
        Expr.var('b', Sort.Bool())
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (=> a b))');
    });
    
    it('should generate correct IFF', () => {
      const formula = Expr.iff(
        Expr.var('a', Sort.Bool()),
        Expr.var('b', Sort.Bool())
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= a b))');
    });
  });
  
  describe('Integer Arithmetic', () => {
    it('should generate correct integer constant', () => {
      const formula = Expr.eq(
        Expr.var('x', Sort.Int()),
        Expr.int(42)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= x 42))');
    });
    
    it('should generate correct negative integer', () => {
      const formula = Expr.eq(
        Expr.var('x', Sort.Int()),
        Expr.int(-42)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= x (- 42)))');
    });
    
    it('should generate correct addition', () => {
      const formula = Expr.eq(
        Expr.add(
          Expr.var('x', Sort.Int()),
          Expr.var('y', Sort.Int())
        ),
        Expr.int(10)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= (+ x y) 10))');
    });
    
    it('should generate correct subtraction', () => {
      const formula = Expr.eq(
        Expr.sub(
          Expr.var('x', Sort.Int()),
          Expr.var('y', Sort.Int())
        ),
        Expr.int(5)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= (- x y) 5))');
    });
    
    it('should generate correct multiplication', () => {
      const formula = Expr.eq(
        Expr.mul(
          Expr.var('x', Sort.Int()),
          Expr.int(2)
        ),
        Expr.int(10)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= (* x 2) 10))');
    });
    
    it('should generate correct division', () => {
      const formula = Expr.eq(
        Expr.div(
          Expr.var('x', Sort.Int()),
          Expr.int(2)
        ),
        Expr.int(5)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= (div x 2) 5))');
    });
    
    it('should generate correct modulo', () => {
      const formula = Expr.eq(
        Expr.mod(
          Expr.var('x', Sort.Int()),
          Expr.int(3)
        ),
        Expr.int(1)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= (mod x 3) 1))');
    });
  });
  
  describe('Comparisons', () => {
    it('should generate correct equality', () => {
      const formula = Expr.eq(
        Expr.var('x', Sort.Int()),
        Expr.var('y', Sort.Int())
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (= x y))');
    });
    
    it('should generate correct less-than', () => {
      const formula = Expr.lt(
        Expr.var('x', Sort.Int()),
        Expr.int(10)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (< x 10))');
    });
    
    it('should generate correct less-equal', () => {
      const formula = Expr.le(
        Expr.var('x', Sort.Int()),
        Expr.int(10)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (<= x 10))');
    });
    
    it('should generate correct greater-than', () => {
      const formula = Expr.gt(
        Expr.var('x', Sort.Int()),
        Expr.int(0)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (> x 0))');
    });
    
    it('should generate correct greater-equal', () => {
      const formula = Expr.ge(
        Expr.var('x', Sort.Int()),
        Expr.int(0)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (>= x 0))');
    });
  });
  
  describe('Quantifiers', () => {
    it('should generate correct forall', () => {
      const formula = Expr.forall(
        [{ name: 'x', sort: Sort.Int() }],
        Expr.ge(Expr.var('x', Sort.Int()), Expr.int(0))
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(forall ((x Int))');
      expect(smtlib).toContain('(>= x 0)');
    });
    
    it('should generate correct exists', () => {
      const formula = Expr.exists(
        [{ name: 'x', sort: Sort.Int() }],
        Expr.eq(Expr.var('x', Sort.Int()), Expr.int(42))
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(exists ((x Int))');
      expect(smtlib).toContain('(= x 42)');
    });
  });
  
  describe('Conditional', () => {
    it('should generate correct if-then-else', () => {
      const formula = Expr.eq(
        Expr.ite(
          Expr.var('cond', Sort.Bool()),
          Expr.int(1),
          Expr.int(0)
        ),
        Expr.var('result', Sort.Int())
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(ite cond 1 0)');
    });
  });
  
  describe('Arrays', () => {
    it('should generate correct array select', () => {
      const arraySort = Sort.Array(Sort.Int(), Sort.Int());
      const formula = Expr.eq(
        Expr.select(
          Expr.var('arr', arraySort),
          Expr.int(0)
        ),
        Expr.int(42)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(select arr 0)');
    });
    
    it('should generate correct array store', () => {
      const arraySort = Sort.Array(Sort.Int(), Sort.Int());
      const formula = Expr.eq(
        Expr.select(
          Expr.store(
            Expr.var('arr', arraySort),
            Expr.int(0),
            Expr.int(42)
          ),
          Expr.int(0)
        ),
        Expr.int(42)
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(store arr 0 42)');
    });
  });
  
  describe('Complex Formulas', () => {
    it('should generate correct nested formula', () => {
      // (x > 0 AND x < 10) OR (x == 42)
      const formula = Expr.or(
        Expr.and(
          Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
          Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
        ),
        Expr.eq(Expr.var('x', Sort.Int()), Expr.int(42))
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(assert (or (and (> x 0) (< x 10)) (= x 42)))');
    });
    
    it('should generate correct multi-variable formula', () => {
      // x + y == 10 AND x >= 0 AND y >= 0
      const formula = Expr.and(
        Expr.eq(
          Expr.add(Expr.var('x', Sort.Int()), Expr.var('y', Sort.Int())),
          Expr.int(10)
        ),
        Expr.ge(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.ge(Expr.var('y', Sort.Int()), Expr.int(0))
      );
      const smtlib = translate(formula);
      
      expect(smtlib).toContain('(+ x y)');
      expect(smtlib).toContain('(>= x 0)');
      expect(smtlib).toContain('(>= y 0)');
    });
  });
  
  describe('Determinism', () => {
    it('should generate identical output for same formula', () => {
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(100))
      );
      const decls = [Decl.const('x', Sort.Int())];
      
      const smtlib1 = translate(formula, decls);
      const smtlib2 = translate(formula, decls);
      const smtlib3 = translate(formula, decls);
      
      expect(smtlib1).toBe(smtlib2);
      expect(smtlib2).toBe(smtlib3);
    });
    
    it('should be independent of declaration order in semantics', () => {
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('y', Sort.Int()), Expr.int(10))
      );
      
      // Note: declarations are sorted internally for determinism
      const decls1 = [Decl.const('x', Sort.Int()), Decl.const('y', Sort.Int())];
      const decls2 = [Decl.const('y', Sort.Int()), Decl.const('x', Sort.Int())];
      
      const smtlib1 = translate(formula, decls1);
      const smtlib2 = translate(formula, decls2);
      
      // Both should contain the same declarations (order may vary)
      expect(smtlib1).toContain('(declare-const x Int)');
      expect(smtlib1).toContain('(declare-const y Int)');
      expect(smtlib2).toContain('(declare-const x Int)');
      expect(smtlib2).toContain('(declare-const y Int)');
    });
  });
  
  describe('Required Elements', () => {
    it('should always include set-logic', () => {
      const smtlib = translate(Expr.bool(true));
      expect(smtlib).toContain('(set-logic ALL)');
    });
    
    it('should always include check-sat', () => {
      const smtlib = translate(Expr.bool(true));
      expect(smtlib).toContain('(check-sat)');
    });
    
    it('should always include get-model', () => {
      const smtlib = translate(Expr.bool(true));
      expect(smtlib).toContain('(get-model)');
    });
    
    it('should always include produce-models option', () => {
      const smtlib = translate(Expr.bool(true));
      expect(smtlib).toContain('(set-option :produce-models true)');
    });
  });
});
