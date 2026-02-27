// ============================================================================
// Executable Test Generator - Integration Tests
// Proves that generated tests actually fail when contracts are violated
// ============================================================================

import { describe, it, expect } from 'vitest';
import { ExecutableTestGenerator } from '../src/executable/generator';
import { TypeScriptAdapter } from '../src/executable/adapters/typescript';
import { GoAdapter } from '../src/executable/adapters/go';
import { PythonAdapter } from '../src/executable/adapters/python';
import {
  assertPostcondition,
  assertPrecondition,
  bindToImplementation,
  createTestBinding,
  PostconditionViolationError,
  PreconditionViolationError,
} from '../src/executable/runtime';
import type * as AST from '@isl-lang/parser';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockDomain(name: string, behaviors: AST.Behavior[]): AST.Domain {
  return {
    kind: 'Domain',
    name: { kind: 'Identifier', name, location: mockLocation() },
    version: { kind: 'StringLiteral', value: '1.0.0', location: mockLocation() },
    imports: [],
    types: [],
    entities: [
      {
        kind: 'Entity',
        name: { kind: 'Identifier', name: 'User', location: mockLocation() },
        fields: [
          createField('id', 'UUID'),
          createField('email', 'String'),
          createField('active', 'Boolean'),
        ],
        invariants: [],
        location: mockLocation(),
      },
    ],
    behaviors,
    invariants: [],
    policies: [],
    views: [],
    scenarios: [],
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
  } = {}
): AST.Behavior {
  return {
    kind: 'Behavior',
    name: { kind: 'Identifier', name, location: mockLocation() },
    description: { kind: 'StringLiteral', value: `${name} behavior`, location: mockLocation() },
    input: {
      kind: 'InputSpec',
      fields: [
        createField('email', 'String'),
        createField('password', 'String'),
      ],
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
    invariants: [],
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

function mockLocation(): AST.SourceLocation {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 1 };
}

function createPostconditionBlock(
  condition: 'success' | 'any_error',
  predicates: AST.Expression[]
): AST.PostconditionBlock {
  return {
    kind: 'PostconditionBlock',
    condition,
    predicates,
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

function createResultExpr(property?: string): AST.ResultExpr {
  return {
    kind: 'ResultExpr',
    property: property ? { kind: 'Identifier', name: property, location: mockLocation() } : undefined,
    location: mockLocation(),
  };
}

function createIdentifier(name: string): AST.Identifier {
  return { kind: 'Identifier', name, location: mockLocation() };
}

function createBooleanLiteral(value: boolean): AST.BooleanLiteral {
  return { kind: 'BooleanLiteral', value, location: mockLocation() };
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('ExecutableTestGenerator', () => {
  describe('generates executable tests', () => {
    it('should generate TypeScript test files', () => {
      const behavior = createMockBehavior('CreateUser', {
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(
              createResultExpr('id'),
              '!=',
              { kind: 'NullLiteral', location: mockLocation() }
            ),
          ]),
        ],
      });
      const domain = createMockDomain('Auth', [behavior]);

      const generator = new ExecutableTestGenerator({
        language: 'typescript',
        framework: 'vitest',
        outputDir: './generated-tests',
        implementationPath: '../src',
      });

      const result = generator.generate(domain);

      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('CreateUser.test.ts'))).toBe(true);
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].behaviorName).toBe('CreateUser');
    });

    it('should generate Go test files', () => {
      const behavior = createMockBehavior('CreateUser');
      const domain = createMockDomain('Auth', [behavior]);

      const generator = new ExecutableTestGenerator({
        language: 'go',
        framework: 'go-test',
        outputDir: './generated-tests',
        implementationPath: 'github.com/example/auth',
      });

      const result = generator.generate(domain);

      expect(result.success).toBe(true);
      expect(result.files.some(f => f.path.endsWith('.go'))).toBe(true);
    });

    it('should generate Python test files', () => {
      const behavior = createMockBehavior('CreateUser');
      const domain = createMockDomain('Auth', [behavior]);

      const generator = new ExecutableTestGenerator({
        language: 'python',
        framework: 'pytest',
        outputDir: './generated-tests',
        implementationPath: 'auth',
      });

      const result = generator.generate(domain);

      expect(result.success).toBe(true);
      expect(result.files.some(f => f.path.endsWith('.py'))).toBe(true);
    });
  });

  describe('binds postconditions to assertions', () => {
    it('should create postcondition bindings', () => {
      const behavior = createMockBehavior('CreateUser', {
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(
              createResultExpr('success'),
              '==',
              createBooleanLiteral(true)
            ),
          ]),
        ],
      });
      const domain = createMockDomain('Auth', [behavior]);

      const generator = new ExecutableTestGenerator({
        language: 'typescript',
        framework: 'vitest',
        outputDir: './generated-tests',
        implementationPath: '../src',
      });

      const result = generator.generate(domain);
      const binding = result.bindings[0];

      expect(binding.postconditions.length).toBe(1);
      expect(binding.postconditions[0].condition).toBe('success');
      expect(binding.postconditions[0].failsOnViolation).toBe(true);
    });
  });

  describe('generates violation tests', () => {
    it('should generate tests that verify assertions fail when violated', () => {
      const behavior = createMockBehavior('CreateUser', {
        postconditions: [
          createPostconditionBlock('success', [
            createBinaryExpr(
              createResultExpr('id'),
              '!=',
              { kind: 'NullLiteral', location: mockLocation() }
            ),
          ]),
        ],
      });
      const domain = createMockDomain('Auth', [behavior]);

      const generator = new ExecutableTestGenerator({
        language: 'typescript',
        framework: 'vitest',
        outputDir: './generated-tests',
        implementationPath: '../src',
        generateViolationTests: true,
      });

      const result = generator.generate(domain);

      const violationFile = result.files.find(f => f.path.includes('violations'));
      expect(violationFile).toBeDefined();
      expect(violationFile?.content).toContain('VIOLATION TEST');
      expect(violationFile?.content).toContain('toThrow');
    });
  });
});

// ============================================================================
// RUNTIME ASSERTION TESTS - PROVES ASSERTIONS FAIL ON VIOLATION
// ============================================================================

describe('Runtime Assertions', () => {
  describe('assertPostcondition', () => {
    it('should pass when condition is true', () => {
      expect(() => {
        assertPostcondition(true, 'result.id != null', {
          input: { email: 'test@example.com' },
          result: { success: true, id: '123' },
        });
      }).not.toThrow();
    });

    it('should FAIL when condition is false', () => {
      expect(() => {
        assertPostcondition(false, 'result.id != null', {
          input: { email: 'test@example.com' },
          result: { success: true, id: null },
        });
      }).toThrow(PostconditionViolationError);
    });

    it('should include context in error message', () => {
      try {
        assertPostcondition(false, 'result.success == true', {
          input: { email: 'bad@example.com' },
          result: { success: false, error: 'ValidationError' },
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(PostconditionViolationError);
        expect((error as Error).message).toContain('Postcondition violated');
        expect((error as Error).message).toContain('result.success == true');
        expect((error as Error).message).toContain('bad@example.com');
      }
    });
  });

  describe('assertPrecondition', () => {
    it('should pass when condition is true', () => {
      expect(() => {
        assertPrecondition(true, 'input.email != ""', { email: 'test@example.com' });
      }).not.toThrow();
    });

    it('should FAIL when condition is false', () => {
      expect(() => {
        assertPrecondition(false, 'input.email != ""', { email: '' });
      }).toThrow(PreconditionViolationError);
    });
  });
});

// ============================================================================
// BOUND IMPLEMENTATION TESTS
// ============================================================================

describe('bindToImplementation', () => {
  it('should bind implementation and allow execution', async () => {
    const mockImpl = async (input: { email: string }) => ({
      success: true,
      id: 'user-123',
    });

    const binding = createTestBinding('CreateUser', '../src');
    const bound = bindToImplementation(mockImpl, binding);

    const result = await bound.execute({ email: 'test@example.com' });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ success: true, id: 'user-123' });
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should capture errors from implementation', async () => {
    const mockImpl = async () => {
      throw new Error('Database connection failed');
    };

    const binding = createTestBinding('CreateUser', '../src');
    const bound = bindToImplementation(mockImpl, binding);

    const result = await bound.execute({ email: 'test@example.com' });

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Database connection failed');
  });

  it('should capture state for old() expressions', async () => {
    const mockImpl = async (input: { email: string }) => ({
      success: true,
      id: 'user-123',
    });

    const binding = createTestBinding('CreateUser', '../src');
    const bound = bindToImplementation(mockImpl, binding);

    const entityStore = {
      User: [{ id: 'existing-1', email: 'existing@example.com' }],
    };

    const result = await bound.execute({ email: 'test@example.com' }, entityStore);

    expect(result.success).toBe(true);
    expect(result.oldState).not.toBeNull();
    expect(result.oldState?.entities.get('User')).toHaveLength(1);
  });
});

// ============================================================================
// LANGUAGE ADAPTER TESTS
// ============================================================================

describe('Language Adapters', () => {
  describe('TypeScriptAdapter', () => {
    it('should compile binary expressions correctly', () => {
      const adapter = new TypeScriptAdapter('vitest');
      const context = {
        entityNames: ['User'],
        inOldExpr: false,
        variables: new Map<string, string>(),
        imports: new Set<string>(),
      };

      const expr: AST.BinaryExpr = createBinaryExpr(
        createResultExpr('success'),
        '==',
        createBooleanLiteral(true)
      );

      const compiled = adapter.compileExpression(expr, context);
      expect(compiled).toBe('(result.success === true)');
    });

    it('should handle implies operator', () => {
      const adapter = new TypeScriptAdapter('vitest');
      const context = {
        entityNames: [],
        inOldExpr: false,
        variables: new Map<string, string>(),
        imports: new Set<string>(),
      };

      const expr: AST.BinaryExpr = {
        kind: 'BinaryExpr',
        operator: 'implies',
        left: createIdentifier('a'),
        right: createIdentifier('b'),
        location: mockLocation(),
      };

      const compiled = adapter.compileExpression(expr, context);
      expect(compiled).toBe('(!a || b)');
    });
  });

  describe('GoAdapter', () => {
    it('should compile expressions to Go syntax', () => {
      const adapter = new GoAdapter();
      const context = {
        entityNames: ['User'],
        inOldExpr: false,
        variables: new Map<string, string>(),
        imports: new Set<string>(),
      };

      const expr = createBinaryExpr(
        createResultExpr('Success'),
        '==',
        createBooleanLiteral(true)
      );

      const compiled = adapter.compileExpression(expr, context);
      expect(compiled).toContain('result.Success');
      expect(compiled).toContain('true');
    });
  });

  describe('PythonAdapter', () => {
    it('should compile expressions to Python syntax', () => {
      const adapter = new PythonAdapter('pytest');
      const context = {
        entityNames: ['User'],
        inOldExpr: false,
        variables: new Map<string, string>(),
        imports: new Set<string>(),
      };

      const expr = createBinaryExpr(
        createResultExpr('success'),
        'and',
        createBooleanLiteral(true)
      );

      const compiled = adapter.compileExpression(expr, context);
      expect(compiled).toContain('result.success');
      expect(compiled).toContain('and');
      expect(compiled).toContain('True');
    });

    it('should handle quantifiers', () => {
      const adapter = new PythonAdapter('pytest');
      const context = {
        entityNames: [],
        inOldExpr: false,
        variables: new Map<string, string>(),
        imports: new Set<string>(),
      };

      const expr: AST.QuantifierExpr = {
        kind: 'QuantifierExpr',
        quantifier: 'all',
        variable: createIdentifier('item'),
        collection: createIdentifier('items'),
        predicate: createBinaryExpr(
          { kind: 'MemberExpr', object: createIdentifier('item'), property: createIdentifier('valid'), location: mockLocation() },
          '==',
          createBooleanLiteral(true)
        ),
        location: mockLocation(),
      };

      const compiled = adapter.compileExpression(expr, context);
      expect(compiled).toContain('all(');
      expect(compiled).toContain('for item in items');
    });
  });
});
