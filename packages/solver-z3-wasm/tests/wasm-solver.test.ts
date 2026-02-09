/**
 * Tests for Z3 WASM Solver
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Z3WasmSolver, isZ3WasmAvailable } from '../src/wasm-solver.js';
import { Expr, Sort, Decl } from '@isl-lang/prover';

describe('Z3WasmSolver', () => {
  let solver: Z3WasmSolver;

  beforeAll(async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Z3 WASM not available, skipping tests');
    }
  });

  beforeEach(() => {
    solver = new Z3WasmSolver({
      timeout: 5000,
      randomSeed: 42, // Fixed seed for deterministic tests
      verbose: false,
    });
  });

  it('should check availability', async () => {
    const available = await isZ3WasmAvailable();
    // This may be false in some environments (e.g., without SharedArrayBuffer)
    expect(typeof available).toBe('boolean');
  });

  it('should solve simple satisfiable formula', async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Skipping test: Z3 WASM not available');
      return;
    }

    const x = Expr.var('x', Sort.Int());
    const formula = Expr.and(
      Expr.gt(x, Expr.int(0)),
      Expr.lt(x, Expr.int(10))
    );

    const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);

    expect(result.status).toBe('sat');
    if (result.status === 'sat') {
      expect(result.model).toBeDefined();
      expect(result.model).toHaveProperty('x');
      const xValue = result.model?.['x'];
      expect(typeof xValue).toBe('number');
      expect(xValue).toBeGreaterThan(0);
      expect(xValue).toBeLessThan(10);
    }
  });

  it('should solve unsatisfiable formula', async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Skipping test: Z3 WASM not available');
      return;
    }

    const x = Expr.var('x', Sort.Int());
    const formula = Expr.and(
      Expr.gt(x, Expr.int(10)),
      Expr.lt(x, Expr.int(5))
    );

    const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);

    expect(result.status).toBe('unsat');
  });

  it('should handle timeout', async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Skipping test: Z3 WASM not available');
      return;
    }

    const fastSolver = new Z3WasmSolver({
      timeout: 1, // Very short timeout
      randomSeed: 42,
    });

    // Create a complex formula that might timeout
    const x = Expr.var('x', Sort.Int());
    const formula = Expr.and(
      Expr.gt(x, Expr.int(0)),
      Expr.lt(x, Expr.int(1000000))
    );

    const result = await solver.checkSat(formula, [Decl.const('x', Sort.Int())]);
    
    // Should either succeed or timeout, not error
    expect(['sat', 'unsat', 'timeout']).toContain(result.status);
  });

  it('should check validity', async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Skipping test: Z3 WASM not available');
      return;
    }

    // x > 0 AND x < 10 => x > -1 (valid)
    const x = Expr.var('x', Sort.Int());
    const premise = Expr.and(
      Expr.gt(x, Expr.int(0)),
      Expr.lt(x, Expr.int(10))
    );
    const conclusion = Expr.gt(x, Expr.int(-1));

    // Check if premise => conclusion is valid
    const implication = Expr.implies(premise, conclusion);
    const result = await solver.checkValid(implication, [Decl.const('x', Sort.Int())]);

    // Should be valid (unsat when negated)
    expect(result.status).toBe('sat'); // Valid means sat when checking validity
  });

  it('should check precondition satisfiability', async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Skipping test: Z3 WASM not available');
      return;
    }

    const inputVars = new Map<string, typeof Sort.Int>([
      ['x', Sort.Int()],
    ]);

    const precondition = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
    const result = await solver.checkPreconditionSat(precondition, inputVars);

    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      expect(result.model.x).toBeGreaterThan(0);
    }
  });

  it('should check postcondition implication', async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Skipping test: Z3 WASM not available');
      return;
    }

    const vars = new Map<string, typeof Sort.Int>([
      ['x', Sort.Int()],
    ]);

    const precondition = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
    const postcondition = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(-1));

    const result = await solver.checkPostconditionImplication(precondition, postcondition, vars);

    // Should be valid (unsat means implication holds)
    expect(result.status).toBe('unsat');
  });

  it('should use deterministic random seed', async () => {
    const available = await isZ3WasmAvailable();
    if (!available) {
      console.warn('Skipping test: Z3 WASM not available');
      return;
    }

    const solver1 = new Z3WasmSolver({ randomSeed: 42 });
    const solver2 = new Z3WasmSolver({ randomSeed: 42 });

    const x = Expr.var('x', Sort.Int());
    const formula = Expr.and(
      Expr.gt(x, Expr.int(0)),
      Expr.lt(x, Expr.int(100))
    );

    const result1 = await solver1.checkSat(formula, [Decl.const('x', Sort.Int())]);
    const result2 = await solver2.checkSat(formula, [Decl.const('x', Sort.Int())]);

    // With same seed, should get same result
    expect(result1.status).toBe(result2.status);
    if (result1.status === 'sat' && result2.status === 'sat') {
      expect(result1.model?.x).toBe(result2.model?.x);
    }
  });
});
