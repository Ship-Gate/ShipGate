/**
 * AST to IR Compiler Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  compileToIR,
  createContext,
  serializeIR,
  resetNodeIdCounter,
  type CompilerContext,
} from '../src/index.js';

// Mock AST factory helpers
function id(name: string) {
  return {
    kind: 'Identifier' as const,
    name,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function str(value: string) {
  return {
    kind: 'StringLiteral' as const,
    value,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function num(value: number, isFloat = false) {
  return {
    kind: 'NumberLiteral' as const,
    value,
    isFloat,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function bool(value: boolean) {
  return {
    kind: 'BooleanLiteral' as const,
    value,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function nullLit() {
  return {
    kind: 'NullLiteral' as const,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function binary(left: any, op: string, right: any) {
  return {
    kind: 'BinaryExpr' as const,
    operator: op as any,
    left,
    right,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function unary(op: string, operand: any) {
  return {
    kind: 'UnaryExpr' as const,
    operator: op as any,
    operand,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function member(obj: any, prop: string) {
  return {
    kind: 'MemberExpr' as const,
    object: obj,
    property: id(prop),
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function call(callee: any, args: any[] = []) {
  return {
    kind: 'CallExpr' as const,
    callee,
    arguments: args,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function resultExpr(prop?: string) {
  return {
    kind: 'ResultExpr' as const,
    property: prop ? id(prop) : undefined,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function inputExpr(prop: string) {
  return {
    kind: 'InputExpr' as const,
    property: id(prop),
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function list(elements: any[]) {
  return {
    kind: 'ListExpr' as const,
    elements,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function quantifier(kind: string, variable: string, collection: any, predicate: any) {
  return {
    kind: 'QuantifierExpr' as const,
    quantifier: kind,
    variable: id(variable),
    collection,
    predicate,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function conditional(condition: any, thenBranch: any, elseBranch: any) {
  return {
    kind: 'ConditionalExpr' as const,
    condition,
    thenBranch,
    elseBranch,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function oldExpr(expr: any) {
  return {
    kind: 'OldExpr' as const,
    expression: expr,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function regex(pattern: string, flags = '') {
  return {
    kind: 'RegexLiteral' as const,
    pattern,
    flags,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

function duration(value: number, unit: string) {
  return {
    kind: 'DurationLiteral' as const,
    value,
    unit,
    location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
  };
}

describe('AST to IR Compiler', () => {
  beforeEach(() => resetNodeIdCounter());

  const ctx = createContext({ entities: new Set(['User', 'Session']) });

  describe('Literals', () => {
    const literalTests = [
      ['string "hello"', str('hello'), '"hello"'],
      ['number 42', num(42), '42'],
      ['number 3.14', num(3.14, true), '3.14'],
      ['true', bool(true), 'true'],
      ['false', bool(false), 'false'],
      ['null', nullLit(), 'null'],
      ['regex /abc/i', regex('abc', 'i'), '/abc/i'],
    ] as const;

    it.each(literalTests)('compiles %s', (_, ast, expected) => {
      const ir = compileToIR(ast as any);
      expect(serializeIR(ir)).toBe(expected);
    });

    it('compiles duration to milliseconds', () => {
      expect(serializeIR(compileToIR(duration(5, 'seconds') as any))).toBe('5000');
      expect(serializeIR(compileToIR(duration(2, 'minutes') as any))).toBe('120000');
      expect(serializeIR(compileToIR(duration(100, 'ms') as any))).toBe('100');
    });
  });

  describe('Variables and Identifiers', () => {
    it('compiles identifier to variable', () => {
      const ir = compileToIR(id('foo'));
      expect(serializeIR(ir)).toBe('foo');
    });

    it('compiles member expression to property access', () => {
      const ir = compileToIR(member(id('user'), 'name'));
      expect(serializeIR(ir)).toBe('user.name');
    });

    it('compiles nested member expression', () => {
      const ir = compileToIR(member(member(id('a'), 'b'), 'c'));
      expect(serializeIR(ir)).toBe('a.b.c');
    });
  });

  describe('Existence Patterns (x != null, x == null)', () => {
    it('compiles x != null to existence check', () => {
      const ir = compileToIR(binary(id('x'), '!=', nullLit()));
      expect(serializeIR(ir)).toBe('(x != null)');
    });

    it('compiles x == null to non-existence check', () => {
      const ir = compileToIR(binary(id('x'), '==', nullLit()));
      expect(serializeIR(ir)).toBe('(x == null)');
    });

    it('compiles null != x to existence check', () => {
      const ir = compileToIR(binary(nullLit(), '!=', id('x')));
      expect(serializeIR(ir)).toBe('(x != null)');
    });

    it('compiles a.b.c != null', () => {
      const ir = compileToIR(binary(member(member(id('a'), 'b'), 'c'), '!=', nullLit()));
      expect(serializeIR(ir)).toBe('(a.b.c != null)');
    });
  });

  describe('Comparison Patterns', () => {
    const comparisonTests = [
      ['x < 10', binary(id('x'), '<', num(10)), '(x < 10)'],
      ['x <= 10', binary(id('x'), '<=', num(10)), '(x <= 10)'],
      ['x > 0', binary(id('x'), '>', num(0)), '(x > 0)'],
      ['x >= 0', binary(id('x'), '>=', num(0)), '(x >= 0)'],
    ] as const;

    it.each(comparisonTests)('compiles %s', (_, ast, expected) => {
      const ir = compileToIR(ast as any);
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Boolean Patterns', () => {
    it('compiles a and b', () => {
      const ir = compileToIR(binary(id('a'), 'and', id('b')));
      expect(serializeIR(ir)).toBe('(a && b)');
    });

    it('compiles a or b', () => {
      const ir = compileToIR(binary(id('a'), 'or', id('b')));
      expect(serializeIR(ir)).toBe('(a || b)');
    });

    it('compiles not x', () => {
      const ir = compileToIR(unary('not', id('x')));
      expect(serializeIR(ir)).toBe('!x');
    });

    it('compiles a implies b', () => {
      const ir = compileToIR(binary(id('a'), 'implies', id('b')));
      expect(serializeIR(ir)).toBe('(a => b)');
    });

    it('flattens nested ANDs', () => {
      const nested = binary(binary(id('a'), 'and', id('b')), 'and', id('c'));
      const ir = compileToIR(nested as any);
      // After normalization, should be sorted and flattened
      expect(serializeIR(ir)).toMatch(/\(.*&&.*&&.*\)/);
    });
  });

  describe('Set Membership (in)', () => {
    it('compiles x in [1,2,3]', () => {
      const ir = compileToIR(binary(id('x'), 'in', list([num(1), num(2), num(3)])) as any);
      expect(serializeIR(ir)).toMatch(/\(x in \[.*1.*2.*3.*\]\)/);
    });

    it('compiles status in ["active","pending"]', () => {
      const ir = compileToIR(binary(id('status'), 'in', list([str('active'), str('pending')])) as any);
      expect(serializeIR(ir)).toMatch(/\(status in \[.*"active".*"pending".*\]\)/);
    });

    it('compiles not (x in [1,2]) as negated in-set', () => {
      const ir = compileToIR(unary('not', binary(id('x'), 'in', list([num(1), num(2)]))) as any);
      expect(serializeIR(ir)).toMatch(/not in/);
    });
  });

  describe('Arithmetic', () => {
    const arithmeticTests = [
      ['a + b', binary(id('a'), '+', id('b')), '(a + b)'],
      ['a - b', binary(id('a'), '-', id('b')), '(a - b)'],
      ['a * b', binary(id('a'), '*', id('b')), '(a * b)'],
      ['a / b', binary(id('a'), '/', id('b')), '(a / b)'],
      ['a % b', binary(id('a'), '%', id('b')), '(a % b)'],
    ] as const;

    it.each(arithmeticTests)('compiles %s', (_, ast, expected) => {
      const ir = compileToIR(ast as any);
      expect(serializeIR(ir)).toBe(expected);
    });

    it('compiles -x', () => {
      const ir = compileToIR(unary('-', id('x')) as any);
      expect(serializeIR(ir)).toBe('(0 - x)');
    });

    it('compiles -5 directly', () => {
      const ir = compileToIR(unary('-', num(5)) as any);
      expect(serializeIR(ir)).toBe('-5');
    });
  });

  describe('String Methods', () => {
    it('compiles str.includes("x")', () => {
      const ir = compileToIR(call(member(id('str'), 'includes'), [str('x')]) as any);
      expect(serializeIR(ir)).toBe('str.includes("x")');
    });

    it('compiles str.startsWith("a")', () => {
      const ir = compileToIR(call(member(id('str'), 'startsWith'), [str('a')]) as any);
      expect(serializeIR(ir)).toBe('str.startsWith("a")');
    });

    it('compiles str.endsWith("z")', () => {
      const ir = compileToIR(call(member(id('str'), 'endsWith'), [str('z')]) as any);
      expect(serializeIR(ir)).toBe('str.endsWith("z")');
    });

    it('compiles str.matches(/regex/)', () => {
      const ir = compileToIR(call(member(id('str'), 'matches'), [regex('abc', 'i')]) as any);
      expect(serializeIR(ir)).toBe('str.matches(/abc/i)');
    });
  });

  describe('Entity Methods', () => {
    it('compiles User.exists()', () => {
      const ir = compileToIR(call(member(id('User'), 'exists'), []) as any, ctx);
      expect(serializeIR(ir)).toBe('User.exists()');
    });

    it('compiles User.exists({email: x})', () => {
      const mapExpr = {
        kind: 'MapExpr' as const,
        entries: [{ kind: 'MapEntry' as const, key: str('email'), value: id('x'), location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 } }],
        location: { file: 'test', line: 1, column: 1, endLine: 1, endColumn: 1 },
      };
      const ir = compileToIR(call(member(id('User'), 'exists'), [mapExpr]) as any, ctx);
      expect(serializeIR(ir)).toMatch(/User\.exists\(\{email: x\}\)/);
    });

    it('compiles User.count()', () => {
      const ir = compileToIR(call(member(id('User'), 'count'), []) as any, ctx);
      expect(serializeIR(ir)).toBe('User.count()');
    });

    it('does not treat non-entity as entity method', () => {
      // Without User in entities, it should be a normal method call
      const ir = compileToIR(call(member(id('User'), 'exists'), []) as any, createContext());
      expect(serializeIR(ir)).toBe('User.exists()');
    });
  });

  describe('Quantifiers', () => {
    it('compiles all(x in xs, x > 0)', () => {
      const ir = compileToIR(quantifier('all', 'x', id('xs'), binary(id('x'), '>', num(0))) as any);
      expect(serializeIR(ir)).toBe('all(x in xs, (x > 0))');
    });

    it('compiles any(x in xs, x > 0)', () => {
      const ir = compileToIR(quantifier('any', 'x', id('xs'), binary(id('x'), '>', num(0))) as any);
      expect(serializeIR(ir)).toBe('any(x in xs, (x > 0))');
    });

    it('compiles none(x in xs, x < 0)', () => {
      const ir = compileToIR(quantifier('none', 'x', id('xs'), binary(id('x'), '<', num(0))) as any);
      expect(serializeIR(ir)).toBe('none(x in xs, (x < 0))');
    });

    it('compiles count(x in xs, x > 0)', () => {
      const ir = compileToIR(quantifier('count', 'x', id('xs'), binary(id('x'), '>', num(0))) as any);
      expect(serializeIR(ir)).toBe('count(x in xs, (x > 0))');
    });
  });

  describe('Conditional', () => {
    it('compiles a ? b : c', () => {
      const ir = compileToIR(conditional(id('a'), id('b'), id('c')) as any);
      expect(serializeIR(ir)).toBe('(a ? b : c)');
    });

    it('compiles x > 0 ? "pos" : "neg"', () => {
      const ir = compileToIR(conditional(binary(id('x'), '>', num(0)), str('pos'), str('neg')) as any);
      expect(serializeIR(ir)).toBe('((x > 0) ? "pos" : "neg")');
    });
  });

  describe('Special Expressions', () => {
    it('compiles result', () => {
      const ir = compileToIR(resultExpr() as any);
      expect(serializeIR(ir)).toBe('result');
    });

    it('compiles result.id', () => {
      const ir = compileToIR(resultExpr('id') as any);
      expect(serializeIR(ir)).toBe('result.id');
    });

    it('compiles input.email', () => {
      const ir = compileToIR(inputExpr('email') as any);
      expect(serializeIR(ir)).toBe('input.email');
    });

    it('compiles old(x)', () => {
      const ir = compileToIR(oldExpr(id('x')) as any);
      expect(serializeIR(ir)).toBe('old(x)');
    });

    it('compiles old(User.count())', () => {
      const ir = compileToIR(oldExpr(call(member(id('User'), 'count'), [])) as any, ctx);
      expect(serializeIR(ir)).toBe('old(User.count())');
    });
  });

  describe('Lists', () => {
    it('compiles empty list', () => {
      const ir = compileToIR(list([]) as any);
      expect(serializeIR(ir)).toBe('[]');
    });

    it('compiles [1, 2, 3]', () => {
      const ir = compileToIR(list([num(1), num(2), num(3)]) as any);
      expect(serializeIR(ir)).toBe('[1, 2, 3]');
    });

    it('compiles ["a", "b"]', () => {
      const ir = compileToIR(list([str('a'), str('b')]) as any);
      expect(serializeIR(ir)).toBe('["a", "b"]');
    });
  });

  describe('Complex Real-World Expressions', () => {
    it('compiles: success implies User.exists(result.id)', () => {
      const ast = binary(
        id('success'),
        'implies',
        call(member(id('User'), 'exists'), [resultExpr('id')])
      );
      const ir = compileToIR(ast as any, ctx);
      expect(serializeIR(ir)).toMatch(/\(success => User\.exists\(.*\)\)/);
    });

    it('compiles: result.email == input.email', () => {
      const ast = binary(
        member(resultExpr() as any, 'email'),
        '==',
        inputExpr('email')
      );
      const ir = compileToIR(ast as any);
      expect(serializeIR(ir)).toBe('(result.email == input.email)');
    });

    it('compiles: items.length > 0 and all(x in items, x > 0)', () => {
      const ast = binary(
        binary(member(id('items'), 'length'), '>', num(0)),
        'and',
        quantifier('all', 'x', id('items'), binary(id('x'), '>', num(0)))
      );
      const ir = compileToIR(ast as any);
      // Should contain both length check and quantifier
      expect(serializeIR(ir)).toMatch(/items\.length.*>.*0/);
      expect(serializeIR(ir)).toMatch(/all\(x in items/);
    });

    it('compiles: status in ["active", "pending"] and user.role != null', () => {
      const ast = binary(
        binary(id('status'), 'in', list([str('active'), str('pending')])),
        'and',
        binary(member(id('user'), 'role'), '!=', nullLit())
      );
      const ir = compileToIR(ast as any);
      expect(serializeIR(ir)).toMatch(/status in/);
      expect(serializeIR(ir)).toMatch(/user\.role != null/);
    });
  });
});
