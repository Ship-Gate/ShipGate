// ============================================================================
// ISL Expression Evaluator v1 - Enhanced Test Suite
// Tests for: arithmetic, new expression types, structured unknowns, constant folding
// ============================================================================

import { describe, it, expect } from 'vitest';
import type { Expression } from '@isl-lang/parser';
import {
  evaluateV1 as evaluate,
  createEvalContext,
  foldConstants,
  isConstant,
  analyzeExpression,
  getCoverageReport,
  type EvalContext,
  type EvalResult,
  type UnknownReasonCode,
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
  return { kind: 'NumberLiteral', value, isFloat: !Number.isInteger(value), location: loc() };
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

function mapExpr(entries: Array<{ key: Expression; value: Expression }>): Expression {
  return {
    kind: 'MapExpr',
    entries: entries.map(e => ({ kind: 'MapEntry', key: e.key, value: e.value, location: loc() })),
    location: loc(),
  };
}

function indexExpr(object: Expression, index: Expression): Expression {
  return { kind: 'IndexExpr', object, index, location: loc() };
}

function conditional(condition: Expression, thenBranch: Expression, elseBranch: Expression): Expression {
  return { kind: 'ConditionalExpr', condition, thenBranch, elseBranch, location: loc() };
}

function duration(value: number, unit: string): Expression {
  return { kind: 'DurationLiteral', value, unit, location: loc() };
}

function regex(pattern: string, flags: string = ''): Expression {
  return { kind: 'RegexLiteral', pattern, flags, location: loc() };
}

function qualifiedName(...parts: string[]): Expression {
  return {
    kind: 'QualifiedName',
    parts: parts.map(name => ({ kind: 'Identifier', name, location: loc() })),
    location: loc(),
  };
}

function quantifier(
  quant: 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter',
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

function inputExpr(property: string): Expression {
  return { kind: 'InputExpr', property: { kind: 'Identifier', name: property, location: loc() }, location: loc() };
}

function resultExpr(property?: string): Expression {
  return {
    kind: 'ResultExpr',
    property: property ? { kind: 'Identifier', name: property, location: loc() } : undefined,
    location: loc(),
  };
}

function lambdaExpr(params: string[], body: Expression): Expression {
  return {
    kind: 'LambdaExpr',
    params: params.map(name => ({ kind: 'Identifier', name, location: loc() })),
    body,
    location: loc(),
  };
}

// ============================================================================
// GOLDEN TESTS - Expected Results
// ============================================================================

describe('Golden Tests - Expression Evaluation', () => {
  describe('Arithmetic Operations', () => {
    const ctx = createEvalContext();
    
    const goldenTests: Array<{ expr: Expression; expected: { kind: string; value?: unknown } }> = [
      // Addition
      { expr: bin('+', num(2), num(3)), expected: { kind: 'true', value: 5 } },
      { expr: bin('+', num(-1), num(1)), expected: { kind: 'true', value: 0 } },
      { expr: bin('+', num(1.5), num(2.5)), expected: { kind: 'true', value: 4 } },
      
      // String concatenation
      { expr: bin('+', str('hello'), str(' world')), expected: { kind: 'true', value: 'hello world' } },
      { expr: bin('+', str('count: '), num(42)), expected: { kind: 'true', value: 'count: 42' } },
      
      // Subtraction
      { expr: bin('-', num(10), num(3)), expected: { kind: 'true', value: 7 } },
      { expr: bin('-', num(0), num(5)), expected: { kind: 'true', value: -5 } },
      
      // Multiplication
      { expr: bin('*', num(4), num(5)), expected: { kind: 'true', value: 20 } },
      { expr: bin('*', num(-2), num(3)), expected: { kind: 'true', value: -6 } },
      
      // Division
      { expr: bin('/', num(10), num(2)), expected: { kind: 'true', value: 5 } },
      { expr: bin('/', num(7), num(2)), expected: { kind: 'true', value: 3.5 } },
      
      // Modulo
      { expr: bin('%', num(10), num(3)), expected: { kind: 'true', value: 1 } },
      { expr: bin('%', num(15), num(5)), expected: { kind: 'true', value: 0 } },
    ];
    
    goldenTests.forEach(({ expr, expected }, i) => {
      it(`arithmetic test ${i + 1}`, () => {
        const result = evaluate(expr, ctx);
        expect(result.kind).toBe(expected.kind);
        if (expected.value !== undefined) {
          expect(result.evidence).toBe(expected.value);
        }
      });
    });
  });

  describe('Division by Zero', () => {
    const ctx = createEvalContext();
    
    it('should return unknown with DIVISION_BY_ZERO for division', () => {
      const result = evaluate(bin('/', num(10), num(0)), ctx);
      expect(result.kind).toBe('unknown');
      expect(result.reasonCode).toBe('DIVISION_BY_ZERO');
    });
    
    it('should return unknown with DIVISION_BY_ZERO for modulo', () => {
      const result = evaluate(bin('%', num(10), num(0)), ctx);
      expect(result.kind).toBe('unknown');
      expect(result.reasonCode).toBe('DIVISION_BY_ZERO');
    });
  });

  describe('Membership Operator (in)', () => {
    const ctx = createEvalContext();
    
    it('should find element in array', () => {
      const result = evaluate(bin('in', num(2), list([num(1), num(2), num(3)])), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should not find element not in array', () => {
      const result = evaluate(bin('in', num(5), list([num(1), num(2), num(3)])), ctx);
      expect(result.kind).toBe('false');
    });
    
    it('should find substring in string', () => {
      const result = evaluate(bin('in', str('world'), str('hello world')), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should find key in object', () => {
      const ctx = createEvalContext({
        variables: new Map([['obj', { name: 'test', value: 42 }]]),
      });
      const result = evaluate(bin('in', str('name'), id('obj')), ctx);
      expect(result.kind).toBe('true');
    });
  });

  describe('IFF (Biconditional)', () => {
    const ctx = createEvalContext();
    
    it('should return true when both true', () => {
      const result = evaluate(bin('iff', bool(true), bool(true)), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should return true when both false', () => {
      const result = evaluate(bin('iff', bool(false), bool(false)), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should return false when different', () => {
      const result = evaluate(bin('iff', bool(true), bool(false)), ctx);
      expect(result.kind).toBe('false');
    });
  });
});

// ============================================================================
// NEW EXPRESSION TYPES TESTS
// ============================================================================

describe('New Expression Types', () => {
  describe('IndexExpr', () => {
    it('should access array elements', () => {
      const ctx = createEvalContext({
        variables: new Map([['arr', [10, 20, 30]]]),
      });
      const result = evaluate(indexExpr(id('arr'), num(1)), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe(20);
    });
    
    it('should access string characters', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'hello']]),
      });
      const result = evaluate(indexExpr(id('s'), num(0)), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('h');
    });
    
    it('should access object properties by key', () => {
      const ctx = createEvalContext({
        variables: new Map([['obj', { name: 'test' }]]),
      });
      const result = evaluate(indexExpr(id('obj'), str('name')), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('test');
    });
    
    it('should fail on out of bounds array access', () => {
      const ctx = createEvalContext({
        variables: new Map([['arr', [1, 2]]]),
      });
      const result = evaluate(indexExpr(id('arr'), num(10)), ctx);
      expect(result.kind).toBe('false');
    });
  });

  describe('ConditionalExpr (Ternary)', () => {
    const ctx = createEvalContext();
    
    it('should evaluate then branch when condition is true', () => {
      const result = evaluate(conditional(bool(true), num(1), num(2)), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe(1);
    });
    
    it('should evaluate else branch when condition is false', () => {
      const result = evaluate(conditional(bool(false), num(1), num(2)), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe(2);
    });
    
    it('should return unknown when condition is unknown', () => {
      const result = evaluate(conditional(id('unknown_var'), num(1), num(2)), ctx);
      expect(result.kind).toBe('unknown');
      expect(result.reasonCode).toBe('PROPAGATED');
    });
  });

  describe('MapExpr', () => {
    const ctx = createEvalContext();
    
    it('should create a map from key-value pairs', () => {
      const result = evaluate(mapExpr([
        { key: str('name'), value: str('John') },
        { key: str('age'), value: num(30) },
      ]), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('DurationLiteral', () => {
    const ctx = createEvalContext();
    
    it('should parse seconds to milliseconds', () => {
      const result = evaluate(duration(5, 'seconds'), ctx);
      expect(result.kind).toBe('true');
      expect((result.evidence as any).milliseconds).toBe(5000);
    });
    
    it('should parse minutes to milliseconds', () => {
      const result = evaluate(duration(2, 'minutes'), ctx);
      expect(result.kind).toBe('true');
      expect((result.evidence as any).milliseconds).toBe(120000);
    });
  });

  describe('RegexLiteral', () => {
    const ctx = createEvalContext();
    
    it('should create a regex pattern', () => {
      const result = evaluate(regex('[a-z]+', 'i'), ctx);
      expect(result.kind).toBe('true');
      expect((result.evidence as any).type).toBe('regex');
      expect((result.evidence as any).pattern).toBe('[a-z]+');
    });
    
    it('should return unknown for invalid pattern', () => {
      const result = evaluate(regex('[invalid(', ''), ctx);
      expect(result.kind).toBe('unknown');
      expect(result.reasonCode).toBe('INVALID_PATTERN');
    });
  });

  describe('QualifiedName', () => {
    it('should access nested properties', () => {
      const ctx = createEvalContext({
        input: { user: { profile: { name: 'John' } } },
      });
      const result = evaluate(qualifiedName('user', 'profile', 'name'), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('John');
    });
    
    it('should return unknown for missing property', () => {
      const ctx = createEvalContext({
        input: { user: { name: 'John' } },
      });
      const result = evaluate(qualifiedName('user', 'profile', 'name'), ctx);
      expect(result.kind).toBe('unknown');
      expect(result.reasonCode).toBe('MISSING_PROPERTY');
    });
  });

  describe('InputExpr', () => {
    it('should access input properties', () => {
      const ctx = createEvalContext({
        input: { email: 'test@example.com' },
      });
      const result = evaluate(inputExpr('email'), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('test@example.com');
    });
    
    it('should return unknown for missing input', () => {
      const ctx = createEvalContext({ input: {} });
      const result = evaluate(inputExpr('missing'), ctx);
      expect(result.kind).toBe('unknown');
      expect(result.reasonCode).toBe('MISSING_INPUT');
    });
  });

  describe('ResultExpr', () => {
    it('should access result value', () => {
      const ctx = createEvalContext({
        result: { id: 123, status: 'success' },
      });
      const result = evaluate(resultExpr(), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toEqual({ id: 123, status: 'success' });
    });
    
    it('should access result property', () => {
      const ctx = createEvalContext({
        result: { id: 123, status: 'success' },
      });
      const result = evaluate(resultExpr('status'), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('success');
    });
  });

  describe('LambdaExpr', () => {
    const ctx = createEvalContext();
    
    it('should return lambda as a value', () => {
      const result = evaluate(lambdaExpr(['x'], bin('+', id('x'), num(1))), ctx);
      expect(result.kind).toBe('true');
      expect((result.evidence as any).type).toBe('lambda');
      expect((result.evidence as any).params).toEqual(['x']);
    });
  });
});

// ============================================================================
// EXTENDED QUANTIFIER TESTS
// ============================================================================

describe('Extended Quantifiers', () => {
  describe('none quantifier', () => {
    it('should return true when no elements satisfy predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [1, 2, 3]]]),
      });
      const result = evaluate(
        quantifier('none', 'x', id('items'), bin('>', id('x'), num(10))),
        ctx
      );
      expect(result.kind).toBe('true');
    });
    
    it('should return false when some elements satisfy predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [1, 5, 15]]]),
      });
      const result = evaluate(
        quantifier('none', 'x', id('items'), bin('>', id('x'), num(10))),
        ctx
      );
      expect(result.kind).toBe('false');
    });
  });

  describe('count quantifier', () => {
    it('should count elements satisfying predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [1, 5, 10, 15, 20]]]),
      });
      const result = evaluate(
        quantifier('count', 'x', id('items'), bin('>', id('x'), num(8))),
        ctx
      );
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe(3); // 10, 15, 20
    });
  });

  describe('filter quantifier', () => {
    it('should filter elements by predicate', () => {
      const ctx = createEvalContext({
        variables: new Map([['items', [1, 2, 3, 4, 5]]]),
      });
      const result = evaluate(
        quantifier('filter', 'x', id('items'), bin('>', id('x'), num(2))),
        ctx
      );
      expect(result.kind).toBe('true');
      expect(result.evidence).toEqual([3, 4, 5]);
    });
  });
});

// ============================================================================
// STRING METHOD TESTS
// ============================================================================

describe('String Methods', () => {
  describe('startsWith', () => {
    it('should return true when string starts with prefix', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'hello world']]),
      });
      const result = evaluate(call(member(id('s'), 'startsWith'), [str('hello')]), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('should return false when string does not start with prefix', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'hello world']]),
      });
      const result = evaluate(call(member(id('s'), 'startsWith'), [str('world')]), ctx);
      expect(result.kind).toBe('false');
    });
  });

  describe('endsWith', () => {
    it('should return true when string ends with suffix', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'hello world']]),
      });
      const result = evaluate(call(member(id('s'), 'endsWith'), [str('world')]), ctx);
      expect(result.kind).toBe('true');
    });
  });

  describe('includes', () => {
    it('should return true when string contains substring', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'hello world']]),
      });
      const result = evaluate(call(member(id('s'), 'includes'), [str('lo wo')]), ctx);
      expect(result.kind).toBe('true');
    });
  });

  describe('trim', () => {
    it('should trim whitespace', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', '  hello  ']]),
      });
      const result = evaluate(call(member(id('s'), 'trim'), []), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('hello');
    });
  });

  describe('split', () => {
    it('should split string by delimiter', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'a,b,c']]),
      });
      const result = evaluate(call(member(id('s'), 'split'), [str(',')]), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toEqual(['a', 'b', 'c']);
    });
  });

  describe('toLowerCase/toUpperCase', () => {
    it('should convert to lower case', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'HELLO']]),
      });
      const result = evaluate(call(member(id('s'), 'toLowerCase'), []), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('hello');
    });
    
    it('should convert to upper case', () => {
      const ctx = createEvalContext({
        variables: new Map([['s', 'hello']]),
      });
      const result = evaluate(call(member(id('s'), 'toUpperCase'), []), ctx);
      expect(result.kind).toBe('true');
      expect(result.evidence).toBe('HELLO');
    });
  });
});

// ============================================================================
// MATH FUNCTION TESTS
// ============================================================================

describe('Math Functions', () => {
  const ctx = createEvalContext();
  
  it('abs should return absolute value', () => {
    const result = evaluate(call(id('abs'), [num(-5)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(5);
  });
  
  it('ceil should round up', () => {
    const result = evaluate(call(id('ceil'), [num(4.2)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(5);
  });
  
  it('floor should round down', () => {
    const result = evaluate(call(id('floor'), [num(4.8)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(4);
  });
  
  it('round should round to nearest', () => {
    const result = evaluate(call(id('round'), [num(4.5)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(5);
  });
  
  it('min should return minimum', () => {
    const result = evaluate(call(id('min'), [num(3), num(1), num(5)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(1);
  });
  
  it('max should return maximum', () => {
    const result = evaluate(call(id('max'), [num(3), num(1), num(5)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(5);
  });
  
  it('pow should compute power', () => {
    const result = evaluate(call(id('pow'), [num(2), num(3)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(8);
  });
  
  it('sqrt should compute square root', () => {
    const result = evaluate(call(id('sqrt'), [num(16)]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(4);
  });
});

// ============================================================================
// STRUCTURED UNKNOWN REASON TESTS
// ============================================================================

describe('Structured Unknown Reasons', () => {
  it('should provide MISSING_BINDING for unknown identifier', () => {
    const ctx = createEvalContext();
    const result = evaluate(id('unknownVar'), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reasonCode).toBe('MISSING_BINDING');
  });
  
  it('should provide MISSING_INPUT for missing input', () => {
    const ctx = createEvalContext({ input: {} });
    const result = evaluate(inputExpr('missing'), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reasonCode).toBe('MISSING_INPUT');
  });
  
  it('should provide MISSING_RESULT for missing result', () => {
    const ctx = createEvalContext();
    const result = evaluate(resultExpr(), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reasonCode).toBe('MISSING_RESULT');
  });
  
  it('should provide MISSING_OLD_STATE for old() without state', () => {
    const ctx = createEvalContext();
    const result = evaluate({ kind: 'OldExpr', expression: id('x'), location: loc() } as Expression, ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reasonCode).toBe('MISSING_OLD_STATE');
  });
  
  it('should provide UNSUPPORTED_OP for unknown operator', () => {
    const ctx = createEvalContext();
    const result = evaluate(bin('^^^', num(1), num(2)), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reasonCode).toBe('UNSUPPORTED_OP');
  });
  
  it('should provide PROPAGATED for propagated unknowns', () => {
    const ctx = createEvalContext();
    const result = evaluate(bin('+', id('unknown'), num(1)), ctx);
    expect(result.kind).toBe('unknown');
    expect(result.reasonCode).toBe('PROPAGATED');
  });
});

// ============================================================================
// CONSTANT FOLDING TESTS
// ============================================================================

describe('Constant Folding', () => {
  describe('isConstant', () => {
    it('should identify literals as constant', () => {
      expect(isConstant(num(5))).toBe(true);
      expect(isConstant(str('hello'))).toBe(true);
      expect(isConstant(bool(true))).toBe(true);
      expect(isConstant(nullLit())).toBe(true);
    });
    
    it('should identify constant expressions', () => {
      expect(isConstant(bin('+', num(1), num(2)))).toBe(true);
      expect(isConstant(bin('*', num(3), bin('+', num(1), num(2))))).toBe(true);
    });
    
    it('should identify non-constant expressions', () => {
      expect(isConstant(id('x'))).toBe(false);
      expect(isConstant(bin('+', id('x'), num(1)))).toBe(false);
    });
  });

  describe('foldConstants', () => {
    it('should fold constant arithmetic', () => {
      const result = foldConstants(bin('+', num(2), num(3)));
      expect(result.folded).toBe(true);
      expect(result.value).toBe(5);
      expect((result.expr as any).kind).toBe('NumberLiteral');
      expect((result.expr as any).value).toBe(5);
    });
    
    it('should fold nested constant expressions', () => {
      const expr = bin('*', num(2), bin('+', num(3), num(4)));
      const result = foldConstants(expr);
      expect(result.folded).toBe(true);
      expect(result.value).toBe(14);
    });
    
    it('should fold constant boolean expressions', () => {
      const result = foldConstants(bin('and', bool(true), bool(false)));
      expect(result.folded).toBe(true);
      expect((result.expr as any).kind).toBe('BooleanLiteral');
      expect((result.expr as any).value).toBe(false);
    });
    
    it('should fold constant conditionals', () => {
      const result = foldConstants(conditional(bool(true), num(1), num(2)));
      expect(result.folded).toBe(true);
      expect((result.expr as any).kind).toBe('NumberLiteral');
      expect((result.expr as any).value).toBe(1);
    });
    
    it('should not fold expressions with variables', () => {
      const result = foldConstants(bin('+', id('x'), num(1)));
      expect(result.folded).toBe(false);
    });
  });
});

// ============================================================================
// PROPERTY TESTS - Commutativity, Short-Circuit, Monotonicity
// ============================================================================

describe('Property Tests', () => {
  const ctx = createEvalContext();
  
  describe('Commutativity', () => {
    it('addition should be commutative', () => {
      const a = 5, b = 3;
      const result1 = evaluate(bin('+', num(a), num(b)), ctx);
      const result2 = evaluate(bin('+', num(b), num(a)), ctx);
      expect(result1.evidence).toBe(result2.evidence);
    });
    
    it('multiplication should be commutative', () => {
      const a = 7, b = 4;
      const result1 = evaluate(bin('*', num(a), num(b)), ctx);
      const result2 = evaluate(bin('*', num(b), num(a)), ctx);
      expect(result1.evidence).toBe(result2.evidence);
    });
    
    it('equality should be commutative', () => {
      const result1 = evaluate(bin('==', num(5), num(3)), ctx);
      const result2 = evaluate(bin('==', num(3), num(5)), ctx);
      expect(result1.kind).toBe(result2.kind);
    });
    
    it('AND should be commutative', () => {
      const result1 = evaluate(bin('and', bool(true), bool(false)), ctx);
      const result2 = evaluate(bin('and', bool(false), bool(true)), ctx);
      expect(result1.kind).toBe(result2.kind);
    });
    
    it('OR should be commutative', () => {
      const result1 = evaluate(bin('or', bool(true), bool(false)), ctx);
      const result2 = evaluate(bin('or', bool(false), bool(true)), ctx);
      expect(result1.kind).toBe(result2.kind);
    });
  });

  describe('Short-Circuit Correctness', () => {
    it('false AND unknown should be false (short-circuit)', () => {
      const result = evaluate(bin('and', bool(false), id('unknown_var')), ctx);
      expect(result.kind).toBe('false');
    });
    
    it('true OR unknown should be true (short-circuit)', () => {
      const result = evaluate(bin('or', bool(true), id('unknown_var')), ctx);
      expect(result.kind).toBe('true');
    });
    
    it('false IMPLIES unknown should be true (vacuous truth)', () => {
      const result = evaluate(bin('implies', bool(false), id('unknown_var')), ctx);
      expect(result.kind).toBe('true');
    });
  });

  describe('Monotonicity for Comparisons', () => {
    it('< should be monotonic: if a < b and b < c then a < c', () => {
      const a = 1, b = 2, c = 3;
      const ab = evaluate(bin('<', num(a), num(b)), ctx);
      const bc = evaluate(bin('<', num(b), num(c)), ctx);
      const ac = evaluate(bin('<', num(a), num(c)), ctx);
      
      if (ab.kind === 'true' && bc.kind === 'true') {
        expect(ac.kind).toBe('true');
      }
    });
    
    it('<= should be monotonic', () => {
      const a = 1, b = 2, c = 2;
      const ab = evaluate(bin('<=', num(a), num(b)), ctx);
      const bc = evaluate(bin('<=', num(b), num(c)), ctx);
      const ac = evaluate(bin('<=', num(a), num(c)), ctx);
      
      if (ab.kind === 'true' && bc.kind === 'true') {
        expect(ac.kind).toBe('true');
      }
    });
  });
});

// ============================================================================
// REGRESSION TESTS - Previously Unknown Cases
// ============================================================================

describe('Regression Tests - Previously Unknown Cases', () => {
  it('should evaluate QualifiedName (was unsupported)', () => {
    const ctx = createEvalContext({
      input: { user: { email: 'test@example.com' } },
    });
    const result = evaluate(qualifiedName('user', 'email'), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe('test@example.com');
  });
  
  it('should evaluate IndexExpr (was unsupported)', () => {
    const ctx = createEvalContext({
      variables: new Map([['arr', [1, 2, 3]]]),
    });
    const result = evaluate(indexExpr(id('arr'), num(0)), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe(1);
  });
  
  it('should evaluate ConditionalExpr (was unsupported)', () => {
    const ctx = createEvalContext();
    const result = evaluate(conditional(bool(true), str('yes'), str('no')), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toBe('yes');
  });
  
  it('should evaluate MapExpr (was unsupported)', () => {
    const ctx = createEvalContext();
    const result = evaluate(mapExpr([{ key: str('a'), value: num(1) }]), ctx);
    expect(result.kind).toBe('true');
    expect(result.evidence).toEqual({ a: 1 });
  });
  
  it('should evaluate DurationLiteral (was unsupported)', () => {
    const ctx = createEvalContext();
    const result = evaluate(duration(30, 'seconds'), ctx);
    expect(result.kind).toBe('true');
  });
  
  it('should evaluate arithmetic operators (were unsupported)', () => {
    const ctx = createEvalContext();
    expect(evaluate(bin('+', num(1), num(2)), ctx).kind).toBe('true');
    expect(evaluate(bin('-', num(5), num(3)), ctx).kind).toBe('true');
    expect(evaluate(bin('*', num(2), num(4)), ctx).kind).toBe('true');
    expect(evaluate(bin('/', num(10), num(2)), ctx).kind).toBe('true');
    expect(evaluate(bin('%', num(7), num(3)), ctx).kind).toBe('true');
  });
  
  it('should evaluate in operator (was unsupported)', () => {
    const ctx = createEvalContext();
    const result = evaluate(bin('in', num(2), list([num(1), num(2), num(3)])), ctx);
    expect(result.kind).toBe('true');
  });
  
  it('should evaluate extended quantifiers (were unsupported)', () => {
    const ctx = createEvalContext({
      variables: new Map([['items', [1, 2, 3, 4, 5]]]),
    });
    
    // none
    const noneResult = evaluate(quantifier('none', 'x', id('items'), bin('>', id('x'), num(10))), ctx);
    expect(noneResult.kind).toBe('true');
    
    // count
    const countResult = evaluate(quantifier('count', 'x', id('items'), bin('>', id('x'), num(2))), ctx);
    expect(countResult.kind).toBe('true');
    expect(countResult.evidence).toBe(3);
    
    // filter
    const filterResult = evaluate(quantifier('filter', 'x', id('items'), bin('>', id('x'), num(3))), ctx);
    expect(filterResult.kind).toBe('true');
    expect(filterResult.evidence).toEqual([4, 5]);
  });
});

// ============================================================================
// COVERAGE REPORT TEST
// ============================================================================

describe('Coverage Report', () => {
  it('should show all expression types as supported', () => {
    const report = getCoverageReport();
    expect(report.unsupported.length).toBe(0);
    expect(report.partial.length).toBe(0);
    expect(report.supported.length).toBeGreaterThan(20);
  });
});
