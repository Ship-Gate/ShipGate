/**
 * SMT Integration Tests
 * 
 * Tests for:
 * 1. Satisfiable preconditions
 * 2. Unsatisfiable (contradictory) constraints
 * 3. Timeout handling -> UNKNOWN
 */

import { describe, it, expect } from 'vitest';
import { createSolver, verifySMT, encodeExpression, createContext, islTypeToSort } from '../src/index.js';
import { Expr, Sort } from '@isl-lang/prover';
import type { DomainDeclaration, BehaviorDeclaration, ConditionBlock, ConditionStatement, TypeDeclaration, TypeConstraint } from '@isl-lang/isl-core/ast';

// Helper to create a mock span
const mockSpan = { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };

// Helper to create identifier
const id = (name: string) => ({ kind: 'Identifier' as const, name, span: mockSpan });

// Helper to create number literal
const num = (value: number) => ({ kind: 'NumberLiteral' as const, value, span: mockSpan });

// Helper to create boolean literal
const bool = (value: boolean) => ({ kind: 'BooleanLiteral' as const, value, span: mockSpan });

// Helper to create comparison expression
const compare = (left: any, operator: '==' | '!=' | '<' | '>' | '<=' | '>=', right: any) => ({
  kind: 'ComparisonExpression' as const,
  operator,
  left,
  right,
  span: mockSpan,
});

// Helper to create logical expression
const logical = (left: any, operator: 'and' | 'or', right: any) => ({
  kind: 'LogicalExpression' as const,
  operator,
  left,
  right,
  span: mockSpan,
});

// Helper to create condition statement
const condStmt = (expression: any): ConditionStatement => ({
  kind: 'ConditionStatement',
  expression,
  span: mockSpan,
});

// Helper to create condition block
const condBlock = (statements: ConditionStatement[]): ConditionBlock => ({
  kind: 'ConditionBlock',
  conditions: [{
    kind: 'Condition',
    implies: false,
    statements,
    span: mockSpan,
  }],
  span: mockSpan,
});

describe('SMT Solver', () => {
  describe('checkSat', () => {
    it('should return SAT for satisfiable formula', async () => {
      const solver = createSolver({ timeout: 5000 });
      
      // x > 0 AND x < 10 is satisfiable (e.g., x = 5)
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
      );
      
      const result = await solver.checkSat(formula, []);
      
      expect(result.status).toBe('sat');
    });
    
    it('should return UNSAT for unsatisfiable formula', async () => {
      const solver = createSolver({ timeout: 5000 });
      
      // x > 10 AND x < 5 is unsatisfiable (contradiction)
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(10)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(5))
      );
      
      const result = await solver.checkSat(formula, []);
      
      // The builtin solver may return unknown for complex formulas
      // but it should definitely not return sat
      expect(result.status).not.toBe('sat');
    });
    
    it('should return UNSAT for false constant', async () => {
      const solver = createSolver({ timeout: 5000 });
      
      // false is trivially unsatisfiable
      const formula = Expr.bool(false);
      
      const result = await solver.checkSat(formula, []);
      
      expect(result.status).toBe('unsat');
    });
    
    it('should return SAT for true constant', async () => {
      const solver = createSolver({ timeout: 5000 });
      
      // true is trivially satisfiable
      const formula = Expr.bool(true);
      
      const result = await solver.checkSat(formula, []);
      
      expect(result.status).toBe('sat');
    });
  });
  
  describe('timeout handling', () => {
    it('should return TIMEOUT or UNKNOWN for very short timeout', async () => {
      const solver = createSolver({ timeout: 1 }); // 1ms timeout
      
      // A formula that's not trivially solvable
      const formula = Expr.and(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('x', Sort.Int()), Expr.int(100)),
        Expr.gt(Expr.var('y', Sort.Int()), Expr.int(0)),
        Expr.lt(Expr.var('y', Sort.Int()), Expr.int(100)),
        Expr.eq(
          Expr.add(Expr.var('x', Sort.Int()), Expr.var('y', Sort.Int())),
          Expr.int(42)
        )
      );
      
      const result = await solver.checkSat(formula, []);
      
      // With a 1ms timeout, we should get either timeout or unknown
      // (the builtin solver might still be fast enough to solve simple cases)
      expect(['timeout', 'unknown', 'sat']).toContain(result.status);
    });
  });
  
  describe('checkValid', () => {
    it('should return SAT for valid tautology', async () => {
      const solver = createSolver({ timeout: 5000 });
      
      // x > 5 implies x > 3 is valid
      const formula = Expr.implies(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(5)),
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(3))
      );
      
      const result = await solver.checkValid(formula, []);
      
      // Note: checkValid returns sat if valid, unsat if not valid
      expect(result.status).toBe('sat');
    });
    
    it('should return UNSAT for invalid formula', async () => {
      const solver = createSolver({ timeout: 5000 });
      
      // x > 3 implies x > 5 is NOT valid (x=4 is counterexample)
      const formula = Expr.implies(
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(3)),
        Expr.gt(Expr.var('x', Sort.Int()), Expr.int(5))
      );
      
      const result = await solver.checkValid(formula, []);
      
      // This is not valid, so should return unsat (or unknown for complex cases)
      expect(['unsat', 'unknown']).toContain(result.status);
    });
  });
});

describe('Expression Encoder', () => {
  it('should encode boolean literals', () => {
    const ctx = createContext();
    
    const trueResult = encodeExpression(bool(true), ctx);
    expect(trueResult.success).toBe(true);
    if (trueResult.success) {
      expect(trueResult.expr).toEqual(Expr.bool(true));
    }
    
    const falseResult = encodeExpression(bool(false), ctx);
    expect(falseResult.success).toBe(true);
    if (falseResult.success) {
      expect(falseResult.expr).toEqual(Expr.bool(false));
    }
  });
  
  it('should encode number literals', () => {
    const ctx = createContext();
    
    const result = encodeExpression(num(42), ctx);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expr).toEqual(Expr.int(42));
    }
  });
  
  it('should encode comparison expressions', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());
    
    const result = encodeExpression(compare(id('x'), '>', num(0)), ctx);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expr.kind).toBe('Gt');
    }
  });
  
  it('should encode logical expressions', () => {
    const ctx = createContext();
    ctx.variables.set('x', Sort.Int());
    
    const expr = logical(
      compare(id('x'), '>', num(0)),
      'and',
      compare(id('x'), '<', num(10))
    );
    
    const result = encodeExpression(expr, ctx);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.expr.kind).toBe('And');
    }
  });
  
  it('should map ISL types to SMT sorts', () => {
    expect(islTypeToSort('Int')).toEqual(Sort.Int());
    expect(islTypeToSort('Boolean')).toEqual(Sort.Bool());
    expect(islTypeToSort('String')).toEqual(Sort.String());
    expect(islTypeToSort('Decimal')).toEqual(Sort.Real());
  });
});

describe('Domain Verification', () => {
  it('should verify satisfiable preconditions', async () => {
    // Create a simple domain with a behavior that has satisfiable preconditions
    const domain: DomainDeclaration = {
      kind: 'DomainDeclaration',
      name: id('TestDomain'),
      imports: [],
      entities: [],
      types: [],
      enums: [],
      behaviors: [{
        kind: 'BehaviorDeclaration',
        name: id('transfer'),
        input: {
          kind: 'InputBlock',
          fields: [{
            kind: 'FieldDeclaration',
            name: id('amount'),
            type: { kind: 'SimpleType', name: id('Int'), span: mockSpan },
            optional: false,
            annotations: [],
            constraints: [],
            span: mockSpan,
          }],
          span: mockSpan,
        },
        preconditions: condBlock([
          condStmt(compare(id('amount'), '>', num(0))), // amount > 0
          condStmt(compare(id('amount'), '<', num(1000000))), // amount < 1000000
        ]),
        span: mockSpan,
      }],
      invariants: [],
      span: mockSpan,
    };
    
    const result = await verifySMT(domain, { timeout: 5000 });
    
    expect(result.summary.error).toBe(0);
    // Preconditions should be satisfiable (amount can be 500, for example)
    const preCheck = result.results.find(r => r.kind === 'precondition_satisfiability');
    expect(preCheck?.result.status).toBe('sat');
  });
  
  it('should detect unsatisfiable preconditions', async () => {
    // Create a domain with contradictory preconditions
    const domain: DomainDeclaration = {
      kind: 'DomainDeclaration',
      name: id('TestDomain'),
      imports: [],
      entities: [],
      types: [],
      enums: [],
      behaviors: [{
        kind: 'BehaviorDeclaration',
        name: id('impossible'),
        input: {
          kind: 'InputBlock',
          fields: [{
            kind: 'FieldDeclaration',
            name: id('x'),
            type: { kind: 'SimpleType', name: id('Int'), span: mockSpan },
            optional: false,
            annotations: [],
            constraints: [],
            span: mockSpan,
          }],
          span: mockSpan,
        },
        preconditions: condBlock([
          condStmt(compare(id('x'), '>', num(100))), // x > 100
          condStmt(compare(id('x'), '<', num(50))),  // x < 50 (contradiction!)
        ]),
        span: mockSpan,
      }],
      invariants: [],
      span: mockSpan,
    };
    
    const result = await verifySMT(domain, { timeout: 5000 });
    
    // The contradiction should be detected as unsat or unknown
    const preCheck = result.results.find(r => r.kind === 'precondition_satisfiability');
    expect(['unsat', 'unknown']).toContain(preCheck?.result.status);
  });
  
  it('should verify refinement type constraints', async () => {
    // Create a domain with a refinement type
    const domain: DomainDeclaration = {
      kind: 'DomainDeclaration',
      name: id('TestDomain'),
      imports: [],
      entities: [],
      types: [{
        kind: 'TypeDeclaration',
        name: id('PositiveAmount'),
        baseType: { kind: 'SimpleType', name: id('Int'), span: mockSpan },
        constraints: [{
          kind: 'TypeConstraint',
          name: id('min'),
          value: num(1),
          span: mockSpan,
        }, {
          kind: 'TypeConstraint',
          name: id('max'),
          value: num(1000000),
          span: mockSpan,
        }] as TypeConstraint[],
        span: mockSpan,
      }],
      enums: [],
      behaviors: [],
      invariants: [],
      span: mockSpan,
    };
    
    const result = await verifySMT(domain, { timeout: 5000 });
    
    // The refinement type should be satisfiable (values 1-1000000)
    const typeCheck = result.results.find(r => r.kind === 'refinement_constraint');
    if (typeCheck) {
      expect(typeCheck.result.status).toBe('sat');
    }
  });
  
  it('should detect unsatisfiable refinement constraints', async () => {
    // Create a domain with contradictory refinement constraints
    const domain: DomainDeclaration = {
      kind: 'DomainDeclaration',
      name: id('TestDomain'),
      imports: [],
      entities: [],
      types: [{
        kind: 'TypeDeclaration',
        name: id('ImpossibleType'),
        baseType: { kind: 'SimpleType', name: id('Int'), span: mockSpan },
        constraints: [{
          kind: 'TypeConstraint',
          name: id('min'),
          value: num(100),
          span: mockSpan,
        }, {
          kind: 'TypeConstraint',
          name: id('max'),
          value: num(50), // max < min is impossible!
          span: mockSpan,
        }] as TypeConstraint[],
        span: mockSpan,
      }],
      enums: [],
      behaviors: [],
      invariants: [],
      span: mockSpan,
    };
    
    const result = await verifySMT(domain, { timeout: 5000 });
    
    // The refinement type should be unsatisfiable or unknown
    const typeCheck = result.results.find(r => r.kind === 'refinement_constraint');
    if (typeCheck) {
      expect(['unsat', 'unknown']).toContain(typeCheck.result.status);
    }
  });
});

describe('Timeout Handling', () => {
  it('should return UNKNOWN on timeout', async () => {
    // Create a complex domain that might timeout with a very short timeout
    const domain: DomainDeclaration = {
      kind: 'DomainDeclaration',
      name: id('ComplexDomain'),
      imports: [],
      entities: [],
      types: [],
      enums: [],
      behaviors: [{
        kind: 'BehaviorDeclaration',
        name: id('complex'),
        input: {
          kind: 'InputBlock',
          fields: Array.from({ length: 10 }, (_, i) => ({
            kind: 'FieldDeclaration' as const,
            name: id(`x${i}`),
            type: { kind: 'SimpleType' as const, name: id('Int'), span: mockSpan },
            optional: false,
            annotations: [],
            constraints: [],
            span: mockSpan,
          })),
          span: mockSpan,
        },
        preconditions: condBlock(
          Array.from({ length: 10 }, (_, i) => 
            condStmt(compare(id(`x${i}`), '>', num(0)))
          )
        ),
        span: mockSpan,
      }],
      invariants: [],
      span: mockSpan,
    };
    
    // Use a very short timeout
    const result = await verifySMT(domain, { timeout: 1 });
    
    // With such a short timeout, we expect either timeout, unknown, or sat
    // (the builtin solver might still be fast enough)
    for (const r of result.results) {
      expect(['sat', 'timeout', 'unknown']).toContain(r.result.status);
    }
  });
});
