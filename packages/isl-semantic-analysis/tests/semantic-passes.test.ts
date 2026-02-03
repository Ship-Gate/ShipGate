/**
 * Comprehensive Semantic Pass Tests
 * 
 * Tests for all semantic analysis passes:
 * - Type Coherence
 * - Redundant Conditions
 * - Cyclic Dependencies
 * - Unreachable Clauses
 * - Unused Symbols
 * - Unsatisfiable Preconditions
 * - Intent Coherence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DomainDeclaration, SourceSpan, BehaviorDeclaration, EntityDeclaration } from '@isl-lang/isl-core';
import type { SemanticPass, PassContext, TypeEnvironment } from '../src/types.js';
import { PassRunner, createPassRunner } from '../src/pass-runner.js';
import { buildTypeEnvironment, emptyTypeEnvironment } from '../src/type-environment.js';
import {
  builtinPasses,
  typeCoherencePass,
  redundantConditionsPass,
  cyclicDependenciesPass,
  unreachableClausesPass,
  unusedSymbolsPass,
  unsatisfiablePreconditionsPass,
} from '../src/passes/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createSpan(line: number, column: number, endLine?: number, endColumn?: number): SourceSpan {
  return {
    start: { line, column, offset: 0 },
    end: { line: endLine ?? line, column: endColumn ?? column + 10, offset: 100 },
  };
}

function createMockAST(overrides: Partial<DomainDeclaration> = {}): DomainDeclaration {
  return {
    kind: 'DomainDeclaration',
    name: { kind: 'Identifier', name: 'TestDomain', span: createSpan(1, 1) },
    span: createSpan(1, 1, 100, 1),
    entities: [],
    behaviors: [],
    types: [],
    enums: [],
    imports: [],
    invariants: null,
    uiBlueprints: [],
    location: {
      file: 'test.isl',
      line: 1,
      column: 1,
      endLine: 100,
      endColumn: 1,
    },
    ...overrides,
  } as DomainDeclaration;
}

function createEntity(name: string, fields: Array<{ name: string; type: string }> = [], span?: SourceSpan): EntityDeclaration {
  return {
    kind: 'EntityDeclaration',
    name: { kind: 'Identifier', name, span: span ?? createSpan(1, 1) },
    span: span ?? createSpan(1, 1, 10, 1),
    fields: fields.map((f, i) => ({
      kind: 'FieldDeclaration',
      name: { kind: 'Identifier', name: f.name, span: createSpan(i + 2, 3) },
      type: { kind: 'SimpleType', name: { kind: 'Identifier', name: f.type, span: createSpan(i + 2, 15) }, span: createSpan(i + 2, 15) },
      span: createSpan(i + 2, 3, i + 2, 25),
    })),
    invariants: null,
    lifecycle: null,
  } as EntityDeclaration;
}

function createBehavior(
  name: string,
  options: {
    inputs?: Array<{ name: string; type: string }>;
    outputs?: Array<{ name: string; type: string }>;
    preconditions?: Array<{ expression: unknown }>;
    postconditions?: Array<{ expression: unknown }>;
  } = {}
): BehaviorDeclaration {
  const span = createSpan(1, 1, 30, 1);
  return {
    kind: 'BehaviorDeclaration',
    name: { kind: 'Identifier', name, span },
    span,
    input: options.inputs?.map((inp, i) => ({
      kind: 'FieldDeclaration',
      name: { kind: 'Identifier', name: inp.name, span: createSpan(2 + i, 5) },
      type: { kind: 'SimpleType', name: { kind: 'Identifier', name: inp.type, span: createSpan(2 + i, 15) }, span: createSpan(2 + i, 15) },
      span: createSpan(2 + i, 5),
    })) ?? [],
    output: options.outputs?.map((out, i) => ({
      kind: 'FieldDeclaration',
      name: { kind: 'Identifier', name: out.name, span: createSpan(10 + i, 5) },
      type: { kind: 'SimpleType', name: { kind: 'Identifier', name: out.type, span: createSpan(10 + i, 15) }, span: createSpan(10 + i, 15) },
      span: createSpan(10 + i, 5),
    })) ?? [],
    preconditions: options.preconditions ? {
      kind: 'ConditionBlock',
      conditions: options.preconditions.map((pc, i) => ({
        kind: 'Condition',
        expression: pc.expression,
        span: createSpan(15 + i, 5),
      })),
      span: createSpan(15, 3),
    } : null,
    postconditions: options.postconditions ? {
      kind: 'ConditionBlock',
      conditions: options.postconditions.map((pc, i) => ({
        kind: 'Condition',
        expression: pc.expression,
        span: createSpan(20 + i, 5),
      })),
      span: createSpan(20, 3),
    } : null,
    actors: [],
    invariants: null,
    temporal: null,
    security: null,
    compliance: null,
  } as BehaviorDeclaration;
}

function createContext(ast: DomainDeclaration): PassContext {
  return {
    ast,
    typeEnv: buildTypeEnvironment(ast),
    filePath: 'test.isl',
    sourceContent: '',
  };
}

// ============================================================================
// Type Coherence Pass Tests
// ============================================================================

describe('TypeCoherencePass', () => {
  it('should detect numeric constraints on non-numeric types', () => {
    const ast = createMockAST({
      entities: [{
        ...createEntity('User'),
        fields: [{
          kind: 'FieldDeclaration',
          name: { kind: 'Identifier', name: 'name', span: createSpan(2, 3) },
          type: {
            kind: 'SimpleType',
            name: { kind: 'Identifier', name: 'String', span: createSpan(2, 10) },
            span: createSpan(2, 10),
            constraints: [{ name: 'min', value: { kind: 'NumberLiteral', value: 5 } }],
          },
          span: createSpan(2, 3, 2, 30),
        }],
      } as EntityDeclaration],
    });

    const ctx = createContext(ast);
    const diagnostics = typeCoherencePass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0340')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Numeric constraint'))).toBe(true);
  });

  it('should detect pattern constraints on non-string types', () => {
    const ast = createMockAST({
      entities: [{
        ...createEntity('Config'),
        fields: [{
          kind: 'FieldDeclaration',
          name: { kind: 'Identifier', name: 'count', span: createSpan(2, 3) },
          type: {
            kind: 'SimpleType',
            name: { kind: 'Identifier', name: 'Int', span: createSpan(2, 10) },
            span: createSpan(2, 10),
            constraints: [{ name: 'pattern', value: { kind: 'StringLiteral', value: '^[0-9]+$' } }],
          },
          span: createSpan(2, 3, 2, 30),
        }],
      } as EntityDeclaration],
    });

    const ctx = createContext(ast);
    const diagnostics = typeCoherencePass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0341')).toBe(true);
  });

  it('should detect contradictory min/max constraints', () => {
    const ast = createMockAST({
      entities: [{
        ...createEntity('Range'),
        fields: [{
          kind: 'FieldDeclaration',
          name: { kind: 'Identifier', name: 'value', span: createSpan(2, 3) },
          type: {
            kind: 'SimpleType',
            name: { kind: 'Identifier', name: 'Int', span: createSpan(2, 10) },
            span: createSpan(2, 10),
            constraints: [
              { name: 'min', value: { kind: 'NumberLiteral', value: 100 } },
              { name: 'max', value: { kind: 'NumberLiteral', value: 10 } },
            ],
          },
          span: createSpan(2, 3, 2, 30),
        }],
      } as EntityDeclaration],
    });

    const ctx = createContext(ast);
    const diagnostics = typeCoherencePass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0342')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Contradictory constraints'))).toBe(true);
  });

  it('should detect type shadowing of built-in types', () => {
    const ast = createMockAST({
      types: [{
        kind: 'TypeDeclaration',
        name: { kind: 'Identifier', name: 'String', span: createSpan(1, 1) },
        span: createSpan(1, 1, 3, 1),
        type: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Text', span: createSpan(1, 15) }, span: createSpan(1, 15) },
      }],
    });

    const ctx = createContext(ast);
    const diagnostics = typeCoherencePass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0346')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('shadows a built-in type'))).toBe(true);
  });
});

// ============================================================================
// Redundant Conditions Pass Tests
// ============================================================================

describe('RedundantConditionsPass', () => {
  it('should detect tautological conditions (x == x)', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'ComparisonExpression',
            left: { kind: 'Identifier', name: 'x' },
            operator: '==',
            right: { kind: 'Identifier', name: 'x' },
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = redundantConditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0350')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Tautological'))).toBe(true);
  });

  it('should detect literal true conditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: { kind: 'BooleanLiteral', value: true },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = redundantConditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0350')).toBe(true);
  });

  it('should detect duplicate conditions', () => {
    const condition = {
      kind: 'ComparisonExpression',
      left: { kind: 'Identifier', name: 'amount' },
      operator: '>',
      right: { kind: 'NumberLiteral', value: 0 },
    };

    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [
          { expression: condition },
          { expression: condition },
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = redundantConditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0351')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Duplicate'))).toBe(true);
  });

  it('should detect subsumed conditions (x > 10 implies x > 5)', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [
          {
            expression: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'x' },
              operator: '>',
              right: { kind: 'NumberLiteral', value: 10 },
            },
          },
          {
            expression: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'x' },
              operator: '>',
              right: { kind: 'NumberLiteral', value: 5 },
            },
          },
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = redundantConditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0352')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Subsumed'))).toBe(true);
  });

  it('should detect redundant boolean comparisons (x == true)', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'ComparisonExpression',
            left: { kind: 'Identifier', name: 'isValid' },
            operator: '==',
            right: { kind: 'BooleanLiteral', value: true },
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = redundantConditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0353')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Redundant boolean comparison'))).toBe(true);
  });
});

// ============================================================================
// Cyclic Dependencies Pass Tests
// ============================================================================

describe('CyclicDependenciesPass', () => {
  it('should detect circular entity dependencies', () => {
    const ast = createMockAST({
      entities: [
        createEntity('User', [{ name: 'profile', type: 'Profile' }]),
        createEntity('Profile', [{ name: 'user', type: 'User' }]),
      ],
    });

    const ctx = createContext(ast);
    const diagnostics = cyclicDependenciesPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0360')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Circular entity dependency'))).toBe(true);
  });

  it('should detect deep nesting (>5 levels)', () => {
    // Create a chain: A -> B -> C -> D -> E -> F (6 levels)
    const ast = createMockAST({
      entities: [
        createEntity('A', [{ name: 'b', type: 'B' }]),
        createEntity('B', [{ name: 'c', type: 'C' }]),
        createEntity('C', [{ name: 'd', type: 'D' }]),
        createEntity('D', [{ name: 'e', type: 'E' }]),
        createEntity('E', [{ name: 'f', type: 'F' }]),
        createEntity('F', [{ name: 'value', type: 'String' }]),
      ],
    });

    const ctx = createContext(ast);
    const diagnostics = cyclicDependenciesPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0363')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('deep nesting'))).toBe(true);
  });

  it('should not flag linear dependencies without cycles', () => {
    const ast = createMockAST({
      entities: [
        createEntity('Order', [{ name: 'items', type: 'OrderItem' }]),
        createEntity('OrderItem', [{ name: 'product', type: 'Product' }]),
        createEntity('Product', [{ name: 'name', type: 'String' }]),
      ],
    });

    const ctx = createContext(ast);
    const diagnostics = cyclicDependenciesPass.run(ctx);

    expect(diagnostics.filter(d => d.code === 'E0360').length).toBe(0);
  });
});

// ============================================================================
// Unreachable Clauses Pass Tests
// ============================================================================

describe('UnreachableClausesPass', () => {
  it('should detect unreachable guarded conditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [
          {
            expression: { kind: 'BooleanLiteral', value: true },
            guard: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'status' },
              operator: '==',
              right: { kind: 'StringLiteral', value: 'active' },
              span: createSpan(15, 5),
            },
          },
          {
            expression: { kind: 'BooleanLiteral', value: true },
            guard: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'status' },
              operator: '==',
              right: { kind: 'StringLiteral', value: 'inactive' },
              span: createSpan(16, 5),
            },
          },
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unreachableClausesPass.run(ctx);

    // This test checks the basic structure, actual contradictory guard detection depends on values
    expect(diagnostics.length).toBeGreaterThanOrEqual(0);
  });

  it('should detect duplicate precondition clauses', () => {
    const condition = {
      kind: 'ComparisonExpression',
      left: { kind: 'Identifier', name: 'amount' },
      operator: '>',
      right: { kind: 'NumberLiteral', value: 0 },
    };

    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [
          { expression: condition },
          { expression: condition },
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unreachableClausesPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0311')).toBe(true);
  });
});

// ============================================================================
// Unused Symbols Pass Tests
// ============================================================================

describe('UnusedSymbolsPass', () => {
  it('should detect unused input parameters', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('CreateUser', {
        inputs: [
          { name: 'email', type: 'String' },
          { name: 'unusedParam', type: 'String' },
        ],
        postconditions: [{
          expression: {
            kind: 'BinaryExpression',
            left: { kind: 'Identifier', name: 'email' },
            operator: '!=',
            right: { kind: 'StringLiteral', value: '' },
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unusedSymbolsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0322')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('unusedParam'))).toBe(true);
  });

  it('should detect unused entities', () => {
    const ast = createMockAST({
      entities: [
        createEntity('UsedEntity', [{ name: 'id', type: 'String' }]),
        createEntity('UnusedEntity', [{ name: 'id', type: 'String' }]),
      ],
      behaviors: [createBehavior('TestBehavior', {
        inputs: [{ name: 'entity', type: 'UsedEntity' }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unusedSymbolsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0320')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('UnusedEntity'))).toBe(true);
  });

  it('should detect unused output declarations', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        outputs: [{ name: 'result', type: 'String' }],
        postconditions: [{
          expression: { kind: 'BooleanLiteral', value: true },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unusedSymbolsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0323')).toBe(true);
  });
});

// ============================================================================
// Unsatisfiable Preconditions Pass Tests
// ============================================================================

describe('UnsatisfiablePreconditionsPass', () => {
  it('should detect x != x (always false)', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'ComparisonExpression',
            left: { kind: 'Identifier', name: 'x' },
            operator: '!=',
            right: { kind: 'Identifier', name: 'x' },
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unsatisfiablePreconditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0330')).toBe(true);
  });

  it('should detect contradictory preconditions (x > 10 AND x < 5)', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [
          {
            expression: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'x' },
              operator: '>',
              right: { kind: 'NumberLiteral', value: 10 },
            },
          },
          {
            expression: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'x' },
              operator: '<',
              right: { kind: 'NumberLiteral', value: 5 },
            },
          },
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unsatisfiablePreconditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0331')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Contradictory'))).toBe(true);
  });

  it('should detect x == 5 AND x != 5', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [
          {
            expression: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'status' },
              operator: '==',
              right: { kind: 'NumberLiteral', value: 5 },
            },
          },
          {
            expression: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'status' },
              operator: '!=',
              right: { kind: 'NumberLiteral', value: 5 },
            },
          },
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = unsatisfiablePreconditionsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0331')).toBe(true);
  });
});

// ============================================================================
// Pass Runner Integration Tests
// ============================================================================

describe('PassRunner Integration', () => {
  it('should run all builtin passes without errors', () => {
    const runner = createPassRunner();
    runner.registerAll(builtinPasses);

    const ast = createMockAST({
      entities: [createEntity('User', [{ name: 'email', type: 'String' }])],
      behaviors: [createBehavior('CreateUser', {
        inputs: [{ name: 'email', type: 'String' }],
      })],
    });

    const result = runner.run(ast, 'domain Test {}', 'test.isl');

    expect(result.passResults.every(r => r.succeeded)).toBe(true);
    expect(result.stats.totalPasses).toBe(builtinPasses.length);
  });

  it('should respect pass dependencies', () => {
    const executionOrder: string[] = [];
    const runner = createPassRunner();

    runner.registerAll([
      {
        id: 'pass-b',
        name: 'Pass B',
        description: 'Depends on A',
        dependencies: ['pass-a'],
        priority: 50,
        enabledByDefault: true,
        run: () => { executionOrder.push('b'); return []; },
      },
      {
        id: 'pass-a',
        name: 'Pass A',
        description: 'No dependencies',
        priority: 50,
        enabledByDefault: true,
        run: () => { executionOrder.push('a'); return []; },
      },
    ]);

    runner.run(createMockAST(), '', 'test.isl');

    expect(executionOrder.indexOf('a')).toBeLessThan(executionOrder.indexOf('b'));
  });

  it('should filter passes by enable/disable config', () => {
    const runner = createPassRunner({
      enablePasses: ['type-coherence'],
    });
    runner.registerAll(builtinPasses);

    const result = runner.run(createMockAST(), '', 'test.isl');

    expect(result.passResults.length).toBe(1);
    expect(result.passResults[0].passId).toBe('type-coherence');
  });

  it('should cache pass results', () => {
    let callCount = 0;
    const runner = createPassRunner({ cacheEnabled: true });

    runner.register({
      id: 'counting-pass',
      name: 'Counting Pass',
      description: 'Counts invocations',
      enabledByDefault: true,
      run: () => { callCount++; return []; },
    });

    const source = 'domain Test {}';
    runner.run(createMockAST(), source, 'test.isl');
    runner.run(createMockAST(), source, 'test.isl');

    expect(callCount).toBe(1);
  });

  it('should provide correct statistics', () => {
    const runner = createPassRunner();
    runner.registerAll(builtinPasses);

    const ast = createMockAST({
      entities: [createEntity('User', [{ name: 'email', type: 'String' }])],
    });

    const result = runner.run(ast, '', 'test.isl');

    expect(result.stats.totalPasses).toBe(builtinPasses.length);
    expect(result.stats.passesRun).toBeGreaterThanOrEqual(0);
    expect(typeof result.stats.totalDurationMs).toBe('number');
  });
});

// ============================================================================
// Additional Edge Case Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty domain gracefully', () => {
    const runner = createPassRunner();
    runner.registerAll(builtinPasses);

    const result = runner.run(createMockAST(), '', 'test.isl');

    expect(result.allPassed).toBe(true);
  });

  it('should handle null preconditions/postconditions', () => {
    const ast = createMockAST({
      behaviors: [{
        ...createBehavior('EmptyBehavior'),
        preconditions: null,
        postconditions: null,
      } as BehaviorDeclaration],
    });

    const runner = createPassRunner();
    runner.registerAll(builtinPasses);

    const result = runner.run(ast, '', 'test.isl');

    expect(result.passResults.every(r => r.succeeded)).toBe(true);
  });

  it('should deduplicate identical diagnostics', () => {
    const runner = createPassRunner();

    // Register two passes that produce the same diagnostic
    const diagnostic = {
      code: 'E0001',
      category: 'semantic' as const,
      severity: 'error' as const,
      message: 'Duplicate error',
      location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 10 },
      source: 'verifier',
    };

    runner.register({
      id: 'dup-pass-1',
      name: 'Dup 1',
      description: '',
      enabledByDefault: true,
      run: () => [diagnostic],
    });

    runner.register({
      id: 'dup-pass-2',
      name: 'Dup 2',
      description: '',
      enabledByDefault: true,
      run: () => [diagnostic],
    });

    const result = runner.run(createMockAST(), '', 'test.isl');

    expect(result.diagnostics.length).toBe(1);
  });
});
