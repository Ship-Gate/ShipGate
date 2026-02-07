/**
 * External Solver Adapter — Comprehensive Tests
 *
 * Coverage:
 * - Cross-platform solver detection (Windows / macOS / Linux)
 * - Correct SMT-LIB output parsing (balanced parens, both solver formats)
 * - Retry on crash + solver fallback
 * - CVC5 parity with Z3
 * - Solver availability matrix
 * - Verified sat / unsat behavior
 * - Determinism
 * - Edge cases: empty queries, huge output, invalid SMT-LIB
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkSolverAvailability,
  checkSatExternal,
  clearSolverCache,
  getBestAvailableSolver,
  checkAllSolvers,
  getSolverAvailabilityMatrix,
  _testInternals,
  type ExternalSolver,
  type SolverAvailability,
} from '../src/external-solver.js';

const {
  findMatchingParen,
  stripComments,
  extractResultKeyword,
  extractModelBlock,
  parseDefineFun,
  parseValue,
  parseModel,
  parseSolverOutput,
  buildSolverArgs,
} = _testInternals;

// ============================================================================
// Helpers
// ============================================================================

/** Return availability for first found solver, or null if none. */
async function getAnySolver(): Promise<{ solver: ExternalSolver; avail: SolverAvailability } | null> {
  for (const s of ['z3', 'cvc5'] as ExternalSolver[]) {
    const a = await checkSolverAvailability(s);
    if (a.available) return { solver: s, avail: a };
  }
  return null;
}

// ============================================================================
// 1. SMT-LIB Output Parsing (pure, no solver required)
// ============================================================================

describe('SMT-LIB Output Parsing', () => {
  // ---- Balanced parenthesis matching ----
  describe('findMatchingParen', () => {
    it('handles simple parens', () => {
      expect(findMatchingParen('(abc)', 0)).toBe(4);
    });

    it('handles nested parens', () => {
      expect(findMatchingParen('(a (b c) d)', 0)).toBe(10);
    });

    it('handles string literals with parens inside', () => {
      expect(findMatchingParen('(a "has (parens)" b)', 0)).toBe(19);
    });

    it('returns -1 for unbalanced input', () => {
      expect(findMatchingParen('(a (b c)', 0)).toBe(-1);
    });

    it('handles deeply nested structures', () => {
      const input = '(a (b (c (d (e)))))';
      expect(findMatchingParen(input, 0)).toBe(input.length - 1);
    });

    it('handles empty parens', () => {
      expect(findMatchingParen('()', 0)).toBe(1);
    });
  });

  // ---- Comment stripping ----
  describe('stripComments', () => {
    it('strips lines starting with ;', () => {
      const input = '; comment\nsat\n; another\n(model)';
      expect(stripComments(input)).toBe('\nsat\n\n(model)');
    });

    it('strips lines with leading whitespace before ;', () => {
      const input = '  ; indented comment\nsat';
      expect(stripComments(input)).toBe('\nsat');
    });

    it('preserves non-comment lines', () => {
      const input = 'sat\n(model (define-fun x () Int 42))';
      expect(stripComments(input)).toBe(input);
    });
  });

  // ---- Result keyword extraction ----
  describe('extractResultKeyword', () => {
    it('extracts sat', () => {
      expect(extractResultKeyword('sat\n(model ...)')).toBe('sat');
    });

    it('extracts unsat', () => {
      expect(extractResultKeyword('unsat\n')).toBe('unsat');
    });

    it('extracts unknown', () => {
      expect(extractResultKeyword('unknown\n(:reason-unknown "timeout")')).toBe('unknown');
    });

    it('skips comments before keyword', () => {
      expect(extractResultKeyword('; Z3 version 4.12\nsat\n')).toBe('sat');
    });

    it('handles leading whitespace', () => {
      expect(extractResultKeyword('  sat  ')).toBe('sat');
    });

    it('returns null for empty output', () => {
      expect(extractResultKeyword('')).toBeNull();
    });

    it('returns null for garbage output', () => {
      expect(extractResultKeyword('random garbage output')).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(extractResultKeyword('SAT\n')).toBe('sat');
      expect(extractResultKeyword('UNSAT\n')).toBe('unsat');
    });
  });

  // ---- Model block extraction ----
  describe('extractModelBlock', () => {
    it('extracts Z3-style (model ...) block', () => {
      const output = 'sat\n(model\n  (define-fun x () Int 42)\n)\n';
      const block = extractModelBlock(output);
      expect(block).toContain('define-fun');
      expect(block).toContain('42');
    });

    it('extracts CVC5-style bare define-fun blocks', () => {
      const output = 'sat\n(define-fun x () Int 42)\n(define-fun y () Bool true)\n';
      const block = extractModelBlock(output);
      expect(block).toContain('define-fun x');
      expect(block).toContain('define-fun y');
    });

    it('returns null when no model present', () => {
      expect(extractModelBlock('unsat\n')).toBeNull();
    });
  });

  // ---- define-fun parsing ----
  describe('parseDefineFun', () => {
    it('parses simple integer define-fun', () => {
      const result = parseDefineFun('(define-fun x () Int 42)');
      expect(result).toEqual({ name: 'x', sort: 'Int', value: '42' });
    });

    it('parses boolean define-fun', () => {
      const result = parseDefineFun('(define-fun b () Bool true)');
      expect(result).toEqual({ name: 'b', sort: 'Bool', value: 'true' });
    });

    it('parses negative integer (Z3 format)', () => {
      const result = parseDefineFun('(define-fun n () Int (- 5))');
      expect(result).toEqual({ name: 'n', sort: 'Int', value: '(- 5)' });
    });

    it('parses rational value (Z3 format)', () => {
      const result = parseDefineFun('(define-fun r () Real (/ 1 3))');
      expect(result).toEqual({ name: 'r', sort: 'Real', value: '(/ 1 3)' });
    });

    it('parses compound sort like (Array Int Int)', () => {
      const result = parseDefineFun('(define-fun a () (Array Int Int) ((as const (Array Int Int)) 0))');
      expect(result?.name).toBe('a');
      expect(result?.sort).toBe('(Array Int Int)');
    });
  });

  // ---- Value parsing ----
  describe('parseValue', () => {
    it('parses true', () => expect(parseValue('true', 'Bool')).toBe(true));
    it('parses false', () => expect(parseValue('false', 'Bool')).toBe(false));
    it('parses positive int', () => expect(parseValue('42', 'Int')).toBe(42));
    it('parses negative int', () => expect(parseValue('-7', 'Int')).toBe(-7));
    it('parses Z3 negative format (- 5)', () => expect(parseValue('(- 5)', 'Int')).toBe(-5));
    it('parses real', () => expect(parseValue('3.14', 'Real')).toBeCloseTo(3.14));
    it('parses rational (/ 1 2)', () => expect(parseValue('(/ 1 2)', 'Real')).toBe(0.5));
    it('parses negative rational (/ (- 1) 2)', () => expect(parseValue('(/ (- 1) 2)', 'Real')).toBe(-0.5));
    it('parses bitvector #b1010', () => expect(parseValue('#b1010', 'BitVec')).toBe(10));
    it('parses bitvector #x1f', () => expect(parseValue('#x1f', 'BitVec')).toBe(31));
    it('parses quoted string', () => expect(parseValue('"hello"', 'String')).toBe('hello'));
    it('parses string with escaped quotes', () => expect(parseValue('"say \\"hi\\""', 'String')).toBe('say "hi"'));
    it('returns raw value for unknown sort', () => expect(parseValue('custom_val', 'MySort')).toBe('custom_val'));
  });

  // ---- Full model parsing ----
  describe('parseModel', () => {
    it('parses Z3-style model', () => {
      const output = `sat
(model
  (define-fun x () Int 42)
  (define-fun b () Bool true)
)`;
      const model = parseModel(output);
      expect(model).toEqual({ x: 42, b: true });
    });

    it('parses CVC5-style model (bare define-funs)', () => {
      const output = `sat
(define-fun x () Int 7)
(define-fun y () Int (- 3))`;
      const model = parseModel(output);
      expect(model).toEqual({ x: 7, y: -3 });
    });

    it('parses model with multiple types', () => {
      const output = `sat
(model
  (define-fun i () Int 10)
  (define-fun r () Real (/ 1 3))
  (define-fun b () Bool false)
  (define-fun s () String "hello")
)`;
      const model = parseModel(output);
      expect(model?.i).toBe(10);
      expect(model?.r).toBeCloseTo(0.333, 2);
      expect(model?.b).toBe(false);
      expect(model?.s).toBe('hello');
    });

    it('returns undefined when no model', () => {
      expect(parseModel('unsat\n')).toBeUndefined();
    });
  });

  // ---- Full output parsing ----
  describe('parseSolverOutput', () => {
    it('parses sat with model', () => {
      const stdout = 'sat\n(model\n  (define-fun x () Int 42)\n)\n';
      const result = parseSolverOutput(stdout, '', 0);
      expect(result.status).toBe('sat');
      if (result.status === 'sat') {
        expect(result.model?.x).toBe(42);
      }
    });

    it('parses unsat', () => {
      const result = parseSolverOutput('unsat\n', '', 0);
      expect(result.status).toBe('unsat');
    });

    it('parses unknown with reason', () => {
      const stdout = 'unknown\n(:reason-unknown "timeout")';
      const result = parseSolverOutput(stdout, '', 0);
      expect(result.status).toBe('unknown');
      if (result.status === 'unknown') {
        expect(result.reason).toContain('timeout');
      }
    });

    it('parses timeout indicators', () => {
      const result = parseSolverOutput('timeout\n', '', 0);
      expect(result.status).toBe('timeout');
    });

    it('parses CVC5 structured error', () => {
      const stdout = '(error "Unknown logic: INVALID_LOGIC")';
      const result = parseSolverOutput(stdout, '', 1);
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.message).toContain('INVALID_LOGIC');
      }
    });

    it('handles empty output as error', () => {
      const result = parseSolverOutput('', '', 0);
      expect(result.status).toBe('error');
    });

    it('handles non-zero exit without output', () => {
      const result = parseSolverOutput('', 'segfault', 139);
      expect(result.status).toBe('error');
    });

    it('parses sat even with leading comments', () => {
      const stdout = '; Z3 4.12.6\nsat\n(model\n  (define-fun x () Int 1)\n)\n';
      const result = parseSolverOutput(stdout, '', 0);
      expect(result.status).toBe('sat');
    });

    it('parses out-of-memory as unknown', () => {
      const result = parseSolverOutput('out of memory', '', 1);
      expect(result.status).toBe('unknown');
      if (result.status === 'unknown') {
        expect(result.reason).toContain('memory');
      }
    });

    it('parses unsupported as error', () => {
      const result = parseSolverOutput('unsupported\n', '', 0);
      expect(result.status).toBe('error');
    });
  });
});

// ============================================================================
// 2. Solver Argument Building (pure, no solver required)
// ============================================================================

describe('Solver Argument Building', () => {
  it('builds Z3 args with timeout and memory', () => {
    const args = buildSolverArgs('z3', '/tmp/q.smt2', 5000, 512, true);
    expect(args).toContain('-smt2');
    expect(args).toContain('-T:5');
    expect(args).toContain('-memory:512');
    expect(args).toContain('model=true');
    expect(args).toContain('/tmp/q.smt2');
  });

  it('builds CVC5 args with tlimit-per and finite-model-find', () => {
    const args = buildSolverArgs('cvc5', '/tmp/q.smt2', 3000, 256, true);
    expect(args).toContain('--lang=smt2');
    expect(args).toContain('--tlimit-per=3000');
    expect(args).toContain('--produce-models');
    expect(args).toContain('--finite-model-find');
    expect(args).toContain('--strings-exp');
    expect(args).toContain('/tmp/q.smt2');
  });

  it('builds CVC5 args without models', () => {
    const args = buildSolverArgs('cvc5', '/tmp/q.smt2', 1000, 128, false);
    expect(args).toContain('--no-produce-models');
    expect(args).not.toContain('--produce-models');
  });

  it('rounds timeout up to next second for Z3', () => {
    const args = buildSolverArgs('z3', '/tmp/q.smt2', 1500, 512, false);
    expect(args).toContain('-T:2');
  });
});

// ============================================================================
// 3. Solver Detection (cross-platform, live system)
// ============================================================================

describe('Solver Availability Detection', () => {
  beforeEach(() => {
    clearSolverCache();
  });

  it('should detect Z3 availability', async () => {
    const availability = await checkSolverAvailability('z3');

    expect(availability).toBeDefined();
    expect(typeof availability.available).toBe('boolean');
    expect(availability.platform).toBe(process.platform);

    if (availability.available) {
      expect(availability.path).toBeDefined();
      expect(typeof availability.path).toBe('string');
    } else {
      expect(availability.error).toBeDefined();
    }
  });

  it('should detect CVC5 availability', async () => {
    const availability = await checkSolverAvailability('cvc5');

    expect(availability).toBeDefined();
    expect(typeof availability.available).toBe('boolean');
    expect(availability.platform).toBe(process.platform);

    if (availability.available) {
      expect(availability.path).toBeDefined();
    }
  });

  it('should cache availability results', async () => {
    const result1 = await checkSolverAvailability('z3');
    const result2 = await checkSolverAvailability('z3');

    expect(result1.available).toBe(result2.available);
    expect(result1.path).toBe(result2.path);
    expect(result1.version).toBe(result2.version);
  });

  it('should not use cache for different custom paths', async () => {
    const result1 = await checkSolverAvailability('z3');
    const result2 = await checkSolverAvailability('z3', '/nonexistent/z3');

    // result2 should be unavailable regardless of result1
    expect(result2.available).toBe(false);
  });

  it('should check all solvers in parallel', async () => {
    const allSolvers = await checkAllSolvers();

    expect(allSolvers).toBeDefined();
    expect(allSolvers.z3).toBeDefined();
    expect(allSolvers.cvc5).toBeDefined();
    expect(typeof allSolvers.z3.available).toBe('boolean');
    expect(typeof allSolvers.cvc5.available).toBe('boolean');
  });

  it('should get best available solver', async () => {
    const best = await getBestAvailableSolver();
    expect([null, 'z3', 'cvc5']).toContain(best);
  });

  it('should handle non-existent custom path gracefully', async () => {
    const result = await checkSolverAvailability('z3', '/absolutely/nonexistent/path/z3');
    expect(result.available).toBe(false);
  });
});

// ============================================================================
// 4. Solver Availability Matrix
// ============================================================================

describe('Solver Availability Matrix', () => {
  beforeEach(() => {
    clearSolverCache();
  });

  it('should produce a complete availability matrix', async () => {
    const matrix = await getSolverAvailabilityMatrix();

    expect(matrix.platform).toBe(process.platform);
    expect(matrix.arch).toBe(process.arch);
    expect(matrix.solvers.z3).toBeDefined();
    expect(matrix.solvers.cvc5).toBeDefined();
    expect(typeof matrix.timestamp).toBe('string');

    // bestAvailable should be consistent with individual solver results
    if (matrix.solvers.z3.available) {
      expect(matrix.bestAvailable).toBe('z3');
    } else if (matrix.solvers.cvc5.available) {
      expect(matrix.bestAvailable).toBe('cvc5');
    } else {
      expect(matrix.bestAvailable).toBeNull();
    }
  });

  it('matrix timestamp should be ISO 8601', async () => {
    const matrix = await getSolverAvailabilityMatrix();
    expect(() => new Date(matrix.timestamp)).not.toThrow();
    expect(new Date(matrix.timestamp).toISOString()).toBe(matrix.timestamp);
  });
});

// ============================================================================
// 5. Verified SAT / UNSAT Behavior (requires at least one solver)
// ============================================================================

describe('Verified SAT Behavior', () => {
  let solver: ExternalSolver;
  let solverAvailable: boolean;

  beforeEach(async () => {
    clearSolverCache();
    const found = await getAnySolver();
    solverAvailable = found !== null;
    solver = found?.solver ?? 'z3';
  });

  it('simple integer satisfiability: x > 0 AND x < 10 → SAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const x Int)
(assert (and (> x 0) (< x 10)))
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000, produceModels: true });

    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      const x = result.model.x;
      if (typeof x === 'number') {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(10);
      }
    }
  }, 15000);

  it('exact value: x = 42 → SAT with x = 42', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const x Int)
(assert (= x 42))
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000, produceModels: true });

    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      expect(result.model.x).toBe(42);
    }
  }, 15000);

  it('boolean satisfiability: a OR b → SAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const a Bool)
(declare-const b Bool)
(assert (or a b))
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000, produceModels: true });
    expect(result.status).toBe('sat');
  }, 15000);

  it('negative integer: x = -7 → SAT with x = -7', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const x Int)
(assert (= x (- 7)))
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000, produceModels: true });
    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      expect(result.model.x).toBe(-7);
    }
  }, 15000);

  it('multi-variable: x + y = 10, x > 3, y > 3 → SAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const x Int)
(declare-const y Int)
(assert (= (+ x y) 10))
(assert (> x 3))
(assert (> y 3))
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000, produceModels: true });
    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      const x = result.model.x;
      const y = result.model.y;
      if (typeof x === 'number' && typeof y === 'number') {
        expect(x + y).toBe(10);
        expect(x).toBeGreaterThan(3);
        expect(y).toBeGreaterThan(3);
      }
    }
  }, 15000);
});

describe('Verified UNSAT Behavior', () => {
  let solver: ExternalSolver;
  let solverAvailable: boolean;

  beforeEach(async () => {
    clearSolverCache();
    const found = await getAnySolver();
    solverAvailable = found !== null;
    solver = found?.solver ?? 'z3';
  });

  it('contradiction: x > 10 AND x < 5 → UNSAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(declare-const x Int)
(assert (and (> x 10) (< x 5)))
(check-sat)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000 });
    expect(result.status).toBe('unsat');
  }, 15000);

  it('boolean contradiction: a AND NOT a → UNSAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(declare-const a Bool)
(assert (and a (not a)))
(check-sat)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000 });
    expect(result.status).toBe('unsat');
  }, 15000);

  it('impossible equality: x = 1 AND x = 2 → UNSAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(declare-const x Int)
(assert (= x 1))
(assert (= x 2))
(check-sat)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000 });
    expect(result.status).toBe('unsat');
  }, 15000);

  it('tautology negation: NOT (a OR NOT a) → UNSAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(declare-const a Bool)
(assert (not (or a (not a))))
(check-sat)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000 });
    expect(result.status).toBe('unsat');
  }, 15000);

  it('ordering impossibility: x < y AND y < z AND z < x → UNSAT', async () => {
    if (!solverAvailable) return;

    const query = `
(set-logic ALL)
(declare-const x Int)
(declare-const y Int)
(declare-const z Int)
(assert (< x y))
(assert (< y z))
(assert (< z x))
(check-sat)
`;
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000 });
    expect(result.status).toBe('unsat');
  }, 15000);
});

// ============================================================================
// 6. Timeout Enforcement (requires at least one solver)
// ============================================================================

describe('Timeout Enforcement', () => {
  let solver: ExternalSolver;
  let solverAvailable: boolean;

  beforeEach(async () => {
    clearSolverCache();
    const found = await getAnySolver();
    solverAvailable = found !== null;
    solver = found?.solver ?? 'z3';
  });

  it('should not hang: simple query with short timeout completes quickly', async () => {
    const start = Date.now();

    await checkSatExternal('(set-logic ALL)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)', {
      solver,
      timeoutMs: 200,
    });

    const elapsed = Date.now() - start;
    // Must complete within 3 seconds even if solver is missing
    expect(elapsed).toBeLessThan(3000);
  }, 5000);

  it('should kill process on timeout for hard queries', async () => {
    if (!solverAvailable) return;

    // Deliberately hard combinatorial query
    const n = 30;
    const vars = Array.from({ length: n }, (_, i) => `(declare-const x${i} Int)`).join('\n');
    const bounds = Array.from({ length: n }, (_, i) => `(assert (and (>= x${i} 0) (<= x${i} 100)))`).join('\n');
    const sum = `(assert (= (+ ${Array.from({ length: n }, (_, i) => `x${i}`).join(' ')}) 1500))`;

    const query = `(set-logic ALL)\n${vars}\n${bounds}\n${sum}\n(check-sat)`;

    const start = Date.now();
    await checkSatExternal(query, { solver, timeoutMs: 100 });
    const elapsed = Date.now() - start;

    // CRITICAL: must not hang
    expect(elapsed).toBeLessThan(5000);
  }, 10000);

  it('should include timing stats', async () => {
    if (!solverAvailable) return;

    const query = '(set-logic ALL)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)';
    const result = await checkSatExternal(query, { solver, timeoutMs: 5000 });

    expect(result.stats).toBeDefined();
    expect(result.stats?.solverTimeMs).toBeGreaterThanOrEqual(0);
  }, 10000);
});

// ============================================================================
// 7. Retry and Fallback
// ============================================================================

describe('Retry and Fallback', () => {
  beforeEach(() => {
    clearSolverCache();
  });

  it('should handle missing solver gracefully (no crash)', async () => {
    const result = await checkSatExternal('(check-sat)', {
      solver: 'z3',
      timeoutMs: 1000,
      solverPath: '/nonexistent/path/to/z3',
      maxRetries: 0,
      fallbackOnFailure: false,
    });

    // Should return error, not throw
    expect(['error', 'unknown']).toContain(result.status);
  });

  it('should return error for invalid query', async () => {
    const found = await getAnySolver();
    if (!found) return;

    const result = await checkSatExternal('(set-logic INVALID_LOGIC)\n(assert bad syntax)', {
      solver: found.solver,
      timeoutMs: 5000,
      maxRetries: 0,
    });

    expect(['error', 'unknown']).toContain(result.status);
  }, 10000);

  it('should return error for empty query', async () => {
    const found = await getAnySolver();
    if (!found) return;

    const result = await checkSatExternal('', {
      solver: found.solver,
      timeoutMs: 1000,
    });

    expect(['error', 'unknown']).toContain(result.status);
  }, 10000);

  it('stats should include actualSolver when fallback triggers', async () => {
    // This tests that when primary fails, stats.actualSolver reflects
    // the solver that actually ran. We force z3 with bad path.
    const result = await checkSatExternal(
      '(set-logic ALL)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)',
      {
        solver: 'z3',
        timeoutMs: 5000,
        solverPath: '/nonexistent/z3',
        fallbackOnFailure: true,
        maxRetries: 0,
      },
    );

    // If cvc5 is available, it should have been used as fallback
    const cvc5 = await checkSolverAvailability('cvc5');
    if (cvc5.available && result.status === 'sat') {
      expect(result.stats?.actualSolver).toBe('cvc5');
    }
  }, 15000);
});

// ============================================================================
// 8. CVC5 Parity Tests (requires CVC5)
// ============================================================================

describe('CVC5 Parity', () => {
  let cvc5Available: boolean;

  beforeEach(async () => {
    clearSolverCache();
    const avail = await checkSolverAvailability('cvc5');
    cvc5Available = avail.available;
  });

  it('CVC5: simple SAT', async () => {
    if (!cvc5Available) return;

    const query = `
(set-logic ALL)
(declare-const x Int)
(assert (and (> x 0) (< x 10)))
(check-sat)
`;
    const result = await checkSatExternal(query, { solver: 'cvc5', timeoutMs: 5000 });
    expect(result.status).toBe('sat');
  }, 15000);

  it('CVC5: simple UNSAT', async () => {
    if (!cvc5Available) return;

    const query = `
(set-logic ALL)
(declare-const x Int)
(assert (and (> x 10) (< x 5)))
(check-sat)
`;
    const result = await checkSatExternal(query, { solver: 'cvc5', timeoutMs: 5000 });
    expect(result.status).toBe('unsat');
  }, 15000);

  it('CVC5: model extraction', async () => {
    if (!cvc5Available) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const x Int)
(assert (= x 42))
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, { solver: 'cvc5', timeoutMs: 5000, produceModels: true });
    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      expect(result.model.x).toBe(42);
    }
  }, 15000);

  it('CVC5: boolean model', async () => {
    if (!cvc5Available) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const b Bool)
(assert b)
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, { solver: 'cvc5', timeoutMs: 5000, produceModels: true });
    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      expect(result.model.b).toBe(true);
    }
  }, 15000);
});

// ============================================================================
// 9. Cross-Solver Parity (requires both Z3 and CVC5)
// ============================================================================

describe('Cross-Solver Parity', () => {
  let z3Available: boolean;
  let cvc5Available: boolean;

  beforeEach(async () => {
    clearSolverCache();
    const [z3, cvc5] = await Promise.all([
      checkSolverAvailability('z3'),
      checkSolverAvailability('cvc5'),
    ]);
    z3Available = z3.available;
    cvc5Available = cvc5.available;
  });

  const parityQueries: Array<{ name: string; query: string; expected: 'sat' | 'unsat' }> = [
    {
      name: 'simple SAT',
      query: '(set-logic ALL)\n(declare-const x Int)\n(assert (> x 0))\n(check-sat)',
      expected: 'sat',
    },
    {
      name: 'simple UNSAT',
      query: '(set-logic ALL)\n(declare-const x Int)\n(assert (and (> x 10) (< x 5)))\n(check-sat)',
      expected: 'unsat',
    },
    {
      name: 'boolean UNSAT (a AND NOT a)',
      query: '(set-logic ALL)\n(declare-const a Bool)\n(assert (and a (not a)))\n(check-sat)',
      expected: 'unsat',
    },
    {
      name: 'multi-variable SAT',
      query: '(set-logic ALL)\n(declare-const x Int)\n(declare-const y Int)\n(assert (= (+ x y) 10))\n(assert (> x 0))\n(assert (> y 0))\n(check-sat)',
      expected: 'sat',
    },
  ];

  for (const { name, query, expected } of parityQueries) {
    it(`Z3 and CVC5 agree on: ${name} → ${expected}`, async () => {
      if (!z3Available || !cvc5Available) return;

      const [z3Result, cvc5Result] = await Promise.all([
        checkSatExternal(query, { solver: 'z3', timeoutMs: 5000 }),
        checkSatExternal(query, { solver: 'cvc5', timeoutMs: 5000 }),
      ]);

      expect(z3Result.status).toBe(expected);
      expect(cvc5Result.status).toBe(expected);
    }, 15000);
  }
});

// ============================================================================
// 10. Determinism
// ============================================================================

describe('Determinism', () => {
  it('should produce same result for same query (3 runs)', async () => {
    const found = await getAnySolver();
    if (!found) return;

    const query = `
(set-logic ALL)
(declare-const x Int)
(assert (and (> x 5) (< x 10)))
(check-sat)
`;
    const results = await Promise.all([
      checkSatExternal(query, { solver: found.solver, timeoutMs: 5000 }),
      checkSatExternal(query, { solver: found.solver, timeoutMs: 5000 }),
      checkSatExternal(query, { solver: found.solver, timeoutMs: 5000 }),
    ]);

    expect(results[0]?.status).toBe(results[1]?.status);
    expect(results[1]?.status).toBe(results[2]?.status);
  }, 20000);
});

// ============================================================================
// 11. Output Size Limits
// ============================================================================

describe('Output Size Limits', () => {
  it('should handle large model output', async () => {
    const found = await getAnySolver();
    if (!found) return;

    const varCount = 50;
    const query = `
(set-logic ALL)
(set-option :produce-models true)
${Array.from({ length: varCount }, (_, i) => `(declare-const x${i} Int)`).join('\n')}
${Array.from({ length: varCount }, (_, i) => `(assert (= x${i} ${i}))`).join('\n')}
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, {
      solver: found.solver,
      timeoutMs: 10000,
      maxOutputBytes: 1024 * 1024,
    });

    expect(result.status).toBe('sat');
  }, 20000);

  it('should not crash with very small output limit', async () => {
    const found = await getAnySolver();
    if (!found) return;

    const query = `
(set-logic ALL)
(set-option :produce-models true)
(declare-const x Int)
(assert (> x 0))
(check-sat)
(get-model)
`;
    const result = await checkSatExternal(query, {
      solver: found.solver,
      timeoutMs: 5000,
      maxOutputBytes: 10, // Extremely small
    });

    // Should not crash — result may be partial
    expect(['sat', 'unknown', 'error']).toContain(result.status);
  }, 10000);
});
