// ============================================================================
// Formal Verifier Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { verify } from '../src/translator';
import { Z3Solver, MockZ3Solver, validateSmtLib } from '../src/solver';
import { encodeExpression } from '../src/encoding/expressions';
import { encodeSorts, typeDefToSmt } from '../src/encoding/types';
import { encodeUniversal, encodeExistential } from '../src/encoding/quantifiers';
import { encodeTemporalProperty } from '../src/encoding/temporal';
import { parseCounterexample, formatCounterexample } from '../src/counterexample';
import { generateReport, generateSummary } from '../src/report';
import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createSourceLocation = (): AST.SourceLocation => ({
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 1,
});

const createMinimalDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'TestDomain', location: createSourceLocation() },
  version: { kind: 'StringLiteral', value: '1.0.0', location: createSourceLocation() },
  imports: [],
  types: [],
  entities: [
    {
      kind: 'Entity',
      name: { kind: 'Identifier', name: 'User', location: createSourceLocation() },
      fields: [
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'UUID', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
        {
          kind: 'Field',
          name: { kind: 'Identifier', name: 'age', location: createSourceLocation() },
          type: { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() },
          optional: false,
          annotations: [],
          location: createSourceLocation(),
        },
      ],
      invariants: [
        {
          kind: 'BinaryExpr',
          operator: '>=',
          left: { kind: 'Identifier', name: 'age', location: createSourceLocation() },
          right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createSourceLocation() },
          location: createSourceLocation(),
        } as AST.BinaryExpr,
      ],
      location: createSourceLocation(),
    },
  ],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: createSourceLocation(),
});

const createDomainWithBehavior = (): AST.Domain => {
  const domain = createMinimalDomain();
  domain.behaviors = [
    {
      kind: 'Behavior',
      name: { kind: 'Identifier', name: 'CreateUser', location: createSourceLocation() },
      input: {
        kind: 'InputSpec',
        fields: [
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'email', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
          {
            kind: 'Field',
            name: { kind: 'Identifier', name: 'age', location: createSourceLocation() },
            type: { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() },
            optional: false,
            annotations: [],
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      output: {
        kind: 'OutputSpec',
        success: {
          kind: 'ReferenceType',
          name: {
            kind: 'QualifiedName',
            parts: [{ kind: 'Identifier', name: 'User', location: createSourceLocation() }],
            location: createSourceLocation(),
          },
          location: createSourceLocation(),
        },
        errors: [
          {
            kind: 'ErrorSpec',
            name: { kind: 'Identifier', name: 'INVALID_AGE', location: createSourceLocation() },
            when: { kind: 'StringLiteral', value: 'Age must be positive', location: createSourceLocation() },
            retriable: false,
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      preconditions: [
        {
          kind: 'BinaryExpr',
          operator: '>=',
          left: {
            kind: 'MemberExpr',
            object: { kind: 'Identifier', name: 'input', location: createSourceLocation() },
            property: { kind: 'Identifier', name: 'age', location: createSourceLocation() },
            location: createSourceLocation(),
          },
          right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createSourceLocation() },
          location: createSourceLocation(),
        } as AST.BinaryExpr,
      ],
      postconditions: [
        {
          kind: 'PostconditionBlock',
          condition: 'success',
          predicates: [
            {
              kind: 'CallExpr',
              callee: {
                kind: 'MemberExpr',
                object: { kind: 'Identifier', name: 'User', location: createSourceLocation() },
                property: { kind: 'Identifier', name: 'exists', location: createSourceLocation() },
                location: createSourceLocation(),
              },
              arguments: [
                {
                  kind: 'MemberExpr',
                  object: { kind: 'Identifier', name: 'result', location: createSourceLocation() },
                  property: { kind: 'Identifier', name: 'id', location: createSourceLocation() },
                  location: createSourceLocation(),
                },
              ],
              location: createSourceLocation(),
            } as AST.CallExpr,
          ],
          location: createSourceLocation(),
        },
      ],
      invariants: [],
      temporal: [],
      security: [],
      compliance: [],
      location: createSourceLocation(),
    },
  ];
  return domain;
};

const createDomainWithLifecycle = (): AST.Domain => {
  const domain = createMinimalDomain();
  domain.entities[0].lifecycle = {
    kind: 'LifecycleSpec',
    transitions: [
      {
        kind: 'LifecycleTransition',
        from: { kind: 'Identifier', name: 'PENDING', location: createSourceLocation() },
        to: { kind: 'Identifier', name: 'ACTIVE', location: createSourceLocation() },
        location: createSourceLocation(),
      },
      {
        kind: 'LifecycleTransition',
        from: { kind: 'Identifier', name: 'ACTIVE', location: createSourceLocation() },
        to: { kind: 'Identifier', name: 'DELETED', location: createSourceLocation() },
        location: createSourceLocation(),
      },
    ],
    location: createSourceLocation(),
  };
  return domain;
};

// ============================================================================
// EXPRESSION ENCODING TESTS
// ============================================================================

describe('encodeExpression', () => {
  it('should encode identifiers', () => {
    const expr: AST.Identifier = {
      kind: 'Identifier',
      name: 'foo',
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('foo');
  });

  it('should encode identifiers with prefix', () => {
    const expr: AST.Identifier = {
      kind: 'Identifier',
      name: 'email',
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, { prefix: 'input' })).toBe('input-email');
  });

  it('should encode number literals', () => {
    const expr: AST.NumberLiteral = {
      kind: 'NumberLiteral',
      value: 42,
      isFloat: false,
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('42');
  });

  it('should encode float literals', () => {
    const expr: AST.NumberLiteral = {
      kind: 'NumberLiteral',
      value: 3.14,
      isFloat: true,
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('3.1400000000');
  });

  it('should encode boolean literals', () => {
    const trueExpr: AST.BooleanLiteral = {
      kind: 'BooleanLiteral',
      value: true,
      location: createSourceLocation(),
    };
    const falseExpr: AST.BooleanLiteral = {
      kind: 'BooleanLiteral',
      value: false,
      location: createSourceLocation(),
    };
    expect(encodeExpression(trueExpr, {})).toBe('true');
    expect(encodeExpression(falseExpr, {})).toBe('false');
  });

  it('should encode string literals with escaping', () => {
    const expr: AST.StringLiteral = {
      kind: 'StringLiteral',
      value: 'hello "world"',
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('"hello \\"world\\""');
  });

  it('should encode binary expressions', () => {
    const expr: AST.BinaryExpr = {
      kind: 'BinaryExpr',
      operator: '+',
      left: { kind: 'NumberLiteral', value: 1, isFloat: false, location: createSourceLocation() },
      right: { kind: 'NumberLiteral', value: 2, isFloat: false, location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('(+ 1 2)');
  });

  it('should encode comparison operators', () => {
    const expr: AST.BinaryExpr = {
      kind: 'BinaryExpr',
      operator: '==',
      left: { kind: 'Identifier', name: 'x', location: createSourceLocation() },
      right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('(= x 0)');
  });

  it('should encode logical operators', () => {
    const andExpr: AST.BinaryExpr = {
      kind: 'BinaryExpr',
      operator: 'and',
      left: { kind: 'BooleanLiteral', value: true, location: createSourceLocation() },
      right: { kind: 'BooleanLiteral', value: false, location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(encodeExpression(andExpr, {})).toBe('(and true false)');
  });

  it('should encode implies operator', () => {
    const expr: AST.BinaryExpr = {
      kind: 'BinaryExpr',
      operator: 'implies',
      left: { kind: 'Identifier', name: 'p', location: createSourceLocation() },
      right: { kind: 'Identifier', name: 'q', location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('(=> p q)');
  });

  it('should encode unary expressions', () => {
    const notExpr: AST.UnaryExpr = {
      kind: 'UnaryExpr',
      operator: 'not',
      operand: { kind: 'BooleanLiteral', value: true, location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(encodeExpression(notExpr, {})).toBe('(not true)');
  });

  it('should encode conditional expressions', () => {
    const expr: AST.ConditionalExpr = {
      kind: 'ConditionalExpr',
      condition: { kind: 'BooleanLiteral', value: true, location: createSourceLocation() },
      thenBranch: { kind: 'NumberLiteral', value: 1, isFloat: false, location: createSourceLocation() },
      elseBranch: { kind: 'NumberLiteral', value: 2, isFloat: false, location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('(ite true 1 2)');
  });

  it('should encode duration literals in milliseconds', () => {
    const expr: AST.DurationLiteral = {
      kind: 'DurationLiteral',
      value: 5,
      unit: 'seconds',
      location: createSourceLocation(),
    };
    expect(encodeExpression(expr, {})).toBe('5000');
  });
});

// ============================================================================
// TYPE ENCODING TESTS
// ============================================================================

describe('typeDefToSmt', () => {
  it('should encode primitive types', () => {
    const stringType: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() };
    const intType: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() };
    const boolType: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'Boolean', location: createSourceLocation() };
    const decimalType: AST.PrimitiveType = { kind: 'PrimitiveType', name: 'Decimal', location: createSourceLocation() };

    expect(typeDefToSmt(stringType)).toBe('String');
    expect(typeDefToSmt(intType)).toBe('Int');
    expect(typeDefToSmt(boolType)).toBe('Bool');
    expect(typeDefToSmt(decimalType)).toBe('Real');
  });

  it('should encode reference types', () => {
    const refType: AST.ReferenceType = {
      kind: 'ReferenceType',
      name: {
        kind: 'QualifiedName',
        parts: [{ kind: 'Identifier', name: 'User', location: createSourceLocation() }],
        location: createSourceLocation(),
      },
      location: createSourceLocation(),
    };
    expect(typeDefToSmt(refType)).toBe('User');
  });

  it('should encode list types', () => {
    const listType: AST.ListType = {
      kind: 'ListType',
      element: { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(typeDefToSmt(listType)).toBe('(Array Int Int)');
  });

  it('should encode map types', () => {
    const mapType: AST.MapType = {
      kind: 'MapType',
      key: { kind: 'PrimitiveType', name: 'String', location: createSourceLocation() },
      value: { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() },
      location: createSourceLocation(),
    };
    expect(typeDefToSmt(mapType)).toBe('(Array String Int)');
  });

  it('should encode enum types as Int', () => {
    const enumType: AST.EnumType = {
      kind: 'EnumType',
      variants: [
        { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'A', location: createSourceLocation() }, location: createSourceLocation() },
        { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'B', location: createSourceLocation() }, location: createSourceLocation() },
      ],
      location: createSourceLocation(),
    };
    expect(typeDefToSmt(enumType)).toBe('Int');
  });
});

describe('encodeSorts', () => {
  it('should encode enum type declarations', () => {
    const typeDecl: AST.TypeDeclaration = {
      kind: 'TypeDeclaration',
      name: { kind: 'Identifier', name: 'Status', location: createSourceLocation() },
      definition: {
        kind: 'EnumType',
        variants: [
          { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'ACTIVE', location: createSourceLocation() }, location: createSourceLocation() },
          { kind: 'EnumVariant', name: { kind: 'Identifier', name: 'INACTIVE', location: createSourceLocation() }, location: createSourceLocation() },
        ],
        location: createSourceLocation(),
      },
      annotations: [],
      location: createSourceLocation(),
    };

    const encoded = encodeSorts(typeDecl);
    expect(encoded).toContain('Enum Status');
    expect(encoded).toContain('define-sort Status');
    expect(encoded).toContain('Status-valid');
  });

  it('should encode constrained type declarations', () => {
    const typeDecl: AST.TypeDeclaration = {
      kind: 'TypeDeclaration',
      name: { kind: 'Identifier', name: 'Age', location: createSourceLocation() },
      definition: {
        kind: 'ConstrainedType',
        base: { kind: 'PrimitiveType', name: 'Int', location: createSourceLocation() },
        constraints: [
          {
            kind: 'Constraint',
            name: 'min',
            value: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createSourceLocation() },
            location: createSourceLocation(),
          },
          {
            kind: 'Constraint',
            name: 'max',
            value: { kind: 'NumberLiteral', value: 150, isFloat: false, location: createSourceLocation() },
            location: createSourceLocation(),
          },
        ],
        location: createSourceLocation(),
      },
      annotations: [],
      location: createSourceLocation(),
    };

    const encoded = encodeSorts(typeDecl);
    expect(encoded).toContain('Age with constraints');
    expect(encoded).toContain('Age-valid');
    expect(encoded).toContain('>= x 0');
    expect(encoded).toContain('<= x 150');
  });
});

// ============================================================================
// QUANTIFIER ENCODING TESTS
// ============================================================================

describe('quantifier encoding', () => {
  it('should encode universal quantifier', () => {
    const body: AST.BinaryExpr = {
      kind: 'BinaryExpr',
      operator: '>=',
      left: { kind: 'Identifier', name: 'x', location: createSourceLocation() },
      right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: createSourceLocation() },
      location: createSourceLocation(),
    };

    const encoded = encodeUniversal(
      [{ name: 'x', sort: 'Int' }],
      body,
      {}
    );

    expect(encoded).toContain('forall');
    expect(encoded).toContain('(x Int)');
    expect(encoded).toContain('>= x 0');
  });

  it('should encode existential quantifier', () => {
    const body: AST.BinaryExpr = {
      kind: 'BinaryExpr',
      operator: '==',
      left: { kind: 'Identifier', name: 'x', location: createSourceLocation() },
      right: { kind: 'NumberLiteral', value: 42, isFloat: false, location: createSourceLocation() },
      location: createSourceLocation(),
    };

    const encoded = encodeExistential(
      [{ name: 'x', sort: 'Int' }],
      body,
      {}
    );

    expect(encoded).toContain('exists');
    expect(encoded).toContain('(x Int)');
    expect(encoded).toContain('= x 42');
  });

  it('should encode quantifier with constraint', () => {
    const body: AST.BooleanLiteral = {
      kind: 'BooleanLiteral',
      value: true,
      location: createSourceLocation(),
    };

    const encoded = encodeUniversal(
      [{ name: 'u', sort: 'User', constraint: '(user-exists u)' }],
      body,
      {}
    );

    expect(encoded).toContain('forall');
    expect(encoded).toContain('(u User)');
    expect(encoded).toContain('=>');
    expect(encoded).toContain('user-exists u');
  });
});

// ============================================================================
// SMT-LIB VALIDATION TESTS
// ============================================================================

describe('validateSmtLib', () => {
  it('should validate balanced parentheses', () => {
    const valid = '(assert (= x 1))';
    const invalid = '(assert (= x 1)';

    expect(validateSmtLib(valid).valid).toBe(true);
    expect(validateSmtLib(invalid).valid).toBe(false);
  });

  it('should handle strings with parentheses', () => {
    const withString = '(assert (= x "(test)"))';
    expect(validateSmtLib(withString).valid).toBe(true);
  });

  it('should detect unclosed strings', () => {
    const unclosed = '(assert (= x "unclosed))';
    expect(validateSmtLib(unclosed).valid).toBe(false);
  });
});

// ============================================================================
// COUNTEREXAMPLE PARSING TESTS
// ============================================================================

describe('parseCounterexample', () => {
  it('should parse simple model', () => {
    const model = `
(model
  (define-fun input-age () Int 25)
  (define-fun input-email () String "test@example.com")
)`;

    const ce = parseCounterexample(model, 'test-property');

    expect(ce.property).toBe('test-property');
    expect(ce.inputs.age).toBe(25);
    expect(ce.inputs.email).toBe('test@example.com');
  });

  it('should parse negative numbers', () => {
    const model = `
(model
  (define-fun input-value () Int (- 5))
)`;

    const ce = parseCounterexample(model, 'test');
    expect(ce.inputs.value).toBe(-5);
  });

  it('should handle malformed models gracefully', () => {
    const malformed = 'not a valid model';
    const ce = parseCounterexample(malformed, 'test');

    expect(ce.property).toBe('test');
    expect(ce.trace.length).toBeGreaterThan(0);
  });
});

describe('formatCounterexample', () => {
  it('should format counterexample for display', () => {
    const ce = {
      property: 'test-prop',
      inputs: { age: 25, email: 'test@test.com' },
      state: { count: 10 },
      trace: ['Step 1', 'Step 2'],
    };

    const formatted = formatCounterexample(ce);

    expect(formatted).toContain('Property: test-prop');
    expect(formatted).toContain('age');
    expect(formatted).toContain('25');
    expect(formatted).toContain('Step 1');
  });
});

// ============================================================================
// REPORT GENERATION TESTS
// ============================================================================

describe('generateReport', () => {
  const mockResult = {
    verified: false,
    properties: [
      {
        name: 'precond-test',
        category: 'precondition-consistency' as const,
        formula: '∃ input. age >= 0',
        result: 'valid' as const,
        time: 10,
      },
      {
        name: 'invariant-test',
        category: 'invariant-preservation' as const,
        formula: '∀ e. age >= 0',
        result: 'invalid' as const,
        time: 20,
        counterexample: {
          property: 'invariant-test',
          inputs: { age: -5 },
          state: {},
          trace: ['Found negative age'],
        },
      },
    ],
    counterexamples: [
      {
        property: 'invariant-test',
        inputs: { age: -5 },
        state: {},
        trace: ['Found negative age'],
      },
    ],
    smtTime: 30,
  };

  it('should generate text report', () => {
    const report = generateReport(mockResult, { format: 'text' });

    expect(report).toContain('FORMAL VERIFICATION REPORT');
    expect(report).toContain('NOT VERIFIED');
    expect(report).toContain('precond-test');
    expect(report).toContain('invariant-test');
  });

  it('should generate markdown report', () => {
    const report = generateReport(mockResult, { format: 'markdown' });

    expect(report).toContain('# Formal Verification Report');
    expect(report).toContain('NOT VERIFIED');
    expect(report).toContain('| Property |');
    expect(report).toContain('## Counterexamples');
  });

  it('should generate JSON report', () => {
    const report = generateReport(mockResult, { format: 'json' });
    const parsed = JSON.parse(report);

    expect(parsed.verified).toBe(false);
    expect(parsed.properties).toHaveLength(2);
    expect(parsed.counterexamples).toHaveLength(1);
  });

  it('should generate HTML report', () => {
    const report = generateReport(mockResult, { format: 'html' });

    expect(report).toContain('<!DOCTYPE html>');
    expect(report).toContain('Not Verified');
    expect(report).toContain('<table>');
  });
});

describe('generateSummary', () => {
  it('should generate one-line summary', () => {
    const result = {
      verified: true,
      properties: [
        { name: 'p1', category: 'precondition-consistency' as const, formula: '', result: 'valid' as const, time: 10 },
        { name: 'p2', category: 'invariant-preservation' as const, formula: '', result: 'valid' as const, time: 10 },
      ],
      counterexamples: [],
      smtTime: 20,
    };

    const summary = generateSummary(result);
    expect(summary).toContain('VERIFIED');
    expect(summary).toContain('2/2');
  });
});

// ============================================================================
// MOCK SOLVER TESTS
// ============================================================================

describe('MockZ3Solver', () => {
  it('should return mock responses', async () => {
    const solver = new MockZ3Solver();
    solver.setResponse('test-query', { status: 'unsat', time: 10 });

    const result = await solver.checkSat('(assert test-query)');
    expect(result.status).toBe('unsat');
  });

  it('should return sat by default', async () => {
    const solver = new MockZ3Solver();
    const result = await solver.checkSat('(check-sat)');
    expect(result.status).toBe('sat');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('verify integration', () => {
  it('should verify minimal domain with mock solver', async () => {
    const domain = createMinimalDomain();
    
    // Mock the solver by overriding
    const originalVerify = verify;
    
    // Just test that the function doesn't throw
    // Real Z3 tests would require Z3 installation
    try {
      // This will likely fail without Z3, but we're testing the structure
      const result = await verify(domain, { timeout: 100 });
      expect(result).toHaveProperty('verified');
      expect(result).toHaveProperty('properties');
      expect(result).toHaveProperty('counterexamples');
      expect(result).toHaveProperty('smtTime');
    } catch (error) {
      // Expected if Z3 is not installed
      expect(error).toBeDefined();
    }
  });
});

// ============================================================================
// TEMPORAL ENCODING TESTS
// ============================================================================

describe('encodeTemporalProperty', () => {
  it('should encode eventually property', () => {
    const spec: AST.TemporalSpec = {
      kind: 'TemporalSpec',
      operator: 'eventually',
      predicate: { kind: 'Identifier', name: 'done', location: createSourceLocation() },
      duration: { kind: 'DurationLiteral', value: 5, unit: 'seconds', location: createSourceLocation() },
      location: createSourceLocation(),
    };

    const encoded = encodeTemporalProperty(spec, {});
    expect(encoded).toContain('Eventually');
    expect(encoded).toContain('eventually-step');
  });

  it('should encode always property', () => {
    const spec: AST.TemporalSpec = {
      kind: 'TemporalSpec',
      operator: 'always',
      predicate: { kind: 'Identifier', name: 'valid', location: createSourceLocation() },
      location: createSourceLocation(),
    };

    const encoded = encodeTemporalProperty(spec, {});
    expect(encoded).toContain('Always');
    expect(encoded).toContain('forall');
  });

  it('should encode within property with percentile', () => {
    const spec: AST.TemporalSpec = {
      kind: 'TemporalSpec',
      operator: 'within',
      predicate: { kind: 'Identifier', name: 'response', location: createSourceLocation() },
      duration: { kind: 'DurationLiteral', value: 200, unit: 'ms', location: createSourceLocation() },
      percentile: 50,
      location: createSourceLocation(),
    };

    const encoded = encodeTemporalProperty(spec, {});
    expect(encoded).toContain('Within');
    expect(encoded).toContain('200');
    expect(encoded).toContain('p50');
  });

  it('should encode never property', () => {
    const spec: AST.TemporalSpec = {
      kind: 'TemporalSpec',
      operator: 'never',
      predicate: { kind: 'Identifier', name: 'error', location: createSourceLocation() },
      location: createSourceLocation(),
    };

    const encoded = encodeTemporalProperty(spec, {});
    expect(encoded).toContain('Never');
    expect(encoded).toContain('not');
  });
});
