/**
 * Tests for New Semantic Analysis Passes
 * 
 * Tests the 8-pass pipeline:
 * 1. Import Graph
 * 2. Symbol Resolution (via type-coherence)
 * 3. Type Coherence
 * 4. Purity Constraints
 * 5. Control Flow / Reachability
 * 6. Contract Completeness
 * 7. Exhaustiveness
 * 8. Optimization Hints
 */

import { describe, it, expect } from 'vitest';
import type { DomainDeclaration, SourceSpan, BehaviorDeclaration, EntityDeclaration } from '@isl-lang/isl-core';
import type { PassContext } from '../src/types.js';
import { PassRunner, createPassRunner } from '../src/pass-runner.js';
import { buildTypeEnvironment } from '../src/type-environment.js';
import {
  builtinPasses,
  importGraphPass,
  purityConstraintsPass,
  exhaustivenessPass,
  typeCoherencePass,
  unreachableClausesPass,
  redundantConditionsPass,
  getPassesByPhase,
  corePasses,
} from '../src/passes/index.js';

// ============================================================================
// Test Utilities
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
    errors?: Array<{ name: string }>;
    preconditions?: Array<{ expression: unknown; guard?: unknown }>;
    postconditions?: Array<{ expression: unknown; condition?: string }>;
    invariants?: Array<{ expression: unknown }>;
  } = {}
): BehaviorDeclaration {
  const span = createSpan(1, 1, 50, 1);
  return {
    kind: 'BehaviorDeclaration',
    name: { kind: 'Identifier', name, span },
    span,
    input: {
      kind: 'InputBlock',
      fields: options.inputs?.map((inp, i) => ({
        kind: 'FieldDeclaration',
        name: { kind: 'Identifier', name: inp.name, span: createSpan(2 + i, 5) },
        type: { kind: 'SimpleType', name: { kind: 'Identifier', name: inp.type, span: createSpan(2 + i, 15) }, span: createSpan(2 + i, 15) },
        span: createSpan(2 + i, 5),
      })) ?? [],
      span: createSpan(2, 3),
    },
    output: {
      kind: 'OutputBlock',
      success: { kind: 'SimpleType', name: { kind: 'Identifier', name: 'Void', span: createSpan(10, 5) }, span: createSpan(10, 5) },
      errors: options.errors?.map((err, i) => ({
        kind: 'ErrorDeclaration',
        name: { kind: 'Identifier', name: err.name, span: createSpan(11 + i, 5) },
        span: createSpan(11 + i, 5),
      })) ?? [],
      span: createSpan(10, 3),
    },
    preconditions: options.preconditions ? {
      kind: 'ConditionBlock',
      conditions: options.preconditions.map((pc, i) => ({
        kind: 'Condition',
        expression: pc.expression,
        guard: pc.guard,
        span: createSpan(15 + i, 5),
        statements: [{ expression: pc.expression, span: createSpan(15 + i, 5) }],
      })),
      span: createSpan(15, 3),
    } : null,
    postconditions: options.postconditions ? {
      kind: 'ConditionBlock',
      conditions: options.postconditions.map((pc, i) => ({
        kind: 'Condition',
        expression: pc.expression,
        condition: pc.condition,
        type: pc.condition,
        span: createSpan(25 + i, 5),
        statements: [{ expression: pc.expression, span: createSpan(25 + i, 5) }],
      })),
      span: createSpan(25, 3),
    } : null,
    invariants: options.invariants?.map((inv, i) => ({
      kind: 'Invariant',
      expression: inv.expression,
      span: createSpan(35 + i, 5),
    })) ?? null,
    actors: [],
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
// Import Graph Pass Tests
// ============================================================================

describe('ImportGraphPass', () => {
  it('should detect duplicate imports', () => {
    const ast = createMockAST({
      imports: [
        {
          kind: 'ImportDeclaration',
          source: { kind: 'StringLiteral', value: './types.isl' },
          span: createSpan(1, 1),
        },
        {
          kind: 'ImportDeclaration',
          source: { kind: 'StringLiteral', value: './types.isl' },
          span: createSpan(2, 1),
        },
      ] as unknown[],
    });

    const ctx = createContext(ast);
    const diagnostics = importGraphPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0102')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Duplicate import'))).toBe(true);
  });

  it('should handle empty imports gracefully', () => {
    const ast = createMockAST({ imports: [] });
    const ctx = createContext(ast);
    const diagnostics = importGraphPass.run(ctx);

    expect(diagnostics.length).toBe(0);
  });

  it('should build deterministic import order', () => {
    const ast = createMockAST({
      imports: [
        { kind: 'ImportDeclaration', source: { kind: 'StringLiteral', value: './c.isl' }, span: createSpan(1, 1) },
        { kind: 'ImportDeclaration', source: { kind: 'StringLiteral', value: './a.isl' }, span: createSpan(2, 1) },
        { kind: 'ImportDeclaration', source: { kind: 'StringLiteral', value: './b.isl' }, span: createSpan(3, 1) },
      ] as unknown[],
    });

    const ctx = createContext(ast) as PassContext & { importGraph?: unknown };
    importGraphPass.run(ctx);

    // Import graph should be attached to context
    expect(ctx.importGraph).toBeDefined();
  });
});

// ============================================================================
// Purity Constraints Pass Tests
// ============================================================================

describe('PurityConstraintsPass', () => {
  it('should detect old() in preconditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'OldExpr',
            expression: { kind: 'Identifier', name: 'value' },
            span: createSpan(15, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0411')).toBe(true);
    expect(diagnostics.some(d => d.message.includes("'old()' cannot be used in preconditions"))).toBe(true);
  });

  it('should detect result in preconditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'ResultExpr',
            span: createSpan(15, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0412')).toBe(true);
  });

  it('should detect mutating method calls in preconditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'CallExpr',
            callee: {
              kind: 'MemberExpression',
              object: { kind: 'Identifier', name: 'account' },
              property: { name: 'update' },
            },
            arguments: [],
            span: createSpan(15, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0400')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Mutating method'))).toBe(true);
  });

  it('should allow old() in postconditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        postconditions: [{
          expression: {
            kind: 'OldExpr',
            expression: { kind: 'Identifier', name: 'value' },
            span: createSpan(25, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    // Should NOT report old() error in postconditions
    expect(diagnostics.filter(d => d.code === 'E0411').length).toBe(0);
  });

  it('should detect external calls in preconditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'CallExpr',
            callee: { kind: 'Identifier', name: 'fetch' },
            arguments: [],
            span: createSpan(15, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0413')).toBe(true);
  });

  it('should detect assignment in preconditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'AssignmentExpression',
            left: { kind: 'Identifier', name: 'x' },
            right: { kind: 'NumberLiteral', value: 5 },
            span: createSpan(15, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0414')).toBe(true);
  });
});

// ============================================================================
// Exhaustiveness Pass Tests
// ============================================================================

describe('ExhaustivenessPass', () => {
  it('should detect missing enum variant handlers', () => {
    const ast = createMockAST({
      enums: [{
        kind: 'EnumDeclaration',
        name: { kind: 'Identifier', name: 'Status', span: createSpan(1, 1) },
        variants: [
          { name: 'Active' },
          { name: 'Inactive' },
          { name: 'Pending' },
        ],
        span: createSpan(1, 1, 5, 1),
      }] as unknown[],
      behaviors: [createBehavior('ProcessStatus', {
        preconditions: [
          {
            expression: { kind: 'BooleanLiteral', value: true },
            guard: {
              kind: 'ComparisonExpression',
              left: { kind: 'Identifier', name: 'status' },
              operator: '==',
              right: {
                kind: 'MemberExpression',
                object: { kind: 'Identifier', name: 'Status' },
                property: { name: 'Active' },
              },
              span: createSpan(10, 5),
            },
          },
          // Missing: Inactive, Pending handlers
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = exhaustivenessPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0701')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Non-exhaustive'))).toBe(true);
  });

  it('should detect missing error handlers in postconditions', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        errors: [
          { name: 'NotFound' },
          { name: 'Forbidden' },
          { name: 'BadRequest' },
        ],
        postconditions: [
          { expression: { kind: 'BooleanLiteral', value: true }, condition: 'success' },
          { expression: { kind: 'BooleanLiteral', value: true }, condition: 'NotFound' },
          // Missing: Forbidden, BadRequest handlers
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = exhaustivenessPass.run(ctx);

    expect(diagnostics.some(d => d.code === 'E0705')).toBe(true);
    expect(diagnostics.some(d => d.message.includes('Missing postconditions'))).toBe(true);
  });

  it('should handle exhaustive error coverage', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        errors: [
          { name: 'NotFound' },
          { name: 'Forbidden' },
        ],
        postconditions: [
          { expression: { kind: 'BooleanLiteral', value: true }, condition: 'success' },
          { expression: { kind: 'BooleanLiteral', value: true }, condition: 'NotFound' },
          { expression: { kind: 'BooleanLiteral', value: true }, condition: 'Forbidden' },
        ],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = exhaustivenessPass.run(ctx);

    // Should not report missing error handlers
    expect(diagnostics.filter(d => d.code === 'E0705').length).toBe(0);
  });
});

// ============================================================================
// Pipeline Integration Tests
// ============================================================================

describe('8-Pass Pipeline Integration', () => {
  it('should have 8 core passes registered', () => {
    expect(corePasses.length).toBe(8);
  });

  it('should have all passes in builtinPasses', () => {
    const passIds = builtinPasses.map(p => p.id);
    
    expect(passIds).toContain('import-graph');
    expect(passIds).toContain('type-coherence');
    expect(passIds).toContain('purity-constraints');
    expect(passIds).toContain('unreachable-clauses');
    expect(passIds).toContain('enhanced-consistency-checker');
    expect(passIds).toContain('exhaustiveness');
    expect(passIds).toContain('redundant-conditions');
    expect(passIds).toContain('cyclic-dependencies');
  });

  it('should return passes by phase', () => {
    expect(getPassesByPhase(1).map(p => p.id)).toContain('import-graph');
    expect(getPassesByPhase(3).map(p => p.id)).toContain('purity-constraints');
    expect(getPassesByPhase(6).map(p => p.id)).toContain('exhaustiveness');
  });

  it('should run all passes without errors on valid AST', () => {
    const runner = createPassRunner();
    runner.registerAll(builtinPasses);

    const ast = createMockAST({
      entities: [createEntity('User', [
        { name: 'id', type: 'UUID' },
        { name: 'email', type: 'String' },
      ])],
      behaviors: [createBehavior('CreateUser', {
        inputs: [{ name: 'email', type: 'String' }],
        preconditions: [{
          expression: {
            kind: 'ComparisonExpression',
            left: { kind: 'Identifier', name: 'email' },
            operator: '!=',
            right: { kind: 'StringLiteral', value: '' },
          },
        }],
      })],
    });

    const result = runner.run(ast, 'domain Test {}', 'test.isl');

    expect(result.passResults.every(r => r.succeeded)).toBe(true);
  });

  it('should respect pass dependencies', () => {
    const executionOrder: string[] = [];
    const runner = createPassRunner({ cacheEnabled: false });

    // Register passes with tracking
    for (const pass of [importGraphPass, purityConstraintsPass, exhaustivenessPass]) {
      runner.register({
        ...pass,
        run: (ctx) => {
          executionOrder.push(pass.id);
          return pass.run(ctx);
        },
      });
    }

    runner.run(createMockAST(), '', 'test.isl');

    // import-graph should run before purity-constraints and exhaustiveness
    const importIdx = executionOrder.indexOf('import-graph');
    const purityIdx = executionOrder.indexOf('purity-constraints');
    const exhaustIdx = executionOrder.indexOf('exhaustiveness');

    if (importIdx >= 0 && purityIdx >= 0) {
      expect(importIdx).toBeLessThan(purityIdx);
    }
    if (importIdx >= 0 && exhaustIdx >= 0) {
      expect(importIdx).toBeLessThan(exhaustIdx);
    }
  });

  it('should deduplicate diagnostics across passes', () => {
    const runner = createPassRunner();
    
    // Create a diagnostic that might be produced by multiple passes
    const sharedDiagnostic = {
      code: 'E0001',
      category: 'semantic' as const,
      severity: 'error' as const,
      message: 'Test error',
      location: { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 10 },
      source: 'verifier',
    };

    runner.register({
      id: 'test-pass-1',
      name: 'Test 1',
      description: '',
      enabledByDefault: true,
      run: () => [sharedDiagnostic],
    });

    runner.register({
      id: 'test-pass-2',
      name: 'Test 2',
      description: '',
      enabledByDefault: true,
      run: () => [sharedDiagnostic],
    });

    const result = runner.run(createMockAST(), '', 'test.isl');

    // Should deduplicate to single diagnostic
    expect(result.diagnostics.length).toBe(1);
  });
});

// ============================================================================
// Diagnostic Format Tests
// ============================================================================

describe('Diagnostic Format', () => {
  it('should include all required diagnostic fields', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'OldExpr',
            expression: { kind: 'Identifier', name: 'value' },
            span: createSpan(15, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    const diagnostic = diagnostics[0];
    if (diagnostic) {
      expect(diagnostic.code).toBeDefined();
      expect(diagnostic.category).toBe('semantic');
      expect(diagnostic.severity).toMatch(/error|warning|hint/);
      expect(diagnostic.message).toBeDefined();
      expect(diagnostic.location).toBeDefined();
      expect(diagnostic.location.file).toBeDefined();
      expect(diagnostic.location.line).toBeDefined();
      expect(diagnostic.source).toBe('verifier');
    }
  });

  it('should include help suggestions for actionable errors', () => {
    const ast = createMockAST({
      behaviors: [createBehavior('TestBehavior', {
        preconditions: [{
          expression: {
            kind: 'OldExpr',
            expression: { kind: 'Identifier', name: 'value' },
            span: createSpan(15, 5),
          },
        }],
      })],
    });

    const ctx = createContext(ast);
    const diagnostics = purityConstraintsPass.run(ctx);

    const diagnostic = diagnostics.find(d => d.code === 'E0411');
    if (diagnostic) {
      expect(diagnostic.help).toBeDefined();
      expect(Array.isArray(diagnostic.help) ? diagnostic.help.length : 0).toBeGreaterThan(0);
    }
  });
});
