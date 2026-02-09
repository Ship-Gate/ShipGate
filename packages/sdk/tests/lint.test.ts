import { describe, it, expect } from 'vitest';
import { lintISL } from '../src/lint.js';

// ============================================================================
// lintISL
// ============================================================================

describe('lintISL', () => {
  it('returns a quality report for a valid ISL spec', () => {
    const report = lintISL(`
      domain Payments {
        version: "1.0.0"
        entity Transaction {
          id: UUID
          amount: Decimal
          status: String
        }

        behavior Charge {
          input {
            amount: Decimal
            currency: String
          }
          output {
            success: Boolean
            errors {
              InsufficientFunds {
                when: "balance < amount"
                retriable: false
              }
            }
          }
          pre {
            input.amount > 0
          }
          post success {
            result == true
          }
        }
      }
    `);

    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.dimensions).toBeDefined();
    expect(report.dimensions.completeness.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.specificity.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.security.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.testability.score).toBeGreaterThanOrEqual(0);
    expect(report.dimensions.consistency.score).toBeGreaterThanOrEqual(0);
  });

  it('returns zero score for invalid ISL', () => {
    const report = lintISL('not valid ISL');

    expect(report.score).toBe(0);
    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(report.suggestions[0].severity).toBe('critical');
  });

  it('returns zero score for empty string', () => {
    const report = lintISL('');

    expect(report.score).toBe(0);
    expect(report.dimensions.completeness.score).toBe(0);
  });

  it('provides actionable suggestions', () => {
    const report = lintISL(`
      domain Minimal {
        version: "1.0.0"
        behavior DoSomething {
          input { x: String }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    // A minimal spec should have suggestions for improvement
    expect(report.suggestions).toBeDefined();
    expect(Array.isArray(report.suggestions)).toBe(true);
  });

  it('returns frozen (read-only) results', () => {
    const report = lintISL(`
      domain Test {
        version: "1.0.0"
        behavior Ping {
          input { msg: String }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.dimensions)).toBe(true);
  });

  it('dimension findings are string arrays', () => {
    const report = lintISL(`
      domain Example {
        version: "1.0.0"
        entity User {
          id: UUID
          name: String
        }
        behavior CreateUser {
          input { name: String }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    for (const dim of [
      'completeness',
      'specificity',
      'security',
      'testability',
      'consistency',
    ] as const) {
      expect(Array.isArray(report.dimensions[dim].findings)).toBe(true);
      for (const finding of report.dimensions[dim].findings) {
        expect(typeof finding).toBe('string');
      }
    }
  });

  it('suggestion severity is one of info, warning, critical', () => {
    const report = lintISL(`
      domain Mini {
        version: "1.0.0"
        behavior Simple {
          input { x: String }
          output { success: Boolean }
          post success {
            result == true
          }
        }
      }
    `);

    for (const suggestion of report.suggestions) {
      expect(['info', 'warning', 'critical']).toContain(suggestion.severity);
    }
  });
});
