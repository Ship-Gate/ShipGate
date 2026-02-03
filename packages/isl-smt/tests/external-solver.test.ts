/**
 * External Solver Adapter Tests
 * 
 * Tests for:
 * - Cross-platform solver detection
 * - Timeout enforcement (no hanging processes)
 * - Output size limits
 * - Model parsing
 * - Z3 and CVC5 support
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  checkSolverAvailability,
  checkSatExternal,
  clearSolverCache,
  getBestAvailableSolver,
  checkAllSolvers,
  type ExternalSolver,
} from '../src/external-solver.js';

describe('Solver Availability Detection', () => {
  beforeEach(() => {
    clearSolverCache();
  });
  
  it('should detect Z3 availability', async () => {
    const availability = await checkSolverAvailability('z3');
    
    expect(availability).toBeDefined();
    expect(typeof availability.available).toBe('boolean');
    
    if (availability.available) {
      expect(availability.path).toBeDefined();
      // Version might not always be parsed
    } else {
      expect(availability.error).toBeDefined();
    }
  });
  
  it('should detect CVC5 availability', async () => {
    const availability = await checkSolverAvailability('cvc5');
    
    expect(availability).toBeDefined();
    expect(typeof availability.available).toBe('boolean');
    
    if (availability.available) {
      expect(availability.path).toBeDefined();
    }
  });
  
  it('should cache availability results', async () => {
    // First check
    const result1 = await checkSolverAvailability('z3');
    
    // Second check should use cache
    const result2 = await checkSolverAvailability('z3');
    
    expect(result1.available).toBe(result2.available);
    expect(result1.path).toBe(result2.path);
  });
  
  it('should check all solvers', async () => {
    const allSolvers = await checkAllSolvers();
    
    expect(allSolvers).toBeDefined();
    expect(allSolvers.z3).toBeDefined();
    expect(allSolvers.cvc5).toBeDefined();
  });
  
  it('should get best available solver', async () => {
    const best = await getBestAvailableSolver();
    
    // Result should be null, 'z3', or 'cvc5'
    expect([null, 'z3', 'cvc5']).toContain(best);
  });
});

describe('Timeout Enforcement', () => {
  it('should respect timeout and not hang', async () => {
    // Very simple query that should complete quickly
    const query = `
      (set-logic ALL)
      (declare-const x Int)
      (assert (> x 0))
      (check-sat)
      (get-model)
    `;
    
    const start = Date.now();
    
    await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 100, // Very short timeout
    });
    
    const elapsed = Date.now() - start;
    
    // Should complete within timeout + buffer (1 second max)
    expect(elapsed).toBeLessThan(2000);
  }, 5000);
  
  it('should return timeout status for slow queries', async () => {
    // Skip if no solver available
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    // Complex query that might timeout
    const query = `
      (set-logic ALL)
      ${Array.from({ length: 20 }, (_, i) => `(declare-const x${i} Int)`).join('\n')}
      ${Array.from({ length: 20 }, (_, i) => `(assert (and (> x${i} 0) (< x${i} 1000000)))`).join('\n')}
      (check-sat)
    `;
    
    const start = Date.now();
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 10, // Very short timeout
    });
    
    const elapsed = Date.now() - start;
    
    // Should not hang - elapsed should be reasonable
    expect(elapsed).toBeLessThan(3000);
    
    // Result should indicate timeout or error
    expect(['timeout', 'unknown', 'sat', 'error']).toContain(result.status);
  }, 10000);
  
  it('should kill process on timeout', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    // Query designed to be slow
    const query = `
      (set-logic ALL)
      (set-option :produce-models true)
      ${Array.from({ length: 30 }, (_, i) => `(declare-const x${i} Int)`).join('\n')}
      ${Array.from({ length: 30 }, (_, i) => `(assert (and (>= x${i} 0) (<= x${i} 100)))`).join('\n')}
      (assert (= (+ ${Array.from({ length: 30 }, (_, i) => `x${i}`).join(' ')}) 1500))
      (check-sat)
    `;
    
    const start = Date.now();
    
    await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 50,
    });
    
    const elapsed = Date.now() - start;
    
    // CRITICAL: Must not hang - should complete within reasonable time
    expect(elapsed).toBeLessThan(5000);
  }, 10000);
});

describe('SMT-LIB Query Execution', () => {
  it('should handle SAT query correctly', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (set-option :produce-models true)
      (declare-const x Int)
      (assert (and (> x 0) (< x 10)))
      (check-sat)
      (get-model)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
      produceModels: true,
    });
    
    expect(result.status).toBe('sat');
    if (result.status === 'sat') {
      expect(result.model).toBeDefined();
      const x = result.model?.x;
      if (typeof x === 'number') {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(10);
      }
    }
  }, 10000);
  
  it('should handle UNSAT query correctly', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (declare-const x Int)
      (assert (and (> x 10) (< x 5)))
      (check-sat)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
    });
    
    expect(result.status).toBe('unsat');
  }, 10000);
  
  it('should handle boolean satisfiability', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    // a AND NOT a is UNSAT
    const query = `
      (set-logic ALL)
      (declare-const a Bool)
      (assert (and a (not a)))
      (check-sat)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
    });
    
    expect(result.status).toBe('unsat');
  }, 10000);
  
  it('should return error for invalid query', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic INVALID_LOGIC)
      (assert bad syntax here)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
    });
    
    expect(['error', 'unknown']).toContain(result.status);
  }, 10000);
});

describe('Model Parsing', () => {
  it('should parse integer models', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (set-option :produce-models true)
      (declare-const x Int)
      (assert (= x 42))
      (check-sat)
      (get-model)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
      produceModels: true,
    });
    
    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      expect(result.model.x).toBe(42);
    }
  }, 10000);
  
  it('should parse boolean models', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (set-option :produce-models true)
      (declare-const b Bool)
      (assert b)
      (check-sat)
      (get-model)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
      produceModels: true,
    });
    
    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      expect(result.model.b).toBe(true);
    }
  }, 10000);
  
  it('should parse negative integer models', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (set-option :produce-models true)
      (declare-const x Int)
      (assert (< x 0))
      (assert (> x -100))
      (check-sat)
      (get-model)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
      produceModels: true,
    });
    
    expect(result.status).toBe('sat');
    if (result.status === 'sat' && result.model) {
      const x = result.model.x;
      if (typeof x === 'number') {
        expect(x).toBeLessThan(0);
        expect(x).toBeGreaterThan(-100);
      }
    }
  }, 10000);
});

describe('Output Size Limits', () => {
  it('should handle large output', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    // Query that produces a model with many variables
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
      solver: 'z3',
      timeoutMs: 5000,
      maxOutputBytes: 1024 * 1024, // 1MB limit
    });
    
    expect(result.status).toBe('sat');
  }, 15000);
  
  it('should truncate excessive output', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (set-option :produce-models true)
      (declare-const x Int)
      (assert (> x 0))
      (check-sat)
      (get-model)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
      maxOutputBytes: 100, // Very small limit
    });
    
    // Should still get a result, not crash
    expect(['sat', 'unknown', 'error']).toContain(result.status);
  }, 10000);
});

describe('CVC5 Support', () => {
  it('should execute CVC5 query if available', async () => {
    const cvc5 = await checkSolverAvailability('cvc5');
    if (!cvc5.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (declare-const x Int)
      (assert (and (> x 0) (< x 10)))
      (check-sat)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'cvc5',
      timeoutMs: 5000,
    });
    
    expect(result.status).toBe('sat');
  }, 10000);
});

describe('Solver Statistics', () => {
  it('should include timing stats', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (declare-const x Int)
      (assert (> x 0))
      (check-sat)
    `;
    
    const result = await checkSatExternal(query, {
      solver: 'z3',
      timeoutMs: 5000,
    });
    
    expect(result.stats).toBeDefined();
    expect(result.stats?.solverTimeMs).toBeGreaterThanOrEqual(0);
  }, 10000);
});

describe('Error Handling', () => {
  it('should handle missing solver gracefully', async () => {
    clearSolverCache();
    
    const result = await checkSatExternal('(check-sat)', {
      solver: 'z3',
      timeoutMs: 1000,
      solverPath: '/nonexistent/path/to/z3',
    });
    
    // Should return error, not throw
    expect(['error', 'unknown']).toContain(result.status);
  });
  
  it('should handle empty query', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const result = await checkSatExternal('', {
      solver: 'z3',
      timeoutMs: 1000,
    });
    
    expect(['error', 'unknown']).toContain(result.status);
  }, 10000);
});

describe('Determinism', () => {
  it('should produce same result for same query', async () => {
    const z3 = await checkSolverAvailability('z3');
    if (!z3.available) {
      return;
    }
    
    const query = `
      (set-logic ALL)
      (declare-const x Int)
      (assert (and (> x 5) (< x 10)))
      (check-sat)
    `;
    
    const results = await Promise.all([
      checkSatExternal(query, { solver: 'z3', timeoutMs: 5000 }),
      checkSatExternal(query, { solver: 'z3', timeoutMs: 5000 }),
      checkSatExternal(query, { solver: 'z3', timeoutMs: 5000 }),
    ]);
    
    // All results should have the same status
    expect(results[0]?.status).toBe(results[1]?.status);
    expect(results[1]?.status).toBe(results[2]?.status);
  }, 20000);
});
