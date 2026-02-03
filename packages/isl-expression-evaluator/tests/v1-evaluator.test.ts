// ============================================================================
// ISL Expression Evaluator v1 - Comprehensive Test Suite
// ============================================================================

import { describe, it, expect } from 'vitest';
import type { Expression } from '@isl-lang/parser';
import {
  evaluateV1 as evaluate,
  createEvalContext,
  createEvalAdapter,
  triAnd,
  triOr,
  triNot,
  triImplies,
  type EvalContext,
  type EvalKind,
} from '../src/index.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loc() {
  return { file: 'test.isl', line: 1, column: 1, endLine: 1, endColumn: 10 };
}

function bool(value: boolean): Expression {
  return { kind: 'BooleanLiteral', value, location: loc() };
}

function str(value: string): Expression {
  return { kind: 'StringLiteral', value, location: loc() };
}

function num(value: number): Expression {
  return { kind: 'NumberLiteral', value, isFloat: false, location: loc() };
}

function nullLit(): Expression {
  return { kind: 'NullLiteral', location: loc() };
}

function id(name: string): Expression {
  return { kind: 'Identifier', name, location: loc() };
}

function bin(op: string, left: Expression, right: Expression): Expression {
  return { kind: 'BinaryExpr', operator: op as any, left, right, location: loc() };
}

function unary(op: string, operand: Expression): Expression {
  return { kind: 'UnaryExpr', operator: op as any, operand, location: loc() };
}

function member(object: Expression, property: string): Expression {
  return { kind: 'MemberExpr', object, property: id(property) as any, location: loc() };
}

function call(callee: Expression, args: Expression[] = []): Expression {
  return { kind: 'CallExpr', callee, arguments: args, location: loc() };
}

function list(elements: Expression[]): Expression {
  return { kind: 'ListExpr', elements, location: loc() };
}

function quantifier(
  quant: 'all' | 'any',
  variable: string,
  collection: Expression,
  predicate: Expression
): Expression {
  return {
    kind: 'QuantifierExpr',
    quantifier: quant,
    variable: id(variable) as any,
    collection,
    predicate,
    location: loc(),
  };
}

function oldExpr(expression: Expression): Expression {
  return { kind: 'OldExpr', expression, location: loc() };
}

// ============================================================================
// TRI-STATE LOGIC UNIT TESTS
// ============================================================================

describe('Tri-State Logic Functions', () => {
  describe('triAnd', () => {
    it('should return true when both true', () => {
      expect(triAnd('true', 'true')).toBe('true');
    });

    it('should return false when either is false (false dominates)', () => {
      expect(triAnd('true', 'false')).toBe('false');
      expect(triAnd('false', 'true')).toBe('false');
      expect(triAnd('false', 'false')).toBe('false');
    });

    it('should return false when false and unknown (false dominates)', () => {
      expect(triAnd('false', 'unknown')).toBe('false');
      expect(triAnd('unknown', 'false')).toBe('false');
    });

    it('should return unknown when true and unknown', () => {
      expect(triAnd('true', 'unknown')).toBe('unknown');
      expect(triAnd('unknown', 'true')).toBe('unknown');
    });

    it('should return unknown when both unknown', () => {
      expect(triAnd('unknown', 'unknown')).toBe('unknown');
    });
  });

  describe('triOr', () => {
    it('should return true when either is true (true dominates)', () => {
      expect(triOr('true', 'true')).toBe('true');
      expect(triOr('true', 'false')).toBe('true');
      expect(triOr('false', 'true')).toBe('true');
    });

    it('should return true when true and unknown (true dominates)', () => {
      expect(triOr('true', 'unknown')).toBe('true');
      expect(triOr('unknown', 'true')).toBe('true');
    });

    it('should return false when both false', () => {
      expect(triOr('false', 'false')).toBe('false');
    });

    it('should return unknown when false and unknown', () => {
      expect(triOr('false', 'unknown')).toBe('unknown');
      expect(triOr('unknown', 'false')).toBe('unknown');
    });

    it('should return unknown when both unknown', () => {
      expect(triOr('unknown', 'unknown')).toBe('unknown');
    });
  });

  describe('triNot', () => {
    it('should negate true to false', () => {
      expect(triNot('true')).toBe('false');
    });

    it('should negate false to true', () => {
      expect(triNot('false')).toBe('true');
    });

    it('should preserve unknown', () => {
      expect(triNot('unknown')).toBe('unknown');
    });
  });

  describe('triImplies (!A || B)', () => {
    it('should return true when antecedent is false (vacuous truth)', () => {
      expect(triImplies('false', 'true')).toBe('true');
      expect(triImplies('false', 'false')).toBe('true');
      expect(triImplies('false', 'unknown')).toBe('true');
    });

    it('should return consequent when antecedent is true', () => {
      expect(triImplies('true', 'true')).toBe('true');
      expect(triImplies('true', 'false')).toBe('false');
      expect(triImplies('true', 'unknown')).toBe('unknown');
    });

    it('should return true when consequent is true (unknown antecedent)', () => {
      expect(triImplies('unknown', 'true')).toBe('true');
    });

    it('should return unknown otherwise', () => {
      expect(triImplies('unknown', 'false')).toBe('unknown');
      expect(triImplies('unknown', 'unknown')).toBe('unknown');
    });
  });
});

// ============================================================================
// LITERAL EVALUATION TESTS
// ============================================================================

describe('Literal Evaluation', () => {
  const ctx = createEvalContext();

  it('should evaluate true literal', () => {
    const result = evaluate(bool(true), ctx);
    expect(result.kind).toBe('true');
  });

  it('should evaluate false literal', () => {
    const result = evaluate(bool(false), ctx);
    expect(result.kind).toBe('false');
    expect(result.reason).toBeDefined();
  });

  it('should evaluate string literal as true', () => {
    const result = evaluate(str('hello'), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe('hello');
  });

  it('should evaluate number literal as true', () => {
    const result = evaluate(num(42), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(42);
  });

  it('should evaluate null literal as false', () => {
    const result = evaluate(nullLit(), ctx);
    expect(result.kind).toBe('false');
  });
});

// ============================================================================
// IDENTIFIER EVALUATION TESTS
// ============================================================================

describe('Identifier Evaluation', () => {
  it('should evaluate true identifier', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('true'), ctx);
    expect(result.kind).toBe('true');
  });

  it('should evaluate false identifier', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('false'), ctx);
    expect(result.kind).toBe('false');
  });

  it('should evaluate null identifier', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('null'), ctx);
    expect(result.kind).toBe('false');
  });

  it('should evaluate variable from context', () => {
    const ctx = createEvalContext({
      variables: new Map([['x', 42]]),
    });
    const result = evaluate(id('x'), ctx);
    expect(result.kind).toBe('true');
  });

  it('should evaluate boolean variable', () => {
    const ctx = createEvalContext({
      variables: new Map([['flag', true]]),
    });
    const result = evaluate(id('flag'), ctx);
    expect(result.kind).toBe('true');
  });

  it('should evaluate null variable as false', () => {
    const ctx = createEvalContext({
      variables: new Map([['x', null]]),
    });
    const result = evaluate(id('x'), ctx);
    expect(result.kind).toBe('false');
  });

  it('should evaluate undefined variable as unknown', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('undefinedVar'), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reason).toContain('Unknown identifier');
  });

  it('should evaluate input variable', () => {
    const ctx = createEvalContext({
      input: { userId: '123' },
    });
    const result = evaluate(id('userId'), ctx);
    expect(result.kind).toBe('true');
  });

  it('should evaluate result variable', () => {
    const ctx = createEvalContext({
      result: { success: true },
    });
    const result = evaluate(id('result'), ctx);
    expect(result.kind).toBe('true');
  });

  it('should return unknown for result when not set', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('result'), ctx);
    expect(result.kind).toBe('unknown');
  });
});

// ============================================================================
// COMPARISON OPERATOR TESTS
// ============================================================================

describe('Comparison Operators', () => {
  const ctx = createEvalContext();

  it('should evaluate == with equal numbers', () => {
    const result = evaluate(bin('==', num(5), num(5)), ctx);
    expect(result.kind).toBe('true');
  });

  it('should evaluate == with unequal numbers', () => {
    const result = evaluate(bin('==', num(5), num(10)), ctx);
    expect(result.kind).toBe('false');
  });

  it('should evaluate != with unequal numbers', () => {
    const result = evaluate(bin('!=', num(5), num(10)), ctx);
    expect(result.kind).toBe('true');
  });

  it('should evaluate != with equal numbers', () => {
    const result = evaluate(bin('!=', num(5), num(5)), ctx);
    expect(result.kind).toBe('false');
  });

  it('should evaluate < correctly', () => {
    expect(evaluate(bin('<', num(3), num(5)), ctx).kind).toBe('true');
    expect(evaluate(bin('<', num(5), num(3)), ctx).kind).toBe('false');
    expect(evaluate(bin('<', num(5), num(5)), ctx).kind).toBe('false');
  });

  it('should evaluate <= correctly', () => {
    expect(evaluate(bin('<=', num(3), num(5)), ctx).kind).toBe('true');
    expect(evaluate(bin('<=', num(5), num(5)), ctx).kind).toBe('true');
    expect(evaluate(bin('<=', num(5), num(3)), ctx).kind).toBe('false');
  });

  it('should evaluate > correctly', () => {
    expect(evaluate(bin('>', num(5), num(3)), ctx).kind).toBe('true');
    expect(evaluate(bin('>', num(3), num(5)), ctx).kind).toBe('false');
    expect(evaluate(bin('>', num(5), num(5)), ctx).kind).toBe('false');
  });

  it('should evaluate >= correctly', () => {
    expect(evaluate(bin('>=', num(5), num(3)), ctx).kind).toBe('true');
    expect(evaluate(bin('>=', num(5), num(5)), ctx).kind).toBe('true');
    expect(evaluate(bin('>=', num(3), num(5)), ctx).kind).toBe('false');
  });

  it('should compare strings with ==', () => {
    expect(evaluate(bin('==', str('hello'), str('hello')), ctx).kind).toBe('true');
    expect(evaluate(bin('==', str('hello'), str('world')), ctx).kind).toBe('false');
  });
});

// ============================================================================
// LOGICAL OPERATOR TESTS
// ============================================================================

describe('Logical Operators', () => {
  const ctx = createEvalContext();

  describe('AND', () => {
    it('should return true when both true', () => {
      const result = evaluate(bin('and', bool(true), bool(true)), ctx);
      expect(result.kind).toBe('true');
    });

    it('should return false when left is false', () => {
      const result = evaluate(bin('and', bool(false), bool(true)), ctx);
      expect(result.kind).toBe('false');
    });

    it('should return false when right is false', () => {
      const result = evaluate(bin('and', bool(true), bool(false)), ctx);
      expect(result.kind).toBe('false');
    });

    it('should return false when both false', () => {
      const result = evaluate(bin('and', bool(false), bool(false)), ctx);
      expect(result.kind).toBe('false');
    });
  });

  describe('OR', () => {
    it('should return true when both true', () => {
      const result = evaluate(bin('or', bool(true), bool(true)), ctx);
      expect(result.kind).toBe('true');
    });

    it('should return true when left is true', () => {
      const result = evaluate(bin('or', bool(true), bool(false)), ctx);
      expect(result.kind).toBe('true');
    });

    it('should return true when right is true', () => {
      const result = evaluate(bin('or', bool(false), bool(true)), ctx);
      expect(result.kind).toBe('true');
    });

    it('should return false when both false', () => {
      const result = evaluate(bin('or', bool(false), bool(false)), ctx);
      expect(result.kind).toBe('false');
    });
  });

  describe('NOT', () => {
    it('should negate true to false', () => {
      const result = evaluate(unary('not', bool(true)), ctx);
      expect(result.kind).toBe('false');
    });

    it('should negate false to true', () => {
      const result = evaluate(unary('not', bool(false)), ctx);
      expect(result.kind).toBe('true');
    });
  });

  describe('IMPLIES', () => {
    it('should return true when antecedent is false (vacuous truth)', () => {
      expect(evaluate(bin('implies', bool(false), bool(false)), ctx).kind).toBe('true');
      expect(evaluate(bin('implies', bool(false), bool(true)), ctx).kind).toBe('true');
    });

    it('should return consequent when antecedent is true', () => {
      expect(evaluate(bin('implies', bool(true), bool(true)), ctx).kind).toBe('true');
      expect(evaluate(bin('implies', bool(true), bool(false)), ctx).kind).toBe('false');
    });
  });
});

// ============================================================================
// UNKNOWN PROPAGATION TESTS (Critical Section)
// ============================================================================

describe('Unknown Propagation', () => {
  const ctx = createEvalContext();

  describe('AND unknown propagation', () => {
    it('should propagate unknown from left operand', () => {
      const result = evaluate(bin('and', id('unknownVar'), bool(true)), ctx);
      expect(result.kind).toBe('unknown');
    });

    it('should propagate unknown from right operand', () => {
      const result = evaluate(bin('and', bool(true), id('unknownVar')), ctx);
      expect(result.kind).toBe('unknown');
    });

    it('should return false when left is false (false dominates unknown)', () => {
      const result = evaluate(bin('and', bool(false), id('unknownVar')), ctx);
      expect(result.kind).toBe('false');
    });

    it('should propagate unknown with both unknown', () => {
      const result = evaluate(bin('and', id('x'), id('y')), ctx);
      expect(result.kind).toBe('unknown');
    });
  });

  describe('OR unknown propagation', () => {
    it('should propagate unknown from left operand', () => {
      const result = evaluate(bin('or', id('unknownVar'), bool(false)), ctx);
      expect(result.kind).toBe('unknown');
    });

    it('should propagate unknown from right operand', () => {
      const result = evaluate(bin('or', bool(false), id('unknownVar')), ctx);
      expect(result.kind).toBe('unknown');
    });

    it('should return true when left is true (true dominates unknown)', () => {
      const result = evaluate(bin('or', bool(true), id('unknownVar')), ctx);
      expect(result.kind).toBe('true');
    });

    it('should propagate unknown with both unknown', () => {
      const result = evaluate(bin('or', id('x'), id('y')), ctx);
      expect(result.kind).toBe('unknown');
    });
  });

  describe('NOT unknown propagation', () => {
    it('should propagate unknown through negation', () => {
      const result = evaluate(unary('not', id('unknownVar')), ctx);
      expect(result.kind).toBe('unknown');
    });
  });

  describe('IMPLIES unknown propagation', () => {
    it('should return true when antecedent is false (even with unknown consequent)', () => {
      const result = evaluate(bin('implies', bool(false), id('unknownVar')), ctx);
      expect(result.kind).toBe('true');
    });

    it('should propagate unknown when antecedent is true', () => {
      const result = evaluate(bin('implies', bool(true), id('unknownVar')), ctx);
      expect(result.kind).toBe('unknown');
    });

    it('should propagate unknown when antecedent is unknown', () => {
      const result = evaluate(bin('implies', id('unknownVar'), bool(true)), ctx);
      // unknown implies true = !unknown || true = unknown || true = true (true dominates)
      expect(result.kind).toBe('true');
    });

    it('should propagate unknown when both unknown', () => {
      const result = evaluate(bin('implies', id('x'), id('y')), ctx);
      expect(result.kind).toBe('unknown');
    });
  });

  describe('Comparison unknown propagation', () => {
    it('should return unknown when comparing with unknown', () => {
      expect(evaluate(bin('==', id('unknownVar'), num(5)), ctx).kind).toBe('unknown');
      expect(evaluate(bin('!=', id('unknownVar'), num(5)), ctx).kind).toBe('unknown');
      expect(evaluate(bin('<', id('unknownVar'), num(5)), ctx).kind).toBe('unknown');
      expect(evaluate(bin('<=', id('unknownVar'), num(5)), ctx).kind).toBe('unknown');
      expect(evaluate(bin('>', id('unknownVar'), num(5)), ctx).kind).toBe('unknown');
      expect(evaluate(bin('>=', id('unknownVar'), num(5)), ctx).kind).toBe('unknown');
    });
  });
});

// ============================================================================
// PROPERTY ACCESS TESTS
// ============================================================================

describe('Property Access (Safe Missing Property)', () => {
  it('should access existing property', () => {
    const ctx = createEvalContext({
      variables: new Map([['user', { name: 'Alice', age: 30 }]]),
    });
    const result = evaluate(member(id('user'), 'name'), ctx);
    expect(result.kind).toBe('true');
  });

  it('should return unknown for missing property (not crash)', () => {
    const ctx = createEvalContext({
      variables: new Map([['user', { name: 'Alice' }]]),
    });
    const result = evaluate(member(id('user'), 'missingProp'), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reason).toContain('not found');
  });

  it('should return unknown for null object property access', () => {
    const ctx = createEvalContext({
      variables: new Map([['user', null]]),
    });
    const result = evaluate(member(id('user'), 'name'), ctx);
    expect(result.kind).toBe('unknown');
  });

  it('should return unknown for undefined object property access', () => {
    const ctx = createEvalContext();
    const result = evaluate(member(id('undefinedObj'), 'name'), ctx);
    expect(result.kind).toBe('unknown');
  });

  it('should chain property access safely', () => {
    const adapter = createEvalAdapter({
      getProperty: (obj, prop) => {
        if (obj === null || obj === undefined) return 'unknown';
        if (typeof obj === 'object' && prop in obj) {
          return (obj as Record<string, unknown>)[prop];
        }
        return 'unknown';
      },
    });
    const ctx = createEvalContext({
      variables: new Map([['data', { user: { profile: { name: 'Alice' } } }]]),
      adapter,
    });
    const result = evaluate(member(member(member(id('data'), 'user'), 'profile'), 'name'), ctx);
    expect(result.kind).toBe('true');
  });
});

// ============================================================================
// QUANTIFIER TESTS
// ============================================================================

describe('Quantifiers', () => {
  describe('ALL quantifier', () => {
    it('should return true when all elements satisfy predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [1, 2, 3]]]),
      });
      const result = evaluate(
        quantifier('all', 'item', id('items'), bin('>', id('item'), num(0))),
        ctx
      );
      expect(result.kind).toBe('true');
    });

    it('should return false when one element fails predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [1, 2, -1]]]),
      });
      const result = evaluate(
        quantifier('all', 'item', id('items'), bin('>', id('item'), num(0))),
        ctx
      );
      expect(result.kind).toBe('false');
    });

    it('should return true for empty collection (vacuous truth)', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', []]]),
      });
      const result = evaluate(
        quantifier('all', 'item', id('items'), bool(true)),
        ctx
      );
      expect(result.kind).toBe('true');
    });

    it('should propagate unknown when predicate returns unknown', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [1, 'unknown', 3]]]),
      });
      // When item is 'unknown', the comparison will return unknown
      const result = evaluate(
        quantifier('all', 'item', id('items'), bin('>', id('item'), num(0))),
        ctx
      );
      // Since we're comparing 'unknown' > 0, that's unknown
      expect(result.kind).toBe('unknown');
    });
  });

  describe('ANY quantifier', () => {
    it('should return true when one element satisfies predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [-1, -2, 3]]]),
      });
      const result = evaluate(
        quantifier('any', 'item', id('items'), bin('>', id('item'), num(0))),
        ctx
      );
      expect(result.kind).toBe('true');
    });

    it('should return false when no elements satisfy predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [-1, -2, -3]]]),
      });
      const result = evaluate(
        quantifier('any', 'item', id('items'), bin('>', id('item'), num(0))),
        ctx
      );
      expect(result.kind).toBe('false');
    });

    it('should return false for empty collection', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', []]]),
      });
      const result = evaluate(
        quantifier('any', 'item', id('items'), bool(true)),
        ctx
      );
      expect(result.kind).toBe('false');
    });
  });

  it('should return unknown for unknown collection', () => {
    const ctx = createEvalContext();
    const result = evaluate(
      quantifier('all', 'item', id('unknownCollection'), bool(true)),
      ctx
    );
    expect(result.kind).toBe('unknown');
  });
});

// ============================================================================
// FUNCTION CALL TESTS
// ============================================================================

describe('Function Calls', () => {
  describe('is_valid()', () => {
    it('should evaluate is_valid for valid string', () => {
      const ctx = createEvalContext({
        variables: new Map([['email', 'test@example.com']]),
      });
      const result = evaluate(call(id('is_valid'), [id('email')]), ctx);
      expect(result.kind).toBe('true');
    });

    it('should evaluate is_valid for empty string', () => {
      const ctx = createEvalContext({
        variables: new Map([['email', '']]),
      });
      const result = evaluate(call(id('is_valid'), [id('email')]), ctx);
      expect(result.kind).toBe('false');
    });

    it('should return unknown for is_valid with unknown value', () => {
      const ctx = createEvalContext();
      const result = evaluate(call(id('is_valid'), [id('unknownVar')]), ctx);
      expect(result.kind).toBe('unknown');
    });
    
    it('should evaluate is_valid for null as false', () => {
      const ctx = createEvalContext({
        variables: new Map([['value', null]]),
      });
      const result = evaluate(call(id('is_valid'), [id('value')]), ctx);
      expect(result.kind).toBe('false');
    });
  });

  describe('length()', () => {
    it('should evaluate length for string', () => {
      const ctx = createEvalContext({
        variables: new Map([['str', 'hello']]),
      });
      const result = evaluate(call(id('length'), [id('str')]), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe(5);
    });

    it('should evaluate length for array', () => {
      const ctx = createEvalContext({
        variables: new Map([['arr', [1, 2, 3]]]),
      });
      const result = evaluate(call(id('length'), [id('arr')]), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe(3);
    });

    it('should return unknown for length of non-array/string', () => {
      const ctx = createEvalContext({
        variables: new Map([['num', 42]]),
      });
      const result = evaluate(call(id('length'), [id('num')]), ctx);
      expect(result.kind).toBe('unknown');
    });
    
    it('should evaluate length for empty string', () => {
      const ctx = createEvalContext({
        variables: new Map([['str', '']]),
      });
      const result = evaluate(call(id('length'), [id('str')]), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe(0);
    });
  });
  
  describe('now()', () => {
    it('should return current timestamp', () => {
      const ctx = createEvalContext();
      const before = Date.now();
      const result = evaluate(call(id('now'), []), ctx);
      const after = Date.now();
      
      expect(result.kind).toBe('true');
      expect(typeof result.evidence).toBe('number');
      expect(result.evidence as number).toBeGreaterThanOrEqual(before);
      expect(result.evidence as number).toBeLessThanOrEqual(after);
    });
  });
  
  describe('is_valid_format()', () => {
    it('should validate email format', () => {
      const ctx = createEvalContext({
        variables: new Map([['email', 'test@example.com']]),
      });
      const result = evaluate(call(id('is_valid_format'), [id('email'), str('email')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should reject invalid email format', () => {
      const ctx = createEvalContext({
        variables: new Map([['email', 'not-an-email']]),
      });
      const result = evaluate(call(id('is_valid_format'), [id('email'), str('email')]), ctx);
      expect(result.kind).toBe('false');
    });
    
    it('should validate uuid format', () => {
      const ctx = createEvalContext({
        variables: new Map([['id', '550e8400-e29b-41d4-a716-446655440000']]),
      });
      const result = evaluate(call(id('is_valid_format'), [id('id'), str('uuid')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should validate url format', () => {
      const ctx = createEvalContext({
        variables: new Map([['url', 'https://example.com/path']]),
      });
      const result = evaluate(call(id('is_valid_format'), [id('url'), str('url')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should validate date format', () => {
      const ctx = createEvalContext({
        variables: new Map([['date', '2024-01-15']]),
      });
      const result = evaluate(call(id('is_valid_format'), [id('date'), str('date')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should validate iso8601 format', () => {
      const ctx = createEvalContext({
        variables: new Map([['timestamp', '2024-01-15T10:30:00Z']]),
      });
      const result = evaluate(call(id('is_valid_format'), [id('timestamp'), str('iso8601')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should return unknown for unknown value', () => {
      const ctx = createEvalContext();
      const result = evaluate(call(id('is_valid_format'), [id('unknownVar'), str('email')]), ctx);
      expect(result.kind).toBe('unknown');
    });
    
    it('should use custom regex pattern', () => {
      const ctx = createEvalContext({
        variables: new Map([['code', 'ABC-123']]),
      });
      const result = evaluate(call(id('is_valid_format'), [id('code'), str('^[A-Z]+-\\d+$')]), ctx);
      expect(result.kind).toBe('true');
    });
  });
  
  describe('regex()', () => {
    it('should match simple pattern', () => {
      const ctx = createEvalContext({
        variables: new Map([['str', 'hello world']]),
      });
      const result = evaluate(call(id('regex'), [id('str'), str('world$')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should not match when pattern fails', () => {
      const ctx = createEvalContext({
        variables: new Map([['str', 'hello']]),
      });
      const result = evaluate(call(id('regex'), [id('str'), str('^goodbye')]), ctx);
      expect(result.kind).toBe('false');
    });
    
    it('should return unknown for invalid regex', () => {
      const ctx = createEvalContext({
        variables: new Map([['str', 'hello']]),
      });
      const result = evaluate(call(id('regex'), [id('str'), str('[invalid')]), ctx);
      expect(result.kind).toBe('unknown');
    });
  });
  
  describe('contains()', () => {
    it('should find value in array', () => {
      const ctx = createEvalContext({
        variables: new Map([['arr', [1, 2, 3, 4, 5]]]),
      });
      const result = evaluate(call(id('contains'), [id('arr'), num(3)]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should not find missing value in array', () => {
      const ctx = createEvalContext({
        variables: new Map([['arr', [1, 2, 3]]]),
      });
      const result = evaluate(call(id('contains'), [id('arr'), num(10)]), ctx);
      expect(result.kind).toBe('false');
    });
    
    it('should find string in array', () => {
      const ctx = createEvalContext({
        variables: new Map([['arr', ['a', 'b', 'c']]]),
      });
      const result = evaluate(call(id('contains'), [id('arr'), str('b')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should return false for non-array', () => {
      const ctx = createEvalContext({
        variables: new Map([['notArr', 'hello']]),
      });
      const result = evaluate(call(id('contains'), [id('notArr'), str('e')]), ctx);
      expect(result.kind).toBe('false');
    });
  });
});

// ============================================================================
// SYMBOLIC OPERATORS TESTS
// ============================================================================

describe('Symbolic Operators', () => {
  const ctx = createEvalContext();
  
  describe('&& (AND)', () => {
    it('should work like and operator', () => {
      expect(evaluate(bin('&&', bool(true), bool(true)), ctx).kind).toBe('true');
      expect(evaluate(bin('&&', bool(true), bool(false)), ctx).kind).toBe('false');
      expect(evaluate(bin('&&', bool(false), bool(true)), ctx).kind).toBe('false');
    });
    
    it('should propagate unknown', () => {
      expect(evaluate(bin('&&', bool(true), id('unknownVar')), ctx).kind).toBe('unknown');
      expect(evaluate(bin('&&', bool(false), id('unknownVar')), ctx).kind).toBe('false');
    });
  });
  
  describe('|| (OR)', () => {
    it('should work like or operator', () => {
      expect(evaluate(bin('||', bool(true), bool(false)), ctx).kind).toBe('true');
      expect(evaluate(bin('||', bool(false), bool(false)), ctx).kind).toBe('false');
    });
    
    it('should propagate unknown', () => {
      expect(evaluate(bin('||', bool(false), id('unknownVar')), ctx).kind).toBe('unknown');
      expect(evaluate(bin('||', bool(true), id('unknownVar')), ctx).kind).toBe('true');
    });
  });
  
  describe('! (NOT)', () => {
    it('should work like not operator', () => {
      expect(evaluate(unary('!', bool(true)), ctx).kind).toBe('false');
      expect(evaluate(unary('!', bool(false)), ctx).kind).toBe('true');
    });
    
    it('should propagate unknown', () => {
      expect(evaluate(unary('!', id('unknownVar')), ctx).kind).toBe('unknown');
    });
  });
});

// ============================================================================
// OPERATOR PRECEDENCE TESTS
// ============================================================================

describe('Operator Precedence', () => {
  const ctx = createEvalContext();
  
  it('should evaluate NOT before AND', () => {
    // !false && true = true && true = true
    const expr = bin('and', unary('not', bool(false)), bool(true));
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should evaluate AND before OR', () => {
    // true || false && false = true || (false && false) = true || false = true
    // If we have: true || (false && false) = true
    const expr = bin('or', bool(true), bin('and', bool(false), bool(false)));
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should evaluate comparison before logical', () => {
    // 5 > 3 && 2 < 4 = true && true = true
    const expr = bin('and', bin('>', num(5), num(3)), bin('<', num(2), num(4)));
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should handle mixed symbolic and word operators', () => {
    // true && false || true = false || true = true
    const expr = bin('or', bin('&&', bool(true), bool(false)), bool(true));
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should handle double negation', () => {
    // !!true = !false = true
    const expr = unary('!', unary('!', bool(true)));
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should handle negation with comparison', () => {
    // !(5 == 5) = !true = false
    const expr = unary('not', bin('==', num(5), num(5)));
    expect(evaluate(expr, ctx).kind).toBe('false');
  });
  
  it('should handle implies with nested expressions', () => {
    // (x > 0) implies (x != 0) should be true for x = 5
    const ctxWithX = createEvalContext({ variables: new Map([['x', 5]]) });
    const expr = bin('implies', bin('>', id('x'), num(0)), bin('!=', id('x'), num(0)));
    expect(evaluate(expr, ctxWithX).kind).toBe('true');
  });
});

// ============================================================================
// COMPLEX EXPRESSION TESTS
// ============================================================================

describe('Complex Expressions', () => {
  it('should handle nested AND and OR', () => {
    const ctx = createEvalContext();
    const expr = bin('or',
      bin('and', bool(true), bool(false)),
      bin('and', bool(true), bool(true))
    );
    const result = evaluate(expr, ctx);
    expect(result.kind).toBe('true');
  });

  it('should handle chained comparisons', () => {
    const ctx = createEvalContext();
    const expr = bin('and',
      bin('<', num(1), num(5)),
      bin('<', num(5), num(10))
    );
    const result = evaluate(expr, ctx);
    expect(result.kind).toBe('true');
  });

  it('should handle implies with comparisons', () => {
    const ctx = createEvalContext();
    const expr = bin('implies',
      bin('>', num(10), num(5)),
      bin('<', num(3), num(5))
    );
    const result = evaluate(expr, ctx);
    expect(result.kind).toBe('true');
  });

  it('should handle deeply nested expressions', () => {
    const ctx = createEvalContext();
    // (true && true) || false = true
    // true implies !false = true implies true = true
    // true && true = true
    const expr = bin('and',
      bin('or',
        bin('and', bool(true), bool(true)),
        bool(false)
      ),
      bin('implies',
        bool(true),
        unary('not', bool(false))
      )
    );
    const result = evaluate(expr, ctx);
    expect(result.kind).toBe('true');
  });
});

// ============================================================================
// INPUT AND RESULT ACCESS TESTS
// ============================================================================

describe('Input and Result Access', () => {
  it('should access input object directly', () => {
    const ctx = createEvalContext({
      input: { email: 'test@example.com', password: 'secret' },
    });
    const result = evaluate(id('input'), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toEqual({ email: 'test@example.com', password: 'secret' });
  });
  
  it('should access input.* properties', () => {
    const ctx = createEvalContext({
      input: { email: 'test@example.com' },
    });
    const result = evaluate(member(id('input'), 'email'), ctx);
    expect(result.kind).toBe('true');
  });
  
  it('should access nested input properties', () => {
    const ctx = createEvalContext({
      input: { user: { profile: { name: 'Alice' } } },
    });
    const result = evaluate(member(member(member(id('input'), 'user'), 'profile'), 'name'), ctx);
    expect(result.kind).toBe('true');
  });
  
  it('should access result object', () => {
    const ctx = createEvalContext({
      result: { session: { id: '123', status: 'ACTIVE' } },
    });
    const result = evaluate(id('result'), ctx);
    expect(result.kind).toBe('true');
  });
  
  it('should access result.* properties', () => {
    const ctx = createEvalContext({
      result: { session: { id: '123', status: 'ACTIVE' } },
    });
    const result = evaluate(member(member(id('result'), 'session'), 'status'), ctx);
    expect(result.kind).toBe('true');
  });
  
  it('should compare result properties', () => {
    const ctx = createEvalContext({
      result: { session: { status: 'ACTIVE' } },
    });
    const result = evaluate(
      bin('==', member(member(id('result'), 'session'), 'status'), str('ACTIVE')),
      ctx
    );
    expect(result.kind).toBe('true');
  });
  
  it('should handle error variants', () => {
    const ctx = createEvalContext({
      variables: new Map([['error', 'INVALID_CREDENTIALS']]),
    });
    const result = evaluate(bin('==', id('error'), str('INVALID_CREDENTIALS')), ctx);
    expect(result.kind).toBe('true');
  });
  
  it('should return unknown for missing input', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('input'), ctx);
    expect(result.kind).toBe('unknown');
  });
  
  it('should return unknown for missing result', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('result'), ctx);
    expect(result.kind).toBe('unknown');
  });
});

// ============================================================================
// OLD EXPRESSION TESTS
// ============================================================================

describe('Old Expression (Postconditions)', () => {
  it('should access old state values', () => {
    const ctx = createEvalContext({
      oldState: new Map([['counter', 5]]),
      variables: new Map([['counter', 10]]),
    });
    const result = evaluate(oldExpr(id('counter')), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(5);
  });
  
  it('should compare old and new values', () => {
    const ctx = createEvalContext({
      oldState: new Map([['balance', 100]]),
      variables: new Map([['balance', 150]]),
    });
    // balance > old(balance)
    const result = evaluate(
      bin('>', id('balance'), oldExpr(id('balance'))),
      ctx
    );
    expect(result.kind).toBe('true');
  });
  
  it('should return unknown when old state not available', () => {
    const ctx = createEvalContext({
      variables: new Map([['counter', 10]]),
    });
    const result = evaluate(oldExpr(id('counter')), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reason).toContain('old()');
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle maximum depth exceeded', () => {
    const ctx = createEvalContext({ maxDepth: 3 });
    // Create deeply nested AND expression
    // With maxDepth 3, the 4th level should fail
    const expr = bin('and',
      bin('and',
        bin('and',
          bin('and', bool(true), bool(true)), // depth 4 - should fail
          bool(true)
        ),
        bool(true)
      ),
      bool(true)
    );
    const result = evaluate(expr, ctx);
    // When depth is exceeded, it returns a fail result
    expect(result.kind).toBe('false');
    expect(result.reason).toBeDefined();
  });

  it('should handle list expressions', () => {
    const ctx = createEvalContext();
    const result = evaluate(list([num(1), num(2), num(3)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toEqual([1, 2, 3]);
  });

  it('should handle unary minus', () => {
    const ctx = createEvalContext();
    const result = evaluate(unary('-', num(5)), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(-5);
  });

  it('should fail unary minus on non-number', () => {
    const ctx = createEvalContext({
      variables: new Map([['str', 'hello']]),
    });
    const result = evaluate(unary('-', id('str')), ctx);
    expect(result.kind).toBe('false');
  });

  it('should return unknown for unsupported expression kind', () => {
    const ctx = createEvalContext();
    const expr = { kind: 'UnsupportedExpr', location: loc() } as Expression;
    const result = evaluate(expr, ctx);
    expect(result.kind).toBe('unknown');
  });
  
  it('should handle empty list', () => {
    const ctx = createEvalContext();
    const result = evaluate(list([]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toEqual([]);
  });
  
  it('should handle comparison with null', () => {
    const ctx = createEvalContext({
      variables: new Map([['value', null]]),
    });
    const result = evaluate(bin('==', id('value'), nullLit()), ctx);
    expect(result.kind).toBe('true');
  });
});

// ============================================================================
// BENCHMARK / REGRESSION TESTS
// ============================================================================

describe('Performance', () => {
  it('should evaluate 1000 simple comparisons under 100ms', () => {
    const ctx = createEvalContext();
    const expressions: Expression[] = [];
    
    for (let i = 0; i < 1000; i++) {
      expressions.push(bin('==', num(i), num(i)));
    }
    
    const start = performance.now();
    for (const expr of expressions) {
      evaluate(expr, ctx);
    }
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });

  it('should evaluate 1000 complex expressions under 100ms', () => {
    const ctx = createEvalContext({
      variables: new Map([['x', 5], ['y', 10]]),
    });
    const expressions: Expression[] = [];
    
    for (let i = 0; i < 1000; i++) {
      expressions.push(
        bin('and',
          bin('>', id('x'), num(0)),
          bin('<', id('y'), num(20))
        )
      );
    }
    
    const start = performance.now();
    for (const expr of expressions) {
      evaluate(expr, ctx);
    }
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('should evaluate 1000 property access expressions under 100ms', () => {
    const ctx = createEvalContext({
      input: { user: { profile: { name: 'Alice', age: 30 } } },
    });
    const expressions: Expression[] = [];
    
    for (let i = 0; i < 1000; i++) {
      expressions.push(
        bin('==',
          member(member(member(id('input'), 'user'), 'profile'), 'name'),
          str('Alice')
        )
      );
    }
    
    const start = performance.now();
    for (const expr of expressions) {
      evaluate(expr, ctx);
    }
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('should evaluate 1000 function calls under 100ms', () => {
    const ctx = createEvalContext({
      variables: new Map([['str', 'hello@example.com']]),
    });
    const expressions: Expression[] = [];
    
    for (let i = 0; i < 1000; i++) {
      expressions.push(call(id('is_valid_format'), [id('str'), str('email')]));
    }
    
    const start = performance.now();
    for (const expr of expressions) {
      evaluate(expr, ctx);
    }
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('should evaluate 1000 implies expressions under 100ms', () => {
    const ctx = createEvalContext({
      variables: new Map([['success', true], ['sessionActive', true]]),
    });
    const expressions: Expression[] = [];
    
    for (let i = 0; i < 1000; i++) {
      expressions.push(
        bin('implies', id('success'), id('sessionActive'))
      );
    }
    
    const start = performance.now();
    for (const expr of expressions) {
      evaluate(expr, ctx);
    }
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
});

// ============================================================================
// STDLIB-AUTH LOGIN POSTCONDITION SIMULATION
// ============================================================================

describe('stdlib-auth Login Postconditions', () => {
  it('should evaluate: success implies result.session.status == ACTIVE', () => {
    const ctx = createEvalContext({
      variables: new Map([['success', true]]),
      result: { session: { status: 'ACTIVE', id: 'sess-123' } },
    });
    
    const expr = bin('implies',
      id('success'),
      bin('==', member(member(id('result'), 'session'), 'status'), str('ACTIVE'))
    );
    
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should evaluate: result.token.length >= 64', () => {
    const ctx = createEvalContext({
      result: { token: 'a'.repeat(64) },
    });
    
    // length(result.token) >= 64
    const expr = bin('>=',
      call(id('length'), [member(id('result'), 'token')]),
      num(64)
    );
    
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should evaluate: error == INVALID_CREDENTIALS implies no session', () => {
    const ctx = createEvalContext({
      variables: new Map([
        ['error', 'INVALID_CREDENTIALS'],
        ['sessionCreated', false],
      ]),
    });
    
    const expr = bin('implies',
      bin('==', id('error'), str('INVALID_CREDENTIALS')),
      bin('==', id('sessionCreated'), bool(false))
    );
    
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should evaluate: is_valid_format(input.email, "email")', () => {
    const ctx = createEvalContext({
      input: { email: 'user@example.com' },
    });
    
    const expr = call(id('is_valid_format'), [
      member(id('input'), 'email'),
      str('email'),
    ]);
    
    expect(evaluate(expr, ctx).kind).toBe('true');
  });
  
  it('should return unknown for unresolvable domain lookup', () => {
    const ctx = createEvalContext();
    
    // User.exists({ id: result.user.id }) - unknown without domain adapter
    const expr = call(member(id('User'), 'exists'), [
      member(member(id('result'), 'user'), 'id'),
    ]);
    
    expect(evaluate(expr, ctx).kind).toBe('unknown');
  });
});
