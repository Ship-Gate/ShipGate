// ============================================================================
// Test Generator Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { generate } from '../src/generator';
import { compileExpression, compileAssertion } from '../src/expression-compiler';
import { generatePreconditionTests } from '../src/preconditions';
import { generatePostconditionTests } from '../src/postconditions';
import { generateScenarioTests } from '../src/scenarios';
import { generateChaosTests } from '../src/chaos';
import type * as AST from '../../../master_contracts/ast';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMinimalDomain = (): AST.Domain => ({
  kind: 'Domain',
  name: { kind: 'Identifier', name: 'TestDomain', location: loc() },
  version: { kind: 'StringLiteral', value: '1.0.0', location: loc() },
  imports: [],
  types: [],
  entities: [],
  behaviors: [],
  invariants: [],
  policies: [],
  views: [],
  scenarios: [],
  chaos: [],
  location: loc(),
});

const createBehavior = (name: string): AST.Behavior => ({
  kind: 'Behavior',
  name: { kind: 'Identifier', name, location: loc() },
  input: {
    kind: 'InputSpec',
    fields: [
      {
        kind: 'Field',
        name: { kind: 'Identifier', name: 'email', location: loc() },
        type: { kind: 'PrimitiveType', name: 'String', location: loc() },
        optional: false,
        annotations: [],
        location: loc(),
      },
    ],
    location: loc(),
  },
  output: {
    kind: 'OutputSpec',
    success: { kind: 'PrimitiveType', name: 'Boolean', location: loc() },
    errors: [
      {
        kind: 'ErrorSpec',
        name: { kind: 'Identifier', name: 'INVALID_INPUT', location: loc() },
        when: { kind: 'StringLiteral', value: 'Input is invalid', location: loc() },
        retriable: true,
        location: loc(),
      },
    ],
    location: loc(),
  },
  preconditions: [
    {
      kind: 'MemberExpr',
      object: {
        kind: 'MemberExpr',
        object: { kind: 'Identifier', name: 'input', location: loc() },
        property: { kind: 'Identifier', name: 'email', location: loc() },
        location: loc(),
      },
      property: { kind: 'Identifier', name: 'is_valid', location: loc() },
      location: loc(),
    } as AST.MemberExpr,
  ],
  postconditions: [
    {
      kind: 'PostconditionBlock',
      condition: 'success',
      predicates: [
        {
          kind: 'BinaryExpr',
          operator: '==',
          left: { kind: 'ResultExpr', location: loc() } as AST.ResultExpr,
          right: { kind: 'BooleanLiteral', value: true, location: loc() },
          location: loc(),
        } as AST.BinaryExpr,
      ],
      location: loc(),
    },
  ],
  invariants: [],
  temporal: [],
  security: [],
  compliance: [],
  location: loc(),
});

const createScenarioBlock = (behaviorName: string): AST.ScenarioBlock => ({
  kind: 'ScenarioBlock',
  behaviorName: { kind: 'Identifier', name: behaviorName, location: loc() },
  scenarios: [
    {
      kind: 'Scenario',
      name: { kind: 'StringLiteral', value: 'successful operation', location: loc() },
      given: [
        {
          kind: 'AssignmentStmt',
          target: { kind: 'Identifier', name: 'initialCount', location: loc() },
          value: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc() },
          location: loc(),
        },
      ],
      when: [
        {
          kind: 'CallStmt',
          target: { kind: 'Identifier', name: 'result', location: loc() },
          call: {
            kind: 'CallExpr',
            callee: { kind: 'Identifier', name: behaviorName, location: loc() },
            arguments: [
              {
                kind: 'MapExpr',
                entries: [
                  {
                    kind: 'MapEntry',
                    key: { kind: 'Identifier', name: 'email', location: loc() },
                    value: { kind: 'StringLiteral', value: 'test@example.com', location: loc() },
                    location: loc(),
                  },
                ],
                location: loc(),
              },
            ],
            location: loc(),
          },
          location: loc(),
        },
      ],
      then: [
        {
          kind: 'BinaryExpr',
          operator: '==',
          left: { kind: 'Identifier', name: 'result', location: loc() },
          right: { kind: 'Identifier', name: 'success', location: loc() },
          location: loc(),
        } as AST.BinaryExpr,
      ],
      location: loc(),
    },
  ],
  location: loc(),
});

const createChaosBlock = (behaviorName: string): AST.ChaosBlock => ({
  kind: 'ChaosBlock',
  behaviorName: { kind: 'Identifier', name: behaviorName, location: loc() },
  scenarios: [
    {
      kind: 'ChaosScenario',
      name: { kind: 'StringLiteral', value: 'database failure', location: loc() },
      inject: [
        {
          kind: 'Injection',
          type: 'database_failure',
          target: { kind: 'Identifier', name: 'UserRepository', location: loc() },
          parameters: [
            {
              kind: 'InjectionParam',
              name: { kind: 'Identifier', name: 'mode', location: loc() },
              value: { kind: 'Identifier', name: 'UNAVAILABLE', location: loc() },
              location: loc(),
            },
          ],
          location: loc(),
        },
      ],
      when: [
        {
          kind: 'CallStmt',
          target: { kind: 'Identifier', name: 'result', location: loc() },
          call: {
            kind: 'CallExpr',
            callee: { kind: 'Identifier', name: behaviorName, location: loc() },
            arguments: [],
            location: loc(),
          },
          location: loc(),
        },
      ],
      then: [
        {
          kind: 'BinaryExpr',
          operator: '==',
          left: { kind: 'Identifier', name: 'result', location: loc() },
          right: { kind: 'Identifier', name: 'error', location: loc() },
          location: loc(),
        } as AST.BinaryExpr,
      ],
      location: loc(),
    },
  ],
  location: loc(),
});

function loc(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

// ============================================================================
// Generator Tests
// ============================================================================

describe('Test Generator', () => {
  describe('generate()', () => {
    it('should generate test files for behaviors', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior('Login')];

      const files = generate(domain, { framework: 'vitest' });

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.path.includes('Login.test.ts'))).toBe(true);
    });

    it('should generate scenario test files', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior('Login')];
      domain.scenarios = [createScenarioBlock('Login')];

      const files = generate(domain, { framework: 'vitest' });

      expect(files.some((f) => f.path.includes('Login.scenarios.test.ts'))).toBe(true);
    });

    it('should generate chaos test files when enabled', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior('Login')];
      domain.chaos = [createChaosBlock('Login')];

      const files = generate(domain, { framework: 'vitest', includeChaosTests: true });

      expect(files.some((f) => f.path.includes('Login.chaos.test.ts'))).toBe(true);
    });

    it('should skip chaos tests when disabled', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior('Login')];
      domain.chaos = [createChaosBlock('Login')];

      const files = generate(domain, { framework: 'vitest', includeChaosTests: false });

      expect(files.some((f) => f.path.includes('.chaos.test.ts'))).toBe(false);
    });

    it('should generate helper files when enabled', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior('Login')];

      const files = generate(domain, { framework: 'vitest', includeHelpers: true });

      expect(files.some((f) => f.path.includes('helpers/chaos-controller.ts'))).toBe(true);
      expect(files.some((f) => f.path.includes('helpers/test-utils.ts'))).toBe(true);
    });

    it('should generate Jest config for Jest framework', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior('Login')];

      const files = generate(domain, { framework: 'jest' });

      expect(files.some((f) => f.path.includes('jest.config.js'))).toBe(true);
    });

    it('should generate Vitest config for Vitest framework', () => {
      const domain = createMinimalDomain();
      domain.behaviors = [createBehavior('Login')];

      const files = generate(domain, { framework: 'vitest' });

      expect(files.some((f) => f.path.includes('vitest.config.ts'))).toBe(true);
    });
  });
});

// ============================================================================
// Expression Compiler Tests
// ============================================================================

describe('Expression Compiler', () => {
  describe('compileExpression()', () => {
    it('should compile identifiers', () => {
      const expr: AST.Identifier = { kind: 'Identifier', name: 'foo', location: loc() };
      expect(compileExpression(expr)).toBe('foo');
    });

    it('should compile string literals', () => {
      const expr: AST.StringLiteral = { kind: 'StringLiteral', value: 'hello', location: loc() };
      expect(compileExpression(expr)).toBe('"hello"');
    });

    it('should compile number literals', () => {
      const expr: AST.NumberLiteral = { kind: 'NumberLiteral', value: 42, isFloat: false, location: loc() };
      expect(compileExpression(expr)).toBe('42');
    });

    it('should compile boolean literals', () => {
      const expr: AST.BooleanLiteral = { kind: 'BooleanLiteral', value: true, location: loc() };
      expect(compileExpression(expr)).toBe('true');
    });

    it('should compile binary expressions', () => {
      const expr: AST.BinaryExpr = {
        kind: 'BinaryExpr',
        operator: '==',
        left: { kind: 'Identifier', name: 'a', location: loc() },
        right: { kind: 'NumberLiteral', value: 1, isFloat: false, location: loc() },
        location: loc(),
      };
      expect(compileExpression(expr)).toBe('(a === 1)');
    });

    it('should compile member expressions', () => {
      const expr: AST.MemberExpr = {
        kind: 'MemberExpr',
        object: { kind: 'Identifier', name: 'user', location: loc() },
        property: { kind: 'Identifier', name: 'email', location: loc() },
        location: loc(),
      };
      expect(compileExpression(expr)).toBe('user.email');
    });

    it('should compile call expressions', () => {
      const expr: AST.CallExpr = {
        kind: 'CallExpr',
        callee: { kind: 'Identifier', name: 'validate', location: loc() },
        arguments: [{ kind: 'Identifier', name: 'input', location: loc() }],
        location: loc(),
      };
      expect(compileExpression(expr)).toBe('validate(input)');
    });

    it('should compile quantifier expressions', () => {
      const expr: AST.QuantifierExpr = {
        kind: 'QuantifierExpr',
        quantifier: 'all',
        variable: { kind: 'Identifier', name: 'item', location: loc() },
        collection: { kind: 'Identifier', name: 'items', location: loc() },
        predicate: {
          kind: 'BinaryExpr',
          operator: '>',
          left: { kind: 'Identifier', name: 'item', location: loc() },
          right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc() },
          location: loc(),
        },
        location: loc(),
      };
      expect(compileExpression(expr)).toBe('items.every((item) => (item > 0))');
    });
  });

  describe('compileAssertion()', () => {
    it('should generate equality assertion', () => {
      const expr: AST.BinaryExpr = {
        kind: 'BinaryExpr',
        operator: '==',
        left: { kind: 'Identifier', name: 'result', location: loc() },
        right: { kind: 'NumberLiteral', value: 42, isFloat: false, location: loc() },
        location: loc(),
      };
      expect(compileAssertion(expr, 'vitest')).toBe('expect(result).toEqual(42);');
    });

    it('should generate inequality assertion', () => {
      const expr: AST.BinaryExpr = {
        kind: 'BinaryExpr',
        operator: '!=',
        left: { kind: 'Identifier', name: 'result', location: loc() },
        right: { kind: 'NullLiteral', location: loc() },
        location: loc(),
      };
      expect(compileAssertion(expr, 'vitest')).toBe('expect(result).not.toEqual(null);');
    });

    it('should generate comparison assertions', () => {
      const expr: AST.BinaryExpr = {
        kind: 'BinaryExpr',
        operator: '>',
        left: { kind: 'Identifier', name: 'count', location: loc() },
        right: { kind: 'NumberLiteral', value: 0, isFloat: false, location: loc() },
        location: loc(),
      };
      expect(compileAssertion(expr, 'vitest')).toBe('expect(count).toBeGreaterThan(0);');
    });
  });
});

// ============================================================================
// Precondition Tests
// ============================================================================

describe('Precondition Generator', () => {
  it('should generate tests for preconditions', () => {
    const behavior = createBehavior('Login');
    const tests = generatePreconditionTests(behavior, 'vitest');

    expect(tests.length).toBe(1);
    expect(tests[0].name).toContain('validate');
  });
});

// ============================================================================
// Postcondition Tests
// ============================================================================

describe('Postcondition Generator', () => {
  it('should generate tests for postconditions', () => {
    const behavior = createBehavior('Login');
    const tests = generatePostconditionTests(behavior, 'vitest');

    expect(tests.length).toBe(1);
    expect(tests[0].condition).toBe('success');
  });
});

// ============================================================================
// Scenario Tests
// ============================================================================

describe('Scenario Generator', () => {
  it('should generate tests for scenarios', () => {
    const scenarioBlock = createScenarioBlock('Login');
    const testCode = generateScenarioTests(scenarioBlock, 'vitest');

    expect(testCode).toContain("describe('Login Scenarios'");
    expect(testCode).toContain("it('successful operation'");
    expect(testCode).toContain('// Given');
    expect(testCode).toContain('// When');
    expect(testCode).toContain('// Then');
  });
});

// ============================================================================
// Chaos Tests
// ============================================================================

describe('Chaos Generator', () => {
  it('should generate tests for chaos scenarios', () => {
    const chaosBlock = createChaosBlock('Login');
    const testCode = generateChaosTests(chaosBlock, 'vitest');

    expect(testCode).toContain("describe('Login Chaos Tests'");
    expect(testCode).toContain("it('database failure'");
    expect(testCode).toContain('chaosController.injectDatabaseFailure');
  });
});
