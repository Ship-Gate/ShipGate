// ============================================================================
// Expression Evaluator Performance Benchmarks
// ============================================================================

import { describe, it, expect } from 'vitest';
import type * as AST from '@isl-lang/parser';
import { evaluateExpression, type EvaluationContext } from '../src/evaluator.js';
import type { EntityStore } from '../src/types.js';

// Test helpers
function createLocation(
  line: number = 1,
  column: number = 1,
  endLine: number = 1,
  endColumn: number = 1
): AST.SourceLocation {
  return {
    file: 'test.isl',
    line,
    column,
    endLine,
    endColumn,
  };
}

function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  const mockStore: EntityStore = {
    getAll: () => [],
    exists: () => false,
    lookup: () => undefined,
    count: () => 0,
    create: () => ({ __entity__: 'Test', __id__: '1', name: 'test' }),
    update: () => {},
    delete: () => {},
    snapshot: () => ({ entities: new Map(), timestamp: Date.now() }),
    restore: () => {},
  };

  return {
    input: {},
    result: undefined,
    error: undefined,
    store: mockStore,
    oldState: undefined,
    domain: {
      kind: 'Domain',
      name: { kind: 'Identifier', name: 'Test', location: createLocation() },
      version: { kind: 'StringLiteral', value: '1.0.0', location: createLocation() },
      imports: [],
      types: [],
      entities: [],
      behaviors: [],
      invariants: [],
      policies: [],
      views: [],
      scenarios: [],
      chaos: [],
      location: createLocation(),
    },
    now: new Date(),
    variables: new Map(),
    ...overrides,
  };
}

function createNumberLiteral(value: number): AST.NumberLiteral {
  return {
    kind: 'NumberLiteral',
    value,
    isFloat: false,
    location: createLocation(),
  };
}

function createBooleanLiteral(value: boolean): AST.BooleanLiteral {
  return {
    kind: 'BooleanLiteral',
    value,
    location: createLocation(),
  };
}

function createBinaryExpr(
  operator: AST.BinaryOperator,
  left: AST.Expression,
  right: AST.Expression
): AST.BinaryExpr {
  return {
    kind: 'BinaryExpr',
    operator,
    left,
    right,
    location: createLocation(),
  };
}

function createIdentifier(name: string): AST.Identifier {
  return {
    kind: 'Identifier',
    name,
    location: createLocation(),
  };
}

function createMemberExpr(object: AST.Expression, property: string): AST.MemberExpr {
  return {
    kind: 'MemberExpr',
    object,
    property: createIdentifier(property),
    location: createLocation(),
  };
}

// ============================================================================
// PERFORMANCE BENCHMARK
// ============================================================================

describe('Performance benchmarks', () => {
  it('should evaluate 1000 simple expressions in under 100ms', () => {
    const context = createContext();
    const expressions: AST.Expression[] = [];
    
    // Generate 1000 simple comparison expressions
    for (let i = 0; i < 1000; i++) {
      const left = createNumberLiteral(i);
      const right = createNumberLiteral(i + 1);
      expressions.push(createBinaryExpr('<', left, right));
    }
    
    const startTime = performance.now();
    
    for (const expr of expressions) {
      evaluateExpression(expr, context);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(100);
    console.log(`Evaluated 1000 expressions in ${duration.toFixed(2)}ms`);
  });

  it('should evaluate 1000 complex expressions in reasonable time', () => {
    const context = createContext({
      input: { value: 42, name: 'test', items: [1, 2, 3] },
    });
    const expressions: AST.Expression[] = [];
    
    // Generate 1000 complex expressions with property access
    for (let i = 0; i < 1000; i++) {
      const inputExpr = createIdentifier('input');
      const valueExpr = createMemberExpr(inputExpr, 'value');
      const numExpr = createNumberLiteral(i);
      expressions.push(createBinaryExpr('==', valueExpr, numExpr));
    }
    
    const startTime = performance.now();
    
    for (const expr of expressions) {
      evaluateExpression(expr, context);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Allow more time for complex expressions (500ms threshold)
    expect(duration).toBeLessThan(500);
    console.log(`Evaluated 1000 complex expressions in ${duration.toFixed(2)}ms`);
  });

  it('should evaluate 1000 logical expressions efficiently', () => {
    const context = createContext();
    const expressions: AST.Expression[] = [];
    
    // Generate 1000 logical expressions
    for (let i = 0; i < 1000; i++) {
      const left = createBooleanLiteral(i % 2 === 0);
      const right = createBooleanLiteral(i % 3 === 0);
      expressions.push(createBinaryExpr('and', left, right));
    }
    
    const startTime = performance.now();
    
    for (const expr of expressions) {
      evaluateExpression(expr, context);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(100);
    console.log(`Evaluated 1000 logical expressions in ${duration.toFixed(2)}ms`);
  });

  it('should handle deep nesting efficiently', () => {
    const context = createContext({
      input: {
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 42 } } } } } } } } },
      },
    });
    
    // Create deeply nested property access
    let expr: AST.Expression = createIdentifier('input');
    for (const prop of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
      expr = createMemberExpr(expr, prop);
    }
    
    const expressions: AST.Expression[] = Array(100).fill(expr);
    
    const startTime = performance.now();
    
    for (const e of expressions) {
      evaluateExpression(e, context);
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(100);
    console.log(`Evaluated 100 deeply nested expressions in ${duration.toFixed(2)}ms`);
  });
});
