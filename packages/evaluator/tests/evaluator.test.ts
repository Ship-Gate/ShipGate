// ============================================================================
// Evaluator Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Evaluator,
  evaluate,
  expressionToString,
  createEntityStore,
  EvaluationError,
  TypeError,
  RuntimeError,
  ReferenceError,
} from '../src/index.js';
import type { EvaluationContext, EntityStore, SourceLocation } from '../src/index.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

const defaultLocation: SourceLocation = {
  file: 'test.isl',
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 10,
};

function loc(line = 1, col = 1): SourceLocation {
  return { file: 'test.isl', line, column: col, endLine: line, endColumn: col + 10 };
}

function createContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    input: {},
    result: undefined,
    error: undefined,
    store: createEntityStore(),
    oldState: undefined,
    domain: undefined,
    now: new Date('2024-01-15T10:00:00Z'),
    variables: new Map(),
    ...overrides,
  };
}

// AST node builders
function id(name: string): { kind: 'Identifier'; name: string; location: SourceLocation } {
  return { kind: 'Identifier', name, location: defaultLocation };
}

function num(value: number, isFloat = false): { kind: 'NumberLiteral'; value: number; isFloat: boolean; location: SourceLocation } {
  return { kind: 'NumberLiteral', value, isFloat, location: defaultLocation };
}

function str(value: string): { kind: 'StringLiteral'; value: string; location: SourceLocation } {
  return { kind: 'StringLiteral', value, location: defaultLocation };
}

function bool(value: boolean): { kind: 'BooleanLiteral'; value: boolean; location: SourceLocation } {
  return { kind: 'BooleanLiteral', value, location: defaultLocation };
}

function nullLit(): { kind: 'NullLiteral'; location: SourceLocation } {
  return { kind: 'NullLiteral', location: defaultLocation };
}

function binary(
  operator: string,
  left: unknown,
  right: unknown
): { kind: 'BinaryExpr'; operator: string; left: unknown; right: unknown; location: SourceLocation } {
  return { kind: 'BinaryExpr', operator, left, right, location: defaultLocation };
}

function unary(
  operator: string,
  operand: unknown
): { kind: 'UnaryExpr'; operator: string; operand: unknown; location: SourceLocation } {
  return { kind: 'UnaryExpr', operator, operand, location: defaultLocation };
}

function call(
  callee: unknown,
  args: unknown[]
): { kind: 'CallExpr'; callee: unknown; arguments: unknown[]; location: SourceLocation } {
  return { kind: 'CallExpr', callee, arguments: args, location: defaultLocation };
}

function member(
  object: unknown,
  property: string
): { kind: 'MemberExpr'; object: unknown; property: { kind: 'Identifier'; name: string; location: SourceLocation }; location: SourceLocation } {
  return { kind: 'MemberExpr', object, property: id(property), location: defaultLocation };
}

function index(
  object: unknown,
  idx: unknown
): { kind: 'IndexExpr'; object: unknown; index: unknown; location: SourceLocation } {
  return { kind: 'IndexExpr', object, index: idx, location: defaultLocation };
}

function list(
  elements: unknown[]
): { kind: 'ListExpr'; elements: unknown[]; location: SourceLocation } {
  return { kind: 'ListExpr', elements, location: defaultLocation };
}

function conditional(
  condition: unknown,
  thenBranch: unknown,
  elseBranch: unknown
): { kind: 'ConditionalExpr'; condition: unknown; thenBranch: unknown; elseBranch: unknown; location: SourceLocation } {
  return { kind: 'ConditionalExpr', condition, thenBranch, elseBranch, location: defaultLocation };
}

function quantifier(
  type: string,
  variable: string,
  collection: unknown,
  predicate: unknown
): { kind: 'QuantifierExpr'; quantifier: string; variable: { kind: 'Identifier'; name: string; location: SourceLocation }; collection: unknown; predicate: unknown; location: SourceLocation } {
  return {
    kind: 'QuantifierExpr',
    quantifier: type,
    variable: id(variable),
    collection,
    predicate,
    location: defaultLocation,
  };
}

function oldExpr(
  expression: unknown
): { kind: 'OldExpr'; expression: unknown; location: SourceLocation } {
  return { kind: 'OldExpr', expression, location: defaultLocation };
}

function resultExpr(
  property?: string
): { kind: 'ResultExpr'; property?: { kind: 'Identifier'; name: string; location: SourceLocation }; location: SourceLocation } {
  return {
    kind: 'ResultExpr',
    property: property ? id(property) : undefined,
    location: defaultLocation,
  };
}

function inputExpr(
  property: string
): { kind: 'InputExpr'; property: { kind: 'Identifier'; name: string; location: SourceLocation }; location: SourceLocation } {
  return { kind: 'InputExpr', property: id(property), location: defaultLocation };
}

// ============================================================================
// LITERAL TESTS
// ============================================================================

describe('Evaluator - Literals', () => {
  const ctx = createContext();

  it('evaluates number literals', () => {
    expect(evaluate(num(42), ctx)).toBe(42);
    expect(evaluate(num(3.14, true), ctx)).toBe(3.14);
    expect(evaluate(num(-10), ctx)).toBe(-10);
    expect(evaluate(num(0), ctx)).toBe(0);
  });

  it('evaluates string literals', () => {
    expect(evaluate(str('hello'), ctx)).toBe('hello');
    expect(evaluate(str(''), ctx)).toBe('');
    expect(evaluate(str('with "quotes"'), ctx)).toBe('with "quotes"');
  });

  it('evaluates boolean literals', () => {
    expect(evaluate(bool(true), ctx)).toBe(true);
    expect(evaluate(bool(false), ctx)).toBe(false);
  });

  it('evaluates null literal', () => {
    expect(evaluate(nullLit(), ctx)).toBe(null);
  });

  it('evaluates duration literals', () => {
    const duration = { kind: 'DurationLiteral', value: 5, unit: 'seconds', location: defaultLocation };
    expect(evaluate(duration, ctx)).toBe(5000); // 5 seconds in ms
    
    const minutes = { kind: 'DurationLiteral', value: 2, unit: 'minutes', location: defaultLocation };
    expect(evaluate(minutes, ctx)).toBe(120000); // 2 minutes in ms
  });

  it('evaluates regex literals', () => {
    const regex = { kind: 'RegexLiteral', pattern: '^test', flags: 'i', location: defaultLocation };
    const result = evaluate(regex, ctx);
    expect(result).toBeInstanceOf(RegExp);
    expect((result as RegExp).test('TEST')).toBe(true);
  });

  it('evaluates list expressions', () => {
    expect(evaluate(list([num(1), num(2), num(3)]), ctx)).toEqual([1, 2, 3]);
    expect(evaluate(list([str('a'), str('b')]), ctx)).toEqual(['a', 'b']);
    expect(evaluate(list([]), ctx)).toEqual([]);
  });

  it('evaluates map expressions', () => {
    const mapExpr = {
      kind: 'MapExpr',
      entries: [
        { kind: 'MapEntry', key: str('a'), value: num(1), location: defaultLocation },
        { kind: 'MapEntry', key: str('b'), value: num(2), location: defaultLocation },
      ],
      location: defaultLocation,
    };
    expect(evaluate(mapExpr, ctx)).toEqual({ a: 1, b: 2 });
  });
});

// ============================================================================
// ARITHMETIC TESTS
// ============================================================================

describe('Evaluator - Arithmetic', () => {
  const ctx = createContext();

  it('evaluates addition', () => {
    expect(evaluate(binary('+', num(2), num(3)), ctx)).toBe(5);
    expect(evaluate(binary('+', num(-1), num(1)), ctx)).toBe(0);
    expect(evaluate(binary('+', num(1.5), num(2.5)), ctx)).toBe(4);
  });

  it('evaluates subtraction', () => {
    expect(evaluate(binary('-', num(5), num(3)), ctx)).toBe(2);
    expect(evaluate(binary('-', num(1), num(5)), ctx)).toBe(-4);
  });

  it('evaluates multiplication', () => {
    expect(evaluate(binary('*', num(4), num(3)), ctx)).toBe(12);
    expect(evaluate(binary('*', num(-2), num(3)), ctx)).toBe(-6);
    expect(evaluate(binary('*', num(0), num(100)), ctx)).toBe(0);
  });

  it('evaluates division', () => {
    expect(evaluate(binary('/', num(10), num(2)), ctx)).toBe(5);
    expect(evaluate(binary('/', num(7), num(2)), ctx)).toBe(3.5);
  });

  it('evaluates modulo', () => {
    expect(evaluate(binary('%', num(10), num(3)), ctx)).toBe(1);
    expect(evaluate(binary('%', num(8), num(4)), ctx)).toBe(0);
  });

  it('throws on division by zero', () => {
    expect(() => evaluate(binary('/', num(10), num(0)), ctx)).toThrow(RuntimeError);
  });

  it('throws on modulo by zero', () => {
    expect(() => evaluate(binary('%', num(10), num(0)), ctx)).toThrow(RuntimeError);
  });

  it('evaluates unary minus', () => {
    expect(evaluate(unary('-', num(5)), ctx)).toBe(-5);
    expect(evaluate(unary('-', num(-3)), ctx)).toBe(3);
  });

  it('supports string concatenation with +', () => {
    expect(evaluate(binary('+', str('hello'), str(' world')), ctx)).toBe('hello world');
    expect(evaluate(binary('+', str('num: '), num(42)), ctx)).toBe('num: 42');
  });
});

// ============================================================================
// COMPARISON TESTS
// ============================================================================

describe('Evaluator - Comparisons', () => {
  const ctx = createContext();

  it('evaluates equality', () => {
    expect(evaluate(binary('==', num(5), num(5)), ctx)).toBe(true);
    expect(evaluate(binary('==', num(5), num(3)), ctx)).toBe(false);
    expect(evaluate(binary('==', str('a'), str('a')), ctx)).toBe(true);
    expect(evaluate(binary('==', bool(true), bool(true)), ctx)).toBe(true);
    expect(evaluate(binary('==', nullLit(), nullLit()), ctx)).toBe(true);
  });

  it('evaluates inequality', () => {
    expect(evaluate(binary('!=', num(5), num(3)), ctx)).toBe(true);
    expect(evaluate(binary('!=', num(5), num(5)), ctx)).toBe(false);
  });

  it('evaluates less than', () => {
    expect(evaluate(binary('<', num(3), num(5)), ctx)).toBe(true);
    expect(evaluate(binary('<', num(5), num(5)), ctx)).toBe(false);
    expect(evaluate(binary('<', num(7), num(5)), ctx)).toBe(false);
  });

  it('evaluates greater than', () => {
    expect(evaluate(binary('>', num(7), num(5)), ctx)).toBe(true);
    expect(evaluate(binary('>', num(5), num(5)), ctx)).toBe(false);
    expect(evaluate(binary('>', num(3), num(5)), ctx)).toBe(false);
  });

  it('evaluates less than or equal', () => {
    expect(evaluate(binary('<=', num(3), num(5)), ctx)).toBe(true);
    expect(evaluate(binary('<=', num(5), num(5)), ctx)).toBe(true);
    expect(evaluate(binary('<=', num(7), num(5)), ctx)).toBe(false);
  });

  it('evaluates greater than or equal', () => {
    expect(evaluate(binary('>=', num(7), num(5)), ctx)).toBe(true);
    expect(evaluate(binary('>=', num(5), num(5)), ctx)).toBe(true);
    expect(evaluate(binary('>=', num(3), num(5)), ctx)).toBe(false);
  });

  it('deep equals arrays', () => {
    expect(evaluate(binary('==', list([num(1), num(2)]), list([num(1), num(2)])), ctx)).toBe(true);
    expect(evaluate(binary('==', list([num(1), num(2)]), list([num(1), num(3)])), ctx)).toBe(false);
  });

  it('deep equals objects', () => {
    const obj1 = {
      kind: 'MapExpr',
      entries: [{ kind: 'MapEntry', key: str('a'), value: num(1), location: defaultLocation }],
      location: defaultLocation,
    };
    const obj2 = {
      kind: 'MapExpr',
      entries: [{ kind: 'MapEntry', key: str('a'), value: num(1), location: defaultLocation }],
      location: defaultLocation,
    };
    expect(evaluate(binary('==', obj1, obj2), ctx)).toBe(true);
  });
});

// ============================================================================
// LOGICAL TESTS
// ============================================================================

describe('Evaluator - Logical Operations', () => {
  const ctx = createContext();

  it('evaluates AND with short-circuit', () => {
    expect(evaluate(binary('and', bool(true), bool(true)), ctx)).toBe(true);
    expect(evaluate(binary('and', bool(true), bool(false)), ctx)).toBe(false);
    expect(evaluate(binary('and', bool(false), bool(true)), ctx)).toBe(false);
    expect(evaluate(binary('and', bool(false), bool(false)), ctx)).toBe(false);
  });

  it('evaluates OR with short-circuit', () => {
    expect(evaluate(binary('or', bool(true), bool(true)), ctx)).toBe(true);
    expect(evaluate(binary('or', bool(true), bool(false)), ctx)).toBe(true);
    expect(evaluate(binary('or', bool(false), bool(true)), ctx)).toBe(true);
    expect(evaluate(binary('or', bool(false), bool(false)), ctx)).toBe(false);
  });

  it('evaluates NOT', () => {
    expect(evaluate(unary('not', bool(true)), ctx)).toBe(false);
    expect(evaluate(unary('not', bool(false)), ctx)).toBe(true);
  });

  it('evaluates implies', () => {
    // false implies anything is true
    expect(evaluate(binary('implies', bool(false), bool(false)), ctx)).toBe(true);
    expect(evaluate(binary('implies', bool(false), bool(true)), ctx)).toBe(true);
    // true implies true is true
    expect(evaluate(binary('implies', bool(true), bool(true)), ctx)).toBe(true);
    // true implies false is false
    expect(evaluate(binary('implies', bool(true), bool(false)), ctx)).toBe(false);
  });

  it('evaluates iff (biconditional)', () => {
    expect(evaluate(binary('iff', bool(true), bool(true)), ctx)).toBe(true);
    expect(evaluate(binary('iff', bool(false), bool(false)), ctx)).toBe(true);
    expect(evaluate(binary('iff', bool(true), bool(false)), ctx)).toBe(false);
    expect(evaluate(binary('iff', bool(false), bool(true)), ctx)).toBe(false);
  });

  it('short-circuits AND correctly', () => {
    // This should not throw because short-circuit prevents evaluation of right side
    const left = bool(false);
    const right = binary('/', num(1), num(0)); // Would throw if evaluated
    expect(evaluate(binary('and', left, right), ctx)).toBe(false);
  });

  it('short-circuits OR correctly', () => {
    const left = bool(true);
    const right = binary('/', num(1), num(0)); // Would throw if evaluated
    expect(evaluate(binary('or', left, right), ctx)).toBe(true);
  });
});

// ============================================================================
// MEMBER ACCESS TESTS
// ============================================================================

describe('Evaluator - Member Access', () => {
  it('accesses object properties', () => {
    const ctx = createContext({
      input: { user: { name: 'Alice', age: 30 } },
    });
    expect(evaluate(member(inputExpr('user'), 'name'), ctx)).toBe('Alice');
    expect(evaluate(member(inputExpr('user'), 'age'), ctx)).toBe(30);
  });

  it('accesses nested properties', () => {
    const ctx = createContext({
      input: { data: { nested: { value: 42 } } },
    });
    const expr = member(member(inputExpr('data'), 'nested'), 'value');
    expect(evaluate(expr, ctx)).toBe(42);
  });

  it('returns undefined for missing properties', () => {
    const ctx = createContext({
      input: { user: { name: 'Alice' } },
    });
    expect(evaluate(member(inputExpr('user'), 'email'), ctx)).toBeUndefined();
  });

  it('returns undefined for null/undefined objects', () => {
    const ctx = createContext({
      input: { maybeNull: null },
    });
    expect(evaluate(member(inputExpr('maybeNull'), 'prop'), ctx)).toBeUndefined();
  });

  it('accesses array length', () => {
    const ctx = createContext({
      input: { items: [1, 2, 3, 4, 5] },
    });
    expect(evaluate(member(inputExpr('items'), 'length'), ctx)).toBe(5);
  });

  it('accesses string length', () => {
    const ctx = createContext({
      input: { text: 'hello' },
    });
    expect(evaluate(member(inputExpr('text'), 'length'), ctx)).toBe(5);
  });
});

// ============================================================================
// INDEX ACCESS TESTS
// ============================================================================

describe('Evaluator - Index Access', () => {
  it('accesses array elements', () => {
    const ctx = createContext({
      input: { items: [10, 20, 30] },
    });
    expect(evaluate(index(inputExpr('items'), num(0)), ctx)).toBe(10);
    expect(evaluate(index(inputExpr('items'), num(2)), ctx)).toBe(30);
  });

  it('returns undefined for out of bounds', () => {
    const ctx = createContext({
      input: { items: [1, 2, 3] },
    });
    expect(evaluate(index(inputExpr('items'), num(10)), ctx)).toBeUndefined();
    expect(evaluate(index(inputExpr('items'), num(-1)), ctx)).toBeUndefined();
  });

  it('accesses string characters', () => {
    const ctx = createContext({
      input: { text: 'hello' },
    });
    expect(evaluate(index(inputExpr('text'), num(0)), ctx)).toBe('h');
    expect(evaluate(index(inputExpr('text'), num(4)), ctx)).toBe('o');
  });

  it('accesses object properties by key', () => {
    const ctx = createContext({
      input: { obj: { a: 1, b: 2 } },
    });
    expect(evaluate(index(inputExpr('obj'), str('a')), ctx)).toBe(1);
  });
});

// ============================================================================
// CONDITIONAL TESTS
// ============================================================================

describe('Evaluator - Conditional Expressions', () => {
  const ctx = createContext();

  it('evaluates ternary true branch', () => {
    expect(evaluate(conditional(bool(true), num(1), num(2)), ctx)).toBe(1);
  });

  it('evaluates ternary false branch', () => {
    expect(evaluate(conditional(bool(false), num(1), num(2)), ctx)).toBe(2);
  });

  it('only evaluates the relevant branch', () => {
    // True branch: should not evaluate the division by zero
    const truthy = conditional(bool(true), num(1), binary('/', num(1), num(0)));
    expect(evaluate(truthy, ctx)).toBe(1);

    // False branch: should not evaluate the division by zero
    const falsy = conditional(bool(false), binary('/', num(1), num(0)), num(2));
    expect(evaluate(falsy, ctx)).toBe(2);
  });

  it('handles nested conditionals', () => {
    const nested = conditional(
      bool(true),
      conditional(bool(false), num(1), num(2)),
      num(3)
    );
    expect(evaluate(nested, ctx)).toBe(2);
  });
});

// ============================================================================
// QUANTIFIER TESTS
// ============================================================================

describe('Evaluator - Quantifiers', () => {
  const ctx = createContext({
    input: { numbers: [1, 2, 3, 4, 5] },
  });

  it('evaluates all (universal quantifier)', () => {
    // all x in numbers: x > 0
    const allPositive = quantifier(
      'all',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(0))
    );
    expect(evaluate(allPositive, ctx)).toBe(true);

    // all x in numbers: x > 3
    const allGreater3 = quantifier(
      'all',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(3))
    );
    expect(evaluate(allGreater3, ctx)).toBe(false);
  });

  it('evaluates any (existential quantifier)', () => {
    // any x in numbers: x > 4
    const anyGreater4 = quantifier(
      'any',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(4))
    );
    expect(evaluate(anyGreater4, ctx)).toBe(true);

    // any x in numbers: x > 10
    const anyGreater10 = quantifier(
      'any',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(10))
    );
    expect(evaluate(anyGreater10, ctx)).toBe(false);
  });

  it('evaluates none quantifier', () => {
    // none x in numbers: x > 10
    const noneGreater10 = quantifier(
      'none',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(10))
    );
    expect(evaluate(noneGreater10, ctx)).toBe(true);

    // none x in numbers: x > 0
    const nonePositive = quantifier(
      'none',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(0))
    );
    expect(evaluate(nonePositive, ctx)).toBe(false);
  });

  it('evaluates count quantifier', () => {
    // count x in numbers: x > 3
    const countGreater3 = quantifier(
      'count',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(3))
    );
    expect(evaluate(countGreater3, ctx)).toBe(2); // 4 and 5
  });

  it('evaluates filter quantifier', () => {
    // filter x in numbers: x > 3
    const filterGreater3 = quantifier(
      'filter',
      'x',
      inputExpr('numbers'),
      binary('>', id('x'), num(3))
    );
    expect(evaluate(filterGreater3, ctx)).toEqual([4, 5]);
  });

  it('works with empty arrays', () => {
    const emptyCtx = createContext({
      input: { empty: [] },
    });

    expect(evaluate(quantifier('all', 'x', inputExpr('empty'), bool(false)), emptyCtx)).toBe(true);
    expect(evaluate(quantifier('any', 'x', inputExpr('empty'), bool(true)), emptyCtx)).toBe(false);
    expect(evaluate(quantifier('none', 'x', inputExpr('empty'), bool(true)), emptyCtx)).toBe(true);
    expect(evaluate(quantifier('count', 'x', inputExpr('empty'), bool(true)), emptyCtx)).toBe(0);
  });

  it('quantifies over array of objects', () => {
    const objCtx = createContext({
      input: {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
          { name: 'Carol', age: 35 },
        ],
      },
    });

    // all u in users: u.age >= 25
    const allAdults = quantifier(
      'all',
      'u',
      inputExpr('users'),
      binary('>=', member(id('u'), 'age'), num(25))
    );
    expect(evaluate(allAdults, objCtx)).toBe(true);
  });
});

// ============================================================================
// OLD() EXPRESSION TESTS
// ============================================================================

describe('Evaluator - old() Expressions', () => {
  it('accesses pre-state values', () => {
    const store = createEntityStore();
    store.create('Account', { id: 'acc1', balance: 100 });
    
    // Take snapshot, then modify
    const snapshot = store.snapshot();
    store.update('Account', 'acc1', { balance: 80 });

    const ctx = createContext({
      store,
      oldState: snapshot,
      domain: { name: 'Test', entities: [{ name: 'Account', fields: [] }], types: [] },
    });

    // Current balance
    const currentBalance = member(
      call(member(id('Account'), 'lookup'), [
        {
          kind: 'MapExpr',
          entries: [{ kind: 'MapEntry', key: str('id'), value: str('acc1'), location: defaultLocation }],
          location: defaultLocation,
        },
      ]),
      'balance'
    );
    expect(evaluate(currentBalance, ctx)).toBe(80);

    // Old balance
    const oldBalance = oldExpr(currentBalance);
    expect(evaluate(oldBalance, ctx)).toBe(100);
  });

  it('throws when old() called without snapshot', () => {
    const ctx = createContext({
      oldState: undefined,
    });

    expect(() => evaluate(oldExpr(num(1)), ctx)).toThrow(RuntimeError);
  });
});

// ============================================================================
// RESULT/INPUT EXPRESSION TESTS
// ============================================================================

describe('Evaluator - Result and Input Expressions', () => {
  it('evaluates result expression', () => {
    const ctx = createContext({
      result: { status: 'success', data: { value: 42 } },
    });

    expect(evaluate(resultExpr(), ctx)).toEqual({ status: 'success', data: { value: 42 } });
    expect(evaluate(resultExpr('status'), ctx)).toBe('success');
  });

  it('evaluates input expression', () => {
    const ctx = createContext({
      input: { amount: 100, recipient: 'bob' },
    });

    expect(evaluate(inputExpr('amount'), ctx)).toBe(100);
    expect(evaluate(inputExpr('recipient'), ctx)).toBe('bob');
  });

  it('handles undefined result property', () => {
    const ctx = createContext({
      result: { a: 1 },
    });

    expect(evaluate(resultExpr('nonexistent'), ctx)).toBeUndefined();
  });

  it('handles null result', () => {
    const ctx = createContext({
      result: null,
    });

    expect(evaluate(resultExpr(), ctx)).toBe(null);
    expect(evaluate(resultExpr('prop'), ctx)).toBeUndefined();
  });
});

// ============================================================================
// IN OPERATOR TESTS
// ============================================================================

describe('Evaluator - In Operator', () => {
  const ctx = createContext();

  it('checks membership in arrays', () => {
    expect(evaluate(binary('in', num(2), list([num(1), num(2), num(3)])), ctx)).toBe(true);
    expect(evaluate(binary('in', num(5), list([num(1), num(2), num(3)])), ctx)).toBe(false);
    expect(evaluate(binary('in', str('a'), list([str('a'), str('b')])), ctx)).toBe(true);
  });

  it('checks key existence in objects', () => {
    const obj = {
      kind: 'MapExpr',
      entries: [
        { kind: 'MapEntry', key: str('a'), value: num(1), location: defaultLocation },
        { kind: 'MapEntry', key: str('b'), value: num(2), location: defaultLocation },
      ],
      location: defaultLocation,
    };
    expect(evaluate(binary('in', str('a'), obj), ctx)).toBe(true);
    expect(evaluate(binary('in', str('c'), obj), ctx)).toBe(false);
  });

  it('checks substring in strings', () => {
    expect(evaluate(binary('in', str('ell'), str('hello')), ctx)).toBe(true);
    expect(evaluate(binary('in', str('xyz'), str('hello')), ctx)).toBe(false);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Evaluator - Error Handling', () => {
  const ctx = createContext();

  it('throws ReferenceError for unknown identifiers', () => {
    expect(() => evaluate(id('unknownVar'), ctx)).toThrow(ReferenceError);
  });

  it('throws TypeError for type mismatches', () => {
    expect(() => evaluate(binary('-', str('a'), num(1)), ctx)).toThrow(TypeError);
    expect(() => evaluate(unary('-', str('a')), ctx)).toThrow(TypeError);
  });

  it('includes source location in errors', () => {
    try {
      evaluate(id('unknownVar'), ctx);
    } catch (err) {
      expect(err).toBeInstanceOf(ReferenceError);
      expect((err as ReferenceError).location).toBeDefined();
      expect((err as ReferenceError).location.file).toBe('test.isl');
    }
  });

  it('handles deeply nested errors', () => {
    // Build a deeply nested expression that eventually fails
    const nested = member(member(member(id('unknownVar'), 'a'), 'b'), 'c');
    expect(() => evaluate(nested, ctx)).toThrow();
  });
});

// ============================================================================
// EXPRESSION TO STRING TESTS
// ============================================================================

describe('expressionToString', () => {
  it('converts literals to strings', () => {
    expect(expressionToString(num(42))).toBe('42');
    expect(expressionToString(str('hello'))).toBe('"hello"');
    expect(expressionToString(bool(true))).toBe('true');
    expect(expressionToString(nullLit())).toBe('null');
  });

  it('converts binary expressions to strings', () => {
    expect(expressionToString(binary('+', num(1), num(2)))).toBe('(1 + 2)');
    expect(expressionToString(binary('and', bool(true), bool(false)))).toBe('(true and false)');
  });

  it('converts member expressions to strings', () => {
    expect(expressionToString(member(id('user'), 'name'))).toBe('user.name');
  });

  it('converts call expressions to strings', () => {
    expect(expressionToString(call(id('sum'), [num(1), num(2)]))).toBe('sum(1, 2)');
  });

  it('converts quantifiers to strings', () => {
    const q = quantifier('all', 'x', id('items'), binary('>', id('x'), num(0)));
    expect(expressionToString(q)).toBe('all x in items: (x > 0)');
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Evaluator - Performance', () => {
  it('evaluates 1000 simple expressions in under 100ms', () => {
    const evaluator = new Evaluator();
    const ctx = createContext();
    
    const startTime = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      evaluator.evaluate(binary('+', num(i), num(1)), ctx);
    }
    
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(100);
  });

  it('handles recursion limit', () => {
    const evaluator = new Evaluator({ maxDepth: 10 });
    const ctx = createContext();

    // Build deeply nested expression
    let expr: unknown = num(1);
    for (let i = 0; i < 20; i++) {
      expr = binary('+', expr, num(1));
    }

    expect(() => evaluator.evaluate(expr, ctx)).toThrow(RuntimeError);
  });
});
