/**
 * Tests for the Expression Compiler
 * 
 * Verifies that ISL expressions compile to correct TypeScript with entity bindings.
 */

import { describe, it, expect } from 'vitest';
import { 
  compileExpression, 
  compileAssertion, 
  createCompilerContext 
} from '../src/expression-compiler.js';

// Mock AST nodes for testing
function id(name: string) {
  return { kind: 'Identifier' as const, name, location: { file: 'test', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } };
}

function member(obj: any, prop: string) {
  return { kind: 'MemberExpr' as const, object: obj, property: id(prop), location: { file: 'test', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } };
}

function call(callee: any, args: any[] = []) {
  return { kind: 'CallExpr' as const, callee, arguments: args, location: { file: 'test', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } };
}

function resultExpr(prop?: string) {
  return { 
    kind: 'ResultExpr' as const, 
    property: prop ? id(prop) : undefined,
    location: { file: 'test', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } 
  };
}

function inputExpr(prop: string) {
  return { 
    kind: 'InputExpr' as const, 
    property: id(prop),
    location: { file: 'test', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } 
  };
}

function binary(left: any, op: string, right: any) {
  return {
    kind: 'BinaryExpr' as const,
    operator: op as any,
    left,
    right,
    location: { file: 'test', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
  };
}

describe('Expression Compiler', () => {
  // Context with User and Session as entities
  const ctx = createCompilerContext(['User', 'Session']);

  describe('Entity Method Calls', () => {
    it('compiles User.exists(result.id) to User.exists({ id: result.id })', () => {
      // AST for: User.exists(result.id)
      const expr = call(
        member(id('User'), 'exists'),
        [resultExpr('id')]
      );

      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('User.exists({ id: result.id })');
    });

    it('compiles User.exists() to User.exists()', () => {
      const expr = call(member(id('User'), 'exists'));
      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('User.exists()');
    });

    it('compiles User.lookup(input.email) to User.lookup({ email: input.email })', () => {
      const expr = call(
        member(id('User'), 'lookup'),
        [inputExpr('email')]
      );

      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('User.lookup({ email: input.email })');
    });

    it('compiles User.count() to User.count()', () => {
      const expr = call(member(id('User'), 'count'));
      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('User.count()');
    });

    it('compiles Session.exists(result.sessionId) correctly', () => {
      const expr = call(
        member(id('Session'), 'exists'),
        [resultExpr('sessionId')]
      );

      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('Session.exists({ sessionId: result.sessionId })');
    });
  });

  describe('Non-Entity Calls', () => {
    it('compiles regular function calls without transformation', () => {
      // someFunc(x)
      const expr = call(id('someFunc'), [id('x')]);
      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('someFunc(x)');
    });

    it('compiles string methods without entity transformation', () => {
      // input.email.contains("@")
      const expr = call(
        member(inputExpr('email'), 'contains'),
        [{ kind: 'StringLiteral', value: '@', location: { file: 'test', start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } }]
      );

      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('input.email.contains("@")');
    });
  });

  describe('Binary Expressions', () => {
    it('compiles result.email == input.email', () => {
      const expr = binary(resultExpr('email'), '==', inputExpr('email'));
      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('(result.email === input.email)');
    });

    it('compiles implies correctly', () => {
      // success implies User.exists(result.id)
      const expr = binary(
        id('success'),
        'implies',
        call(member(id('User'), 'exists'), [resultExpr('id')])
      );

      const compiled = compileExpression(expr, ctx);
      expect(compiled).toBe('(!success || User.exists({ id: result.id }))');
    });

    it('compiles and/or correctly', () => {
      const expr = binary(id('a'), 'and', id('b'));
      expect(compileExpression(expr, ctx)).toBe('(a && b)');

      const expr2 = binary(id('a'), 'or', id('b'));
      expect(compileExpression(expr2, ctx)).toBe('(a || b)');
    });
  });

  describe('Assertions', () => {
    it('generates correct assertion for entity exists', () => {
      const expr = call(
        member(id('User'), 'exists'),
        [resultExpr('id')]
      );

      const assertion = compileAssertion(expr, 'vitest', ctx);
      expect(assertion).toBe('expect(User.exists({ id: result.id })).toBe(true);');
    });

    it('generates equality assertion', () => {
      const expr = binary(resultExpr('email'), '==', inputExpr('email'));
      const assertion = compileAssertion(expr, 'vitest', ctx);
      expect(assertion).toBe('expect(result.email).toEqual(input.email);');
    });
  });
});

describe('Without Entity Context', () => {
  // No entities defined - backward compatibility
  const ctx = createCompilerContext([]);

  it('compiles User.exists(x) as-is when User is not a known entity', () => {
    const expr = call(
      member(id('User'), 'exists'),
      [id('x')]
    );

    // Without entity context, it's just a regular method call
    const compiled = compileExpression(expr, ctx);
    expect(compiled).toBe('User.exists(x)');
  });
});
