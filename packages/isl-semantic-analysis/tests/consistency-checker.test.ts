/**
 * Consistency Checker Tests
 * 
 * Tests for semantic consistency checks:
 * - Unsatisfiable preconditions (e.g., x > 5 && x < 2)
 * - Output referenced in preconditions
 * - Postconditions referencing undefined result fields
 * - Invariants referencing missing variables
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parse } from '@isl-lang/parser';
import { SemanticAnalyzer } from '../src/framework.js';
import { 
  consistencyCheckerPass,
  _internals as internals,
} from '../src/passes/consistency-checker.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Fixture: Unsatisfiable precondition - contradictory numeric bounds
 */
const FIXTURE_UNSATISFIABLE_BOUNDS = `
domain TestDomain version "1.0.0"

entity Account {
  id: UUID
  balance: Decimal
}

behavior Transfer {
  input {
    amount: Decimal
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.amount > 1000 and input.amount < 100
  }
}
`;

/**
 * Fixture: Unsatisfiable precondition - variable level
 */
const FIXTURE_UNSATISFIABLE_VARIABLE = `
domain TestDomain version "1.0.0"

behavior CheckAge {
  input {
    age: Int
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.age > 50 and input.age < 18
  }
}
`;

/**
 * Fixture: Output referenced in precondition
 */
const FIXTURE_OUTPUT_IN_PRECONDITION = `
domain TestDomain version "1.0.0"

behavior Calculate {
  input {
    value: Decimal
  }
  output {
    success: {
      total: Decimal
    }
  }
  
  preconditions {
    result.total > 0
  }
}
`;

/**
 * Fixture: Output keyword in precondition
 */
const FIXTURE_RESULT_IN_PRECONDITION = `
domain TestDomain version "1.0.0"

behavior Validate {
  input {
    data: String
  }
  output {
    success: Boolean
  }
  
  preconditions {
    result == true
  }
}
`;

/**
 * Fixture: Undefined result field in postcondition
 */
const FIXTURE_UNDEFINED_RESULT_FIELD = `
domain TestDomain version "1.0.0"

behavior Transfer {
  input {
    amount: Decimal
  }
  output {
    success: {
      transferred: Decimal
      fee: Decimal
    }
  }
  
  post success {
    result.ammount > 0
  }
}
`;

/**
 * Fixture: Multiple undefined result fields
 */
const FIXTURE_MULTIPLE_UNDEFINED_FIELDS = `
domain TestDomain version "1.0.0"

behavior CreateUser {
  input {
    name: String
  }
  output {
    success: {
      id: UUID
      created: Boolean
    }
  }
  
  post success {
    result.userId != null and result.wasCreated == true
  }
}
`;

/**
 * Fixture: Invariant with undefined variable
 */
const FIXTURE_UNDEFINED_INVARIANT_VAR = `
domain TestDomain version "1.0.0"

entity Account {
  id: UUID
  balance: Decimal
}

invariants BalanceChecks {
  undefinedEntity.balance >= 0
}
`;

/**
 * Fixture: Entity invariant with typo in field
 */
const FIXTURE_ENTITY_INVARIANT_TYPO = `
domain TestDomain version "1.0.0"

entity Account {
  id: UUID
  balance: Decimal
  owner: String
}

entity User {
  id: UUID
  email: String
  
  invariants {
    emal != null
  }
}
`;

/**
 * Fixture: Valid spec (control test)
 */
const FIXTURE_VALID = `
domain TestDomain version "1.0.0"

entity Account {
  id: UUID
  balance: Decimal
}

behavior Deposit {
  input {
    accountId: UUID
    amount: Decimal
  }
  output {
    success: {
      newBalance: Decimal
    }
  }
  
  preconditions {
    input.amount > 0 and input.amount <= 10000
  }
  
  post success {
    result.newBalance >= input.amount
  }
}

invariants PositiveBalances {
  all a in Account (a.balance >= 0)
}
`;

/**
 * Fixture: Valid with satisfiable bounds
 */
const FIXTURE_VALID_BOUNDS = `
domain TestDomain version "1.0.0"

behavior Transfer {
  input {
    amount: Decimal
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.amount > 0 and input.amount < 10000
  }
}
`;

/**
 * Fixture: Boundary case - equal bounds with inclusive operators
 */
const FIXTURE_BOUNDARY_INCLUSIVE = `
domain TestDomain version "1.0.0"

behavior CheckExact {
  input {
    value: Int
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.value >= 5 and input.value <= 5
  }
}
`;

/**
 * Fixture: Boundary case - equal bounds with exclusive operators (unsatisfiable)
 */
const FIXTURE_BOUNDARY_EXCLUSIVE = `
domain TestDomain version "1.0.0"

behavior CheckExact {
  input {
    value: Int
  }
  output {
    success: Boolean
  }
  
  preconditions {
    input.value > 5 and input.value < 5
  }
}
`;

// ============================================================================
// Unit Tests for Internal Functions
// ============================================================================

describe('Consistency Checker Internals', () => {
  describe('extractVariables', () => {
    it('should extract identifier names', () => {
      const expr = {
        kind: 'Identifier' as const,
        name: 'amount',
        location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 7 },
      };
      
      const vars = internals.extractVariables(expr);
      expect(vars.has('amount')).toBe(true);
    });

    it('should extract variables from binary expressions', () => {
      const expr = {
        kind: 'BinaryExpr' as const,
        operator: '>' as const,
        left: {
          kind: 'Identifier' as const,
          name: 'x',
          location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 2 },
        },
        right: {
          kind: 'Identifier' as const,
          name: 'y',
          location: { file: 'test.isl', line: 1, column: 5, endLine: 1, endColumn: 6 },
        },
        location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 6 },
      };
      
      const vars = internals.extractVariables(expr);
      expect(vars.has('x')).toBe(true);
      expect(vars.has('y')).toBe(true);
    });
  });

  describe('referencesOutput', () => {
    it('should detect result expression', () => {
      const expr = {
        kind: 'ResultExpr' as const,
        location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 7 },
      };
      
      const result = internals.referencesOutput(expr);
      expect(result.found).toBe(true);
    });

    it('should detect result identifier', () => {
      const expr = {
        kind: 'Identifier' as const,
        name: 'result',
        location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 7 },
      };
      
      const result = internals.referencesOutput(expr);
      expect(result.found).toBe(true);
    });

    it('should not flag non-output identifiers', () => {
      const expr = {
        kind: 'Identifier' as const,
        name: 'amount',
        location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 7 },
      };
      
      const result = internals.referencesOutput(expr);
      expect(result.found).toBe(false);
    });
  });

  describe('checkBoundsSatisfiability', () => {
    it('should detect conflicting bounds (lower > upper)', () => {
      const bounds = [
        { lower: 100, lowerInclusive: true },
        { upper: 50, upperInclusive: true },
      ];
      
      const result = internals.checkBoundsSatisfiability(bounds);
      expect(result.satisfiable).toBe(false);
    });

    it('should accept valid bounds', () => {
      const bounds = [
        { lower: 0, lowerInclusive: true },
        { upper: 100, upperInclusive: true },
      ];
      
      const result = internals.checkBoundsSatisfiability(bounds);
      expect(result.satisfiable).toBe(true);
    });

    it('should detect exclusive equal bounds as unsatisfiable', () => {
      const bounds = [
        { lower: 5, lowerInclusive: false },
        { upper: 5, upperInclusive: false },
      ];
      
      const result = internals.checkBoundsSatisfiability(bounds);
      expect(result.satisfiable).toBe(false);
    });

    it('should accept inclusive equal bounds (single value)', () => {
      const bounds = [
        { lower: 5, lowerInclusive: true },
        { upper: 5, upperInclusive: true },
      ];
      
      const result = internals.checkBoundsSatisfiability(bounds);
      expect(result.satisfiable).toBe(true);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('ConsistencyCheckerPass', () => {
  let analyzer: SemanticAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticAnalyzer();
    analyzer.register(consistencyCheckerPass());
  });

  describe('Unsatisfiable Preconditions', () => {
    it('should detect contradictory numeric bounds', () => {
      const result = parse(FIXTURE_UNSATISFIABLE_BOUNDS, 'test.isl');
      expect(result.success).toBe(true);
      expect(result.domain).toBeDefined();

      const analysis = analyzer.analyze(result.domain!);
      
      const unsatisfiableError = analysis.diagnostics.find(d => 
        d.code === 'E0310' || d.message.includes('unsatisfiable')
      );
      expect(unsatisfiableError).toBeDefined();
    });

    it('should detect conflicting variable constraints', () => {
      const result = parse(FIXTURE_UNSATISFIABLE_VARIABLE, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const unsatisfiableError = analysis.diagnostics.find(d => 
        d.code === 'E0310'
      );
      expect(unsatisfiableError).toBeDefined();
    });

    it('should accept valid bounds', () => {
      const result = parse(FIXTURE_VALID_BOUNDS, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const unsatisfiableError = analysis.diagnostics.find(d => 
        d.code === 'E0310'
      );
      expect(unsatisfiableError).toBeUndefined();
    });

    it('should accept inclusive equal bounds (single valid value)', () => {
      const result = parse(FIXTURE_BOUNDARY_INCLUSIVE, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const unsatisfiableError = analysis.diagnostics.find(d => 
        d.code === 'E0310'
      );
      expect(unsatisfiableError).toBeUndefined();
    });

    it('should detect exclusive equal bounds as unsatisfiable', () => {
      const result = parse(FIXTURE_BOUNDARY_EXCLUSIVE, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const unsatisfiableError = analysis.diagnostics.find(d => 
        d.code === 'E0310'
      );
      expect(unsatisfiableError).toBeDefined();
    });
  });

  describe('Output in Preconditions', () => {
    it('should detect result reference in precondition', () => {
      const result = parse(FIXTURE_OUTPUT_IN_PRECONDITION, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const outputError = analysis.diagnostics.find(d => 
        d.code === 'E0311' || d.message.includes('output') || d.message.includes('result')
      );
      expect(outputError).toBeDefined();
    });

    it('should detect result keyword in precondition', () => {
      const result = parse(FIXTURE_RESULT_IN_PRECONDITION, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const outputError = analysis.diagnostics.find(d => 
        d.code === 'E0311'
      );
      expect(outputError).toBeDefined();
    });

    it('should allow result in postcondition', () => {
      const result = parse(FIXTURE_VALID, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const outputError = analysis.diagnostics.find(d => 
        d.code === 'E0311'
      );
      expect(outputError).toBeUndefined();
    });
  });

  describe('Undefined Result Fields', () => {
    it('should detect undefined field in postcondition', () => {
      const result = parse(FIXTURE_UNDEFINED_RESULT_FIELD, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const fieldError = analysis.diagnostics.find(d => 
        d.code === 'E0312' || d.message.includes('ammount')
      );
      expect(fieldError).toBeDefined();
    });

    it('should detect multiple undefined fields', () => {
      const result = parse(FIXTURE_MULTIPLE_UNDEFINED_FIELDS, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const fieldErrors = analysis.diagnostics.filter(d => 
        d.code === 'E0312'
      );
      // Should find at least 2 errors (userId and wasCreated)
      expect(fieldErrors.length).toBeGreaterThanOrEqual(2);
    });

    it('should accept valid result fields', () => {
      const result = parse(FIXTURE_VALID, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const fieldError = analysis.diagnostics.find(d => 
        d.code === 'E0312'
      );
      expect(fieldError).toBeUndefined();
    });
  });

  describe('Undefined Invariant Variables', () => {
    it('should detect undefined variable in global invariant', () => {
      const result = parse(FIXTURE_UNDEFINED_INVARIANT_VAR, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const varError = analysis.diagnostics.find(d => 
        d.code === 'E0313' || d.message.includes('undefinedEntity')
      );
      expect(varError).toBeDefined();
    });

    it('should detect typo in entity invariant field', () => {
      const result = parse(FIXTURE_ENTITY_INVARIANT_TYPO, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const varError = analysis.diagnostics.find(d => 
        d.code === 'E0313' || d.message.includes('emal')
      );
      expect(varError).toBeDefined();
    });

    it('should accept valid invariant with proper quantifier', () => {
      const result = parse(FIXTURE_VALID, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const varError = analysis.diagnostics.find(d => 
        d.code === 'E0313'
      );
      expect(varError).toBeUndefined();
    });
  });

  describe('Valid Specs', () => {
    it('should pass for well-formed spec', () => {
      const result = parse(FIXTURE_VALID, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const errors = analysis.diagnostics.filter(d => d.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Pass Configuration', () => {
    it('should allow disabling specific checks', () => {
      const customAnalyzer = new SemanticAnalyzer();
      customAnalyzer.register(consistencyCheckerPass({
        checkUnsatisfiable: false,
      }));

      const result = parse(FIXTURE_UNSATISFIABLE_BOUNDS, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = customAnalyzer.analyze(result.domain!);
      
      // Should not find unsatisfiability error when check is disabled
      const unsatisfiableError = analysis.diagnostics.find(d => 
        d.code === 'E0310'
      );
      expect(unsatisfiableError).toBeUndefined();
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error messages', () => {
      const result = parse(FIXTURE_UNSATISFIABLE_BOUNDS, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const error = analysis.diagnostics.find(d => d.code === 'E0310');
      if (error) {
        expect(error.message).toBeTruthy();
        expect(error.notes).toBeDefined();
        expect(error.help).toBeDefined();
      }
    });

    it('should include available fields in undefined field errors', () => {
      const result = parse(FIXTURE_UNDEFINED_RESULT_FIELD, 'test.isl');
      expect(result.success).toBe(true);

      const analysis = analyzer.analyze(result.domain!);
      
      const error = analysis.diagnostics.find(d => d.code === 'E0312');
      if (error && error.notes) {
        // Should mention available fields
        const notesText = error.notes.join(' ');
        expect(notesText).toContain('transferred');
      }
    });
  });
});
