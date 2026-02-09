// ============================================================================
// Unit Test: Behavior → Test Case List
// Tests that behaviors are correctly converted to test cases
// ============================================================================

import { describe, it, expect } from 'vitest';
import { generateTests } from '../src/generator';
import type * as AST from '@isl-lang/parser';

// ============================================================================
// TEST HELPERS
// ============================================================================

function mockLocation(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

function createMockDomain(
  name: string,
  behaviors: AST.Behavior[],
  entities: AST.Entity[] = [],
  scenarios: AST.ScenarioBlock[] = []
): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name, location: mockLocation() },
    version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
    imports: [],
    types: [],
    entities,
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios,
    chaos: [],
    location: mockLocation(),
  };
}

function createMockBehavior(
  name: string,
  options: {
    preconditions?: AST.Expression[];
    postconditions?: AST.PostconditionBlock[];
    errors?: AST.ErrorSpec[];
    inputFields?: AST.Field[];
    invariants?: AST.Expression[];
  } = {}
): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name, location: mockLocation() },
    description: { kind: 'StringLiteral', value: `${name} behavior`, location: mockLocation() },
    input: {
      kind: 'InputSpec',
      fields: options.inputFields || [],
      location: mockLocation(),
    },
    output: {
      kind: 'OutputSpec',
      success: { kind: 'PrimitiveType', name: 'Boolean', location: mockLocation() },
      errors: options.errors || [],
      location: mockLocation(),
    },
    preconditions: options.preconditions || [],
    postconditions: options.postconditions || [],
    invariants: options.invariants || [],
    temporal: [],
    security: [],
    compliance: [],
    location: mockLocation(),
  };
}

function createField(name: string, type: AST.PrimitiveType['name']): AST.Field {
  return {
    kind: 'Field',
    name: { kind: 'Identifier', name, location: mockLocation() },
    type: { kind: 'PrimitiveType', name: type, location: mockLocation() },
    optional: false,
    annotations: [],
    location: mockLocation(),
  };
}

function createBinaryExpr(
  left: AST.Expression,
  op: AST.BinaryOperator,
  right: AST.Expression
): AST.BinaryExpr {
  return {
    kind: 'BinaryExpr',
    operator: op,
    left,
    right,
    location: mockLocation(),
  };
}

function createInputExpr(property: string): AST.InputExpr {
  return {
    kind: 'InputExpr',
    property: { kind: 'Identifier', name: property, location: mockLocation() },
    location: mockLocation(),
  };
}

function createNumberLiteral(value: number): AST.NumberLiteral {
  return {
    kind: 'NumberLiteral',
    value,
    isFloat: value % 1 !== 0,
    location: mockLocation(),
  };
}

function createPostconditionBlock(
  condition: 'success' | 'any_error' | string,
  predicates: AST.Expression[]
): AST.PostconditionBlock {
  return {
    kind: 'PostconditionBlock',
    condition: condition === 'success' || condition === 'any_error' 
      ? condition 
      : { kind: 'Identifier', name: condition, location: mockLocation() },
    predicates,
    location: mockLocation(),
  };
}

function createErrorSpec(name: string, when: string, retriable: boolean): AST.ErrorSpec {
  return {
    kind: 'ErrorSpec',
    name: { kind: 'Identifier', name, location: mockLocation() },
    when: { kind: 'StringLiteral', value: when, location: mockLocation() },
    retriable,
    location: mockLocation(),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Behavior → Test Case List', () => {
  it('should generate test cases for behaviors with preconditions', () => {
    const behavior = createMockBehavior('CreateUser', {
      inputFields: [
        createField('email', 'String'),
        createField('name', 'String'),
      ],
      preconditions: [
        createBinaryExpr(
          createInputExpr('email'),
          '!=',
          { kind: 'NullLiteral', location: mockLocation() }
        ),
        createBinaryExpr(
          createInputExpr('name'),
          '!=',
          { kind: 'NullLiteral', location: mockLocation() }
        ),
      ],
    });

    const domain = createMockDomain('Test', [behavior]);
    const result = generateTests(domain, { framework: 'vitest' });

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
    
    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('Preconditions');
  });

  it('should generate test cases for behaviors with postconditions', () => {
    const resultExpr: AST.ResultExpr = {
      kind: 'ResultExpr',
      property: { kind: 'Identifier', name: 'id', location: mockLocation() },
      location: mockLocation(),
    };

    const behavior = createMockBehavior('CreateUser', {
      inputFields: [createField('email', 'String')],
      postconditions: [
        createPostconditionBlock('success', [
          createBinaryExpr(
            resultExpr,
            '!=',
            { kind: 'NullLiteral', location: mockLocation() }
          ),
        ]),
      ],
    });

    const domain = createMockDomain('Test', [behavior]);
    const result = generateTests(domain, { framework: 'vitest' });

    expect(result.success).toBe(true);
    
    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('Postconditions');
  });

  it('should generate test cases for behaviors with error specs', () => {
    const behavior = createMockBehavior('CreateUser', {
      inputFields: [createField('email', 'String')],
      errors: [
        createErrorSpec('INVALID_EMAIL', 'Email format is invalid', false),
        createErrorSpec('DUPLICATE_EMAIL', 'Email already exists', false),
      ],
    });

    const domain = createMockDomain('Test', [behavior]);
    const result = generateTests(domain, { framework: 'vitest' });

    expect(result.success).toBe(true);
    
    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('Error Cases');
  });

  it('should generate test cases for behaviors with scenarios', () => {
    const behavior = createMockBehavior('CreateUser', {
      inputFields: [createField('email', 'String')],
    });

    const scenarioBlock: AST.ScenarioBlock = {
      kind: 'ScenarioBlock',
      behaviorName: { kind: 'Identifier', name: 'CreateUser', location: mockLocation() },
      scenarios: [
        {
          kind: 'Scenario',
          name: { kind: 'StringLiteral', value: 'successful user creation', location: mockLocation() },
          given: [],
          when: [
            {
              kind: 'AssignmentStmt',
              target: { kind: 'Identifier', name: 'result', location: mockLocation() },
              value: {
                kind: 'CallExpr',
                callee: { kind: 'Identifier', name: 'CreateUser', location: mockLocation() },
                arguments: [
                  {
                    kind: 'StringLiteral',
                    value: 'test@example.com',
                    location: mockLocation(),
                  },
                ],
                location: mockLocation(),
              },
              location: mockLocation(),
            },
          ],
          then: [
            {
              kind: 'BinaryExpr',
              operator: 'is',
              left: { kind: 'Identifier', name: 'result', location: mockLocation() },
              right: { kind: 'Identifier', name: 'success', location: mockLocation() },
              location: mockLocation(),
            },
          ],
          location: mockLocation(),
        },
      ],
      location: mockLocation(),
    };

    const domain = createMockDomain('Test', [behavior], [], [scenarioBlock]);
    const result = generateTests(domain, { framework: 'vitest' });

    expect(result.success).toBe(true);
    
    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();
    expect(testFile!.content).toContain('Scenarios');
  });

  it('should generate deterministic test case ordering', () => {
    const behavior1 = createMockBehavior('BehaviorA', {
      inputFields: [createField('value', 'String')],
    });
    const behavior2 = createMockBehavior('BehaviorB', {
      inputFields: [createField('value', 'String')],
    });
    const behavior3 = createMockBehavior('BehaviorC', {
      inputFields: [createField('value', 'String')],
    });

    const domain = createMockDomain('Test', [behavior3, behavior1, behavior2]);
    const result1 = generateTests(domain, { framework: 'vitest' });
    const result2 = generateTests(domain, { framework: 'vitest' });

    // Both runs should produce the same file order
    const paths1 = result1.files.map(f => f.path).sort();
    const paths2 = result2.files.map(f => f.path).sort();
    
    expect(paths1).toEqual(paths2);
    
    // Test files should be in alphabetical order
    const testFiles1 = result1.files
      .filter(f => f.path.endsWith('.test.ts'))
      .map(f => f.path)
      .sort();
    const testFiles2 = result2.files
      .filter(f => f.path.endsWith('.test.ts'))
      .map(f => f.path)
      .sort();
    
    expect(testFiles1).toEqual(['BehaviorA.test.ts', 'BehaviorB.test.ts', 'BehaviorC.test.ts']);
    expect(testFiles2).toEqual(['BehaviorA.test.ts', 'BehaviorB.test.ts', 'BehaviorC.test.ts']);
  });

  it('should include property-based test stubs', () => {
    const behavior = createMockBehavior('CreateUser', {
      inputFields: [createField('email', 'String')],
    });

    const domain = createMockDomain('Test', [behavior]);
    const result = generateTests(domain, { framework: 'vitest' });

    expect(result.success).toBe(true);
    
    const testFile = result.files.find(f => f.path.includes('CreateUser.test.ts'));
    expect(testFile).toBeDefined();
    // Should contain PBT stub comment even if isl-pbt is not installed
    expect(testFile!.content).toContain('Property-Based');
  });
});
