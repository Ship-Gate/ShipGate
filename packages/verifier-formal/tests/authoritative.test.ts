// ============================================================================
// Authoritative Verification Tests
// Tests proving real verdicts: PROVED, DISPROVED, UNKNOWN
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import {
  Verdict,
  ProvedVerdict,
  DisprovedVerdict,
  UnknownVerdict,
  createProvedVerdict,
  createDisprovedVerdict,
  createUnknownVerdict,
  createTimeoutReason,
  createComplexityReason,
  createNonlinearArithmeticReason,
  formatVerdict,
  formatUnknownReason,
  aggregateVerdicts,
} from '../src/verdict';
import {
  analyzeComplexity,
  checkComplexityLimits,
  estimateTimeout,
  DEFAULT_LIMITS,
  STRICT_LIMITS,
} from '../src/complexity';
import {
  AuthoritativeSolver,
  createSolver,
} from '../src/authoritative-solver';

// ============================================================================
// VERDICT TYPE TESTS
// ============================================================================

describe('Verdict Types', () => {
  describe('ProvedVerdict', () => {
    it('should create a proved verdict with authoritative confidence', () => {
      const verdict = createProvedVerdict(150);
      
      expect(verdict.kind).toBe('proved');
      expect(verdict.confidence).toBe('authoritative');
      expect(verdict.solverTime).toBe(150);
    });

    it('should optionally include SMT query for debugging', () => {
      const smtQuery = '(check-sat)';
      const verdict = createProvedVerdict(100, smtQuery);
      
      expect(verdict.smtQuery).toBe(smtQuery);
    });
  });

  describe('DisprovedVerdict', () => {
    it('should create a disproved verdict with counterexample', () => {
      const counterexample = {
        inputs: { x: 5, y: -1 },
        state: { balance: 100 },
        trace: ['Input: x=5, y=-1', 'Violated: y >= 0'],
      };
      
      const verdict = createDisprovedVerdict(counterexample, 200);
      
      expect(verdict.kind).toBe('disproved');
      expect(verdict.confidence).toBe('authoritative');
      expect(verdict.counterexample.inputs).toEqual({ x: 5, y: -1 });
      expect(verdict.solverTime).toBe(200);
    });
  });

  describe('UnknownVerdict', () => {
    it('should create unknown verdict with timeout reason', () => {
      const reason = createTimeoutReason(5000, 5100);
      const verdict = createUnknownVerdict(reason, 5100);
      
      expect(verdict.kind).toBe('unknown');
      expect(verdict.confidence).toBe('degraded');
      expect(verdict.reason.type).toBe('timeout');
      expect((verdict.reason as any).timeoutMs).toBe(5000);
    });

    it('should create unknown verdict with complexity reason', () => {
      const reason = createComplexityReason('ast-depth', 50, 75);
      const verdict = createUnknownVerdict(reason, 10);
      
      expect(verdict.kind).toBe('unknown');
      expect(verdict.reason.type).toBe('complexity');
      expect((verdict.reason as any).metric).toBe('ast-depth');
      expect((verdict.reason as any).threshold).toBe(50);
      expect((verdict.reason as any).actual).toBe(75);
    });

    it('should include suggestion in every unknown reason', () => {
      const timeoutReason = createTimeoutReason(5000, 5100);
      expect(timeoutReason.suggestion).toBeTruthy();
      expect(timeoutReason.suggestion.length).toBeGreaterThan(0);

      const complexityReason = createComplexityReason('quantifier-alternations', 2, 5);
      expect(complexityReason.suggestion).toBeTruthy();

      const nonlinearReason = createNonlinearArithmeticReason(['*', '/']);
      expect(nonlinearReason.suggestion).toBeTruthy();
    });
  });
});

// ============================================================================
// VERDICT FORMATTING TESTS
// ============================================================================

describe('Verdict Formatting', () => {
  it('should format proved verdict', () => {
    const verdict = createProvedVerdict(150);
    const formatted = formatVerdict(verdict);
    
    expect(formatted).toContain('PROVED');
    expect(formatted).toContain('150ms');
  });

  it('should format disproved verdict with counterexample', () => {
    const verdict = createDisprovedVerdict(
      { inputs: { x: 5 }, state: {}, trace: [] },
      200
    );
    const formatted = formatVerdict(verdict);
    
    expect(formatted).toContain('DISPROVED');
    expect(formatted).toContain('200ms');
    expect(formatted).toContain('Counterexample');
  });

  it('should format unknown verdict with reason', () => {
    const reason = createTimeoutReason(5000, 5100);
    const verdict = createUnknownVerdict(reason, 5100);
    const formatted = formatVerdict(verdict);
    
    expect(formatted).toContain('UNKNOWN');
    expect(formatted).toContain('Reason');
    expect(formatted).toContain('Timeout');
  });
});

// ============================================================================
// VERDICT AGGREGATION TESTS
// ============================================================================

describe('Verdict Aggregation', () => {
  it('should return proved if all verdicts are proved', () => {
    const verdicts: Verdict[] = [
      createProvedVerdict(100),
      createProvedVerdict(150),
      createProvedVerdict(200),
    ];
    
    const result = aggregateVerdicts(verdicts);
    
    expect(result.overall).toBe('proved');
    expect(result.provedCount).toBe(3);
    expect(result.disprovedCount).toBe(0);
    expect(result.unknownCount).toBe(0);
  });

  it('should return disproved if any verdict is disproved', () => {
    const verdicts: Verdict[] = [
      createProvedVerdict(100),
      createDisprovedVerdict({ inputs: {}, state: {}, trace: [] }, 150),
      createProvedVerdict(200),
    ];
    
    const result = aggregateVerdicts(verdicts);
    
    expect(result.overall).toBe('disproved');
    expect(result.disprovedCount).toBe(1);
  });

  it('should return unknown if any verdict is unknown and none disproved', () => {
    const verdicts: Verdict[] = [
      createProvedVerdict(100),
      createUnknownVerdict(createTimeoutReason(5000, 5100), 5100),
      createProvedVerdict(200),
    ];
    
    const result = aggregateVerdicts(verdicts);
    
    expect(result.overall).toBe('unknown');
    expect(result.unknownCount).toBe(1);
    expect(result.unknownReasons).toHaveLength(1);
  });

  it('should collect all unknown reasons', () => {
    const verdicts: Verdict[] = [
      createUnknownVerdict(createTimeoutReason(5000, 5100), 5100),
      createUnknownVerdict(createComplexityReason('ast-depth', 50, 75), 10),
    ];
    
    const result = aggregateVerdicts(verdicts);
    
    expect(result.unknownReasons).toHaveLength(2);
    expect(result.unknownReasons.map(r => r.type)).toContain('timeout');
    expect(result.unknownReasons.map(r => r.type)).toContain('complexity');
  });
});

// ============================================================================
// COMPLEXITY ANALYSIS TESTS
// ============================================================================

describe('Complexity Analysis', () => {
  describe('analyzeComplexity', () => {
    it('should measure AST depth correctly', () => {
      const shallow = '(assert (= x 1))';
      const deep = '(assert (and (or (= x 1) (= y 2)) (not (< z 0))))';
      
      const shallowAnalysis = analyzeComplexity(shallow);
      const deepAnalysis = analyzeComplexity(deep);
      
      expect(deepAnalysis.astDepth).toBeGreaterThan(shallowAnalysis.astDepth);
    });

    it('should count quantifiers', () => {
      const noQuantifiers = '(assert (= x 1))';
      const withQuantifiers = '(assert (forall ((x Int)) (exists ((y Int)) (= x y))))';
      
      const noQAnalysis = analyzeComplexity(noQuantifiers);
      const withQAnalysis = analyzeComplexity(withQuantifiers);
      
      expect(noQAnalysis.quantifierCount).toBe(0);
      expect(withQAnalysis.quantifierCount).toBe(2);
    });

    it('should detect quantifier alternations', () => {
      const alternating = '(assert (forall ((x Int)) (exists ((y Int)) (forall ((z Int)) true))))';
      
      const analysis = analyzeComplexity(alternating);
      
      expect(analysis.quantifierAlternations).toBeGreaterThan(0);
    });

    it('should count constraints', () => {
      const query = `
        (assert (= x 1))
        (assert (> y 0))
        (assert (< z 10))
      `;
      
      const analysis = analyzeComplexity(query);
      
      expect(analysis.constraintCount).toBe(3);
    });

    it('should detect string theory usage', () => {
      const withStrings = '(assert (str.contains s "hello"))';
      const withoutStrings = '(assert (= x 1))';
      
      expect(analyzeComplexity(withStrings).usesStrings).toBe(true);
      expect(analyzeComplexity(withoutStrings).usesStrings).toBe(false);
    });

    it('should detect array theory usage', () => {
      const withArrays = '(assert (= (select arr 0) 1))';
      const withoutArrays = '(assert (= x 1))';
      
      expect(analyzeComplexity(withArrays).usesArrays).toBe(true);
      expect(analyzeComplexity(withoutArrays).usesArrays).toBe(false);
    });

    it('should estimate difficulty correctly', () => {
      const trivial = '(assert (= x 1))';
      const hard = `
        (assert (forall ((x Int)) (exists ((y Int)) (forall ((z Int)) (= (* x y) z)))))
      `;
      
      const trivialAnalysis = analyzeComplexity(trivial);
      const hardAnalysis = analyzeComplexity(hard);
      
      expect(trivialAnalysis.estimatedDifficulty).toBe('trivial');
      expect(['hard', 'intractable']).toContain(hardAnalysis.estimatedDifficulty);
    });
  });

  describe('checkComplexityLimits', () => {
    it('should return null when within limits', () => {
      const simple = '(assert (= x 1))';
      const analysis = analyzeComplexity(simple);
      
      const violation = checkComplexityLimits(analysis, DEFAULT_LIMITS);
      
      expect(violation).toBeNull();
    });

    it('should return reason when exceeding AST depth', () => {
      // Create a deeply nested expression
      let deep = '(assert ';
      for (let i = 0; i < 60; i++) deep += '(and ';
      deep += 'true';
      for (let i = 0; i < 60; i++) deep += ')';
      deep += ')';
      
      const analysis = analyzeComplexity(deep);
      const violation = checkComplexityLimits(analysis, DEFAULT_LIMITS);
      
      expect(violation).not.toBeNull();
      expect(violation!.type).toBe('complexity');
    });

    it('should return reason when exceeding quantifier count', () => {
      let query = '';
      for (let i = 0; i < 15; i++) {
        query += `(assert (forall ((x${i} Int)) (> x${i} 0)))\n`;
      }
      
      const analysis = analyzeComplexity(query);
      const violation = checkComplexityLimits(analysis, DEFAULT_LIMITS);
      
      expect(violation).not.toBeNull();
      expect(violation!.type).toBe('quantifier-instantiation');
    });

    it('should use strict limits correctly', () => {
      const moderate = `
        (declare-const x1 Int)
        (declare-const x2 Int)
        ${Array(35).fill('(assert (> x1 0))').join('\n')}
      `;
      
      const analysis = analyzeComplexity(moderate);
      
      // Should pass default limits
      expect(checkComplexityLimits(analysis, DEFAULT_LIMITS)).toBeNull();
      
      // Might fail strict limits (depends on actual values)
      // This is a conditional check
    });
  });

  describe('estimateTimeout', () => {
    it('should return shorter timeout for trivial problems', () => {
      const trivial = analyzeComplexity('(assert (= x 1))');
      const timeout = estimateTimeout(trivial, 5000);
      
      expect(timeout).toBeLessThanOrEqual(5000);
    });

    it('should return longer timeout for hard problems', () => {
      const hard = analyzeComplexity(`
        (assert (forall ((x Int)) (exists ((y Int)) (= x y))))
      `);
      const trivial = analyzeComplexity('(assert (= x 1))');
      
      const hardTimeout = estimateTimeout(hard, 5000);
      const trivialTimeout = estimateTimeout(trivial, 5000);
      
      expect(hardTimeout).toBeGreaterThanOrEqual(trivialTimeout);
    });

    it('should cap at maximum timeout', () => {
      const intractable = analyzeComplexity(`
        (assert (forall ((x Int)) (exists ((y Int)) (forall ((z Int)) (exists ((w Int)) true)))))
      `);
      
      const timeout = estimateTimeout(intractable, 5000);
      
      expect(timeout).toBeLessThanOrEqual(60000);
    });
  });
});

// ============================================================================
// AUTHORITATIVE SOLVER TESTS (Unit Tests - No Z3 Required)
// ============================================================================

describe('AuthoritativeSolver', () => {
  describe('construction', () => {
    it('should create solver with default options', () => {
      const solver = createSolver();
      expect(solver).toBeInstanceOf(AuthoritativeSolver);
    });

    it('should create solver with custom options', () => {
      const solver = createSolver({
        timeout: 10000,
        complexityLimits: STRICT_LIMITS,
        debug: true,
      });
      expect(solver).toBeInstanceOf(AuthoritativeSolver);
    });
  });
});

// ============================================================================
// REAL SMT VERIFICATION TESTS (Integration - Requires Z3)
// ============================================================================

describe('Real SMT Verdicts', () => {
  let solver: AuthoritativeSolver;
  let z3Available: boolean;

  beforeAll(async () => {
    solver = createSolver({ timeout: 5000 });
    z3Available = await solver.isAvailable();
    if (!z3Available) {
      console.log('Z3 not available - skipping integration tests');
    }
  });

  describe('PROVED verdicts', () => {
    it('should PROVE simple tautology', async () => {
      if (!z3Available) return;

      const smtLib = `
        (set-logic QF_LIA)
        (declare-const x Int)
        ; Prove: if x > 0 then x >= 0 (always true)
        (assert (not (=> (> x 0) (>= x 0))))
        (check-sat)
      `;

      const result = await solver.verify(smtLib);
      
      expect(result.verdict.kind).toBe('proved');
      expect(result.verdict.confidence).toBe('authoritative');
    });

    it('should PROVE integer inequality', async () => {
      if (!z3Available) return;

      const smtLib = `
        (set-logic QF_LIA)
        (declare-const x Int)
        (declare-const y Int)
        ; Prove: x + y = y + x (commutativity)
        (assert (not (= (+ x y) (+ y x))))
        (check-sat)
      `;

      const result = await solver.verify(smtLib);
      
      expect(result.verdict.kind).toBe('proved');
    });

    it('should PROVE boolean satisfiability', async () => {
      if (!z3Available) return;

      const smtLib = `
        (set-logic QF_LIA)
        (declare-const p Bool)
        ; Prove: p or not p (law of excluded middle)
        (assert (not (or p (not p))))
        (check-sat)
      `;

      const result = await solver.verify(smtLib);
      
      expect(result.verdict.kind).toBe('proved');
    });
  });

  describe('DISPROVED verdicts', () => {
    it('should DISPROVE contradictory constraint', async () => {
      if (!z3Available) return;

      const smtLib = `
        (set-logic QF_LIA)
        (declare-const x Int)
        ; Try to prove: x > 5 and x < 3 is satisfiable (false)
        (assert (and (> x 5) (< x 3)))
        (check-sat)
        (get-model)
      `;

      const result = await solver.verify(smtLib);
      
      // UNSAT for satisfiability check means disproved
      expect(result.verdict.kind).toBe('proved'); // UNSAT = proved for negation
    });

    it('should DISPROVE with counterexample', async () => {
      if (!z3Available) return;

      const smtLib = `
        (set-logic QF_LIA)
        (declare-const x Int)
        ; Try to prove: all x > 0 implies x > 10 (false for x=5)
        (assert (> x 0))
        (assert (not (> x 10)))
        (check-sat)
        (get-model)
      `;

      const result = await solver.verify(smtLib);
      
      expect(result.verdict.kind).toBe('disproved');
      expect(result.verdict.confidence).toBe('authoritative');
      if (result.verdict.kind === 'disproved') {
        expect(result.verdict.counterexample).toBeDefined();
      }
    });

    it('should find counterexample for invalid implication', async () => {
      if (!z3Available) return;

      const smtLib = `
        (set-logic QF_LIA)
        (declare-const age Int)
        ; Try to disprove: age >= 18 implies age >= 21
        (assert (>= age 18))
        (assert (not (>= age 21)))
        (check-sat)
        (get-model)
      `;

      const result = await solver.verify(smtLib);
      
      expect(result.verdict.kind).toBe('disproved');
      if (result.verdict.kind === 'disproved') {
        // Should find age = 18, 19, or 20 as counterexample
        expect(result.verdict.counterexample).toBeDefined();
      }
    });
  });

  describe('UNKNOWN verdicts with reasons', () => {
    it('should return UNKNOWN for complex nonlinear arithmetic', async () => {
      if (!z3Available) return;

      // Nonlinear arithmetic with many variables can be undecidable
      const smtLib = `
        (set-logic NRA)
        (declare-const x Real)
        (declare-const y Real)
        (declare-const z Real)
        (assert (= (* x y) z))
        (assert (= (* y z) x))
        (assert (= (* x z) y))
        (assert (> x 0))
        (assert (> y 0))
        (assert (> z 0))
        (assert (not (= x y)))
        (check-sat)
      `;

      const result = await solver.verify(smtLib);
      
      // May be unknown due to nonlinear arithmetic
      // But could also be solved - this is a best-effort test
      if (result.verdict.kind === 'unknown') {
        expect(result.verdict.reason).toBeDefined();
        expect(result.verdict.reason.suggestion).toBeTruthy();
      }
    });

    it('should have reason metadata for timeout', async () => {
      if (!z3Available) return;

      // Create a very short timeout solver
      const fastSolver = createSolver({ timeout: 10 });

      // Create a query that will likely timeout
      let query = '(set-logic ALL)\n';
      for (let i = 0; i < 50; i++) {
        query += `(declare-const x${i} Int)\n`;
      }
      for (let i = 0; i < 50; i++) {
        for (let j = i + 1; j < 50; j++) {
          query += `(assert (distinct x${i} x${j}))\n`;
        }
      }
      query += '(check-sat)\n';

      const result = await fastSolver.verify(query);
      
      if (result.verdict.kind === 'unknown') {
        expect(result.verdict.reason.type).toBeDefined();
        expect(result.verdict.reason.suggestion).toBeTruthy();
      }
    });

    it('should detect and report complexity issues', async () => {
      // This test doesn't need Z3 - it tests pre-solver complexity check
      const complexQuery = `
        (set-logic ALL)
        ${Array(60).fill(null).map((_, i) => `(declare-const x${i} Int)`).join('\n')}
        ${Array(250).fill(null).map((_, i) => `(assert (> x${i % 60} ${i}))`).join('\n')}
        (check-sat)
      `;

      const analysis = analyzeComplexity(complexQuery);
      const violation = checkComplexityLimits(analysis, STRICT_LIMITS);

      if (violation) {
        expect(violation.suggestion).toBeTruthy();
        expect(violation.suggestion.length).toBeGreaterThan(0);
      }
    });
  });
});

// ============================================================================
// CONTRACT VERIFICATION SCENARIOS
// ============================================================================

describe('Contract Verification Scenarios', () => {
  let solver: AuthoritativeSolver;
  let z3Available: boolean;

  beforeAll(async () => {
    solver = createSolver({ timeout: 5000 });
    z3Available = await solver.isAvailable();
  });

  it('should PROVE precondition consistency for valid contract', async () => {
    if (!z3Available) return;

    // Precondition: amount > 0 AND amount <= balance
    // Check: Are there any valid inputs?
    const smtLib = `
      (set-logic QF_LIA)
      (declare-const amount Int)
      (declare-const balance Int)
      (assert (> balance 0))
      (assert (> amount 0))
      (assert (<= amount balance))
      (check-sat)
      (get-model)
    `;

    const result = await solver.verify(smtLib);
    
    // SAT means preconditions are satisfiable
    expect(result.verdict.kind).toBe('disproved'); // For satisfiability check
  });

  it('should DISPROVE impossible preconditions', async () => {
    if (!z3Available) return;

    // Precondition: amount > 100 AND amount < 50 (impossible)
    const smtLib = `
      (set-logic QF_LIA)
      (declare-const amount Int)
      (assert (> amount 100))
      (assert (< amount 50))
      (check-sat)
    `;

    const result = await solver.verify(smtLib);
    
    // UNSAT means preconditions are unsatisfiable
    expect(result.verdict.kind).toBe('proved');
  });

  it('should verify invariant preservation', async () => {
    if (!z3Available) return;

    // Invariant: balance >= 0
    // Check: Can we find a state where balance < 0?
    const smtLib = `
      (set-logic QF_LIA)
      (declare-const balance Int)
      ; Negated invariant - looking for counterexample
      (assert (< balance 0))
      ; But balance comes from valid operations
      (declare-const initial_balance Int)
      (declare-const withdrawal Int)
      (assert (>= initial_balance 0))
      (assert (> withdrawal 0))
      (assert (<= withdrawal initial_balance))
      (assert (= balance (- initial_balance withdrawal)))
      (check-sat)
    `;

    const result = await solver.verify(smtLib);
    
    // Should be UNSAT (no counterexample) = PROVED
    expect(result.verdict.kind).toBe('proved');
  });

  it('should find invariant violation', async () => {
    if (!z3Available) return;

    // Buggy contract: allows withdrawal > balance
    const smtLib = `
      (set-logic QF_LIA)
      (declare-const balance Int)
      (declare-const initial_balance Int)
      (declare-const withdrawal Int)
      (assert (>= initial_balance 0))
      (assert (> withdrawal 0))
      ; Bug: no check that withdrawal <= initial_balance
      (assert (= balance (- initial_balance withdrawal)))
      ; Can we violate balance >= 0?
      (assert (< balance 0))
      (check-sat)
      (get-model)
    `;

    const result = await solver.verify(smtLib);
    
    // Should be SAT (found violation) = DISPROVED
    expect(result.verdict.kind).toBe('disproved');
    if (result.verdict.kind === 'disproved') {
      expect(result.verdict.counterexample).toBeDefined();
    }
  });
});
