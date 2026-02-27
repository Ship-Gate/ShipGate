// ============================================================================
// ISL Expression Evaluator - Golden Test Suite
// ============================================================================
// This file contains definitive test cases for the expression evaluator.
// Each test represents expected behavior that MUST NOT change without review.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { Expression } from '@isl-lang/parser';
import {
  evaluateV1 as evaluate,
  createEvalContext,
  clearEvalCache,
  type EvalContext,
  type EvalResult,
  type UnknownReasonCode,
} from '../src/index.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function loc() {
  return { file: 'golden.isl', line: 1, column: 1, endLine: 1, endColumn: 10 };
}

// Expression constructors
const bool = (value: boolean): Expression =>
  ({ kind: 'BooleanLiteral', value, location: loc() });

const str = (value: string): Expression =>
  ({ kind: 'StringLiteral', value, location: loc() });

const num = (value: number): Expression =>
  ({ kind: 'NumberLiteral', value, isFloat: !Number.isInteger(value), location: loc() });

const nullLit = (): Expression =>
  ({ kind: 'NullLiteral', location: loc() });

const id = (name: string): Expression =>
  ({ kind: 'Identifier', name, location: loc() });

const bin = (op: string, left: Expression, right: Expression): Expression =>
  ({ kind: 'BinaryExpr', operator: op as any, left, right, location: loc() });

const unary = (op: string, operand: Expression): Expression =>
  ({ kind: 'UnaryExpr', operator: op as any, operand, location: loc() });

const member = (object: Expression, property: string): Expression =>
  ({ kind: 'MemberExpr', object, property: id(property) as any, location: loc() });

const call = (callee: Expression, args: Expression[] = []): Expression =>
  ({ kind: 'CallExpr', callee, arguments: args, location: loc() });

const list = (elements: Expression[]): Expression =>
  ({ kind: 'ListExpr', elements, location: loc() });

const mapExpr = (entries: Array<{ key: Expression; value: Expression }>): Expression =>
  ({ kind: 'MapExpr', entries: entries.map(e => ({ kind: 'MapEntry', key: e.key, value: e.value, location: loc() })), location: loc() });

const indexExpr = (object: Expression, index: Expression): Expression =>
  ({ kind: 'IndexExpr', object, index, location: loc() });

const conditional = (condition: Expression, thenBranch: Expression, elseBranch: Expression): Expression =>
  ({ kind: 'ConditionalExpr', condition, thenBranch, elseBranch, location: loc() });

const oldExpr = (expression: Expression): Expression =>
  ({ kind: 'OldExpr', expression, location: loc() });

const inputExpr = (property: string): Expression =>
  ({ kind: 'InputExpr', property: { kind: 'Identifier', name: property, location: loc() }, location: loc() });

const resultExpr = (property?: string): Expression =>
  ({ kind: 'ResultExpr', property: property ? { kind: 'Identifier', name: property, location: loc() } : undefined, location: loc() });

const quantifier = (
  quant: 'all' | 'any' | 'none' | 'count' | 'sum' | 'filter',
  variable: string,
  collection: Expression,
  predicate: Expression
): Expression =>
  ({ kind: 'QuantifierExpr', quantifier: quant, variable: id(variable) as any, collection, predicate, location: loc() });

const duration = (value: number, unit: string): Expression =>
  ({ kind: 'DurationLiteral', value, unit, location: loc() });

const regex = (pattern: string, flags: string = ''): Expression =>
  ({ kind: 'RegexLiteral', pattern, flags, location: loc() });

// ============================================================================
// GOLDEN TEST INTERFACE
// ============================================================================

interface GoldenTest {
  name: string;
  expr: Expression;
  ctx?: Partial<Parameters<typeof createEvalContext>[0]>;
  expected: {
    kind: 'true' | 'false' | 'unknown';
    value?: unknown;
    reasonCode?: UnknownReasonCode;
  };
}

function runGoldenTests(tests: GoldenTest[]) {
  tests.forEach(({ name, expr, ctx, expected }) => {
    it(name, () => {
      const context = createEvalContext(ctx ?? {});
      const result = evaluate(expr, context);
      
      expect(result.kind).toBe(expected.kind);
      
      if (expected.value !== undefined) {
        expect(result.evidence).toEqual(expected.value);
      }
      
      if (expected.reasonCode !== undefined) {
        expect(result.reasonCode).toBe(expected.reasonCode);
      }
    });
  });
}

// ============================================================================
// GOLDEN TESTS
// ============================================================================

describe('Golden Tests - Expression Evaluation', () => {
  beforeEach(() => {
    clearEvalCache();
  });

  // ==========================================================================
  // LITERALS
  // ==========================================================================
  
  describe('Literals', () => {
    runGoldenTests([
      { name: 'true literal', expr: bool(true), expected: { kind: 'true', value: true } },
      { name: 'false literal', expr: bool(false), expected: { kind: 'false', value: false } },
      { name: 'string literal', expr: str('hello'), expected: { kind: 'true', value: 'hello' } },
      { name: 'empty string literal', expr: str(''), expected: { kind: 'true', value: '' } },
      { name: 'integer literal', expr: num(42), expected: { kind: 'true', value: 42 } },
      { name: 'negative integer', expr: num(-5), expected: { kind: 'true', value: -5 } },
      { name: 'float literal', expr: num(3.14), expected: { kind: 'true', value: 3.14 } },
      { name: 'zero literal', expr: num(0), expected: { kind: 'true', value: 0 } },
      { name: 'null literal', expr: nullLit(), expected: { kind: 'false', value: null } },
    ]);
  });

  // ==========================================================================
  // IDENTIFIERS
  // ==========================================================================
  
  describe('Identifiers', () => {
    runGoldenTests([
      { name: 'true identifier', expr: id('true'), expected: { kind: 'true', value: true } },
      { name: 'false identifier', expr: id('false'), expected: { kind: 'false', value: false } },
      { name: 'null identifier', expr: id('null'), expected: { kind: 'false', value: null } },
      { name: 'variable binding', expr: id('x'), ctx: { variables: new Map([['x', 100]]) }, expected: { kind: 'true', value: 100 } },
      { name: 'missing binding', expr: id('missing'), expected: { kind: 'unknown', reasonCode: 'MISSING_BINDING' } },
      { name: 'input field', expr: id('email'), ctx: { input: { email: 'test@example.com' } }, expected: { kind: 'true', value: 'test@example.com' } },
      { name: 'result value', expr: id('result'), ctx: { result: { id: 123 } }, expected: { kind: 'true' } },
      { name: 'missing result', expr: id('result'), expected: { kind: 'unknown', reasonCode: 'MISSING_RESULT' } },
    ]);
  });

  // ==========================================================================
  // COMPARISON OPERATORS
  // ==========================================================================
  
  describe('Comparison Operators', () => {
    runGoldenTests([
      // Equality
      { name: '5 == 5', expr: bin('==', num(5), num(5)), expected: { kind: 'true' } },
      { name: '5 == 3', expr: bin('==', num(5), num(3)), expected: { kind: 'false' } },
      { name: '"a" == "a"', expr: bin('==', str('a'), str('a')), expected: { kind: 'true' } },
      { name: '"a" == "b"', expr: bin('==', str('a'), str('b')), expected: { kind: 'false' } },
      { name: 'null == null', expr: bin('==', nullLit(), nullLit()), expected: { kind: 'true' } },
      
      // Inequality
      { name: '5 != 3', expr: bin('!=', num(5), num(3)), expected: { kind: 'true' } },
      { name: '5 != 5', expr: bin('!=', num(5), num(5)), expected: { kind: 'false' } },
      
      // Less than
      { name: '3 < 5', expr: bin('<', num(3), num(5)), expected: { kind: 'true' } },
      { name: '5 < 3', expr: bin('<', num(5), num(3)), expected: { kind: 'false' } },
      { name: '5 < 5', expr: bin('<', num(5), num(5)), expected: { kind: 'false' } },
      
      // Less or equal
      { name: '3 <= 5', expr: bin('<=', num(3), num(5)), expected: { kind: 'true' } },
      { name: '5 <= 5', expr: bin('<=', num(5), num(5)), expected: { kind: 'true' } },
      { name: '5 <= 3', expr: bin('<=', num(5), num(3)), expected: { kind: 'false' } },
      
      // Greater than
      { name: '5 > 3', expr: bin('>', num(5), num(3)), expected: { kind: 'true' } },
      { name: '3 > 5', expr: bin('>', num(3), num(5)), expected: { kind: 'false' } },
      { name: '5 > 5', expr: bin('>', num(5), num(5)), expected: { kind: 'false' } },
      
      // Greater or equal
      { name: '5 >= 3', expr: bin('>=', num(5), num(3)), expected: { kind: 'true' } },
      { name: '5 >= 5', expr: bin('>=', num(5), num(5)), expected: { kind: 'true' } },
      { name: '3 >= 5', expr: bin('>=', num(3), num(5)), expected: { kind: 'false' } },
    ]);
  });

  // ==========================================================================
  // LOGICAL OPERATORS
  // ==========================================================================
  
  describe('Logical Operators', () => {
    runGoldenTests([
      // AND
      { name: 'true and true', expr: bin('and', bool(true), bool(true)), expected: { kind: 'true' } },
      { name: 'true and false', expr: bin('and', bool(true), bool(false)), expected: { kind: 'false' } },
      { name: 'false and true', expr: bin('and', bool(false), bool(true)), expected: { kind: 'false' } },
      { name: 'false and false', expr: bin('and', bool(false), bool(false)), expected: { kind: 'false' } },
      
      // OR
      { name: 'true or true', expr: bin('or', bool(true), bool(true)), expected: { kind: 'true' } },
      { name: 'true or false', expr: bin('or', bool(true), bool(false)), expected: { kind: 'true' } },
      { name: 'false or true', expr: bin('or', bool(false), bool(true)), expected: { kind: 'true' } },
      { name: 'false or false', expr: bin('or', bool(false), bool(false)), expected: { kind: 'false' } },
      
      // NOT
      { name: 'not true', expr: unary('not', bool(true)), expected: { kind: 'false' } },
      { name: 'not false', expr: unary('not', bool(false)), expected: { kind: 'true' } },
      
      // IMPLIES
      { name: 'true implies true', expr: bin('implies', bool(true), bool(true)), expected: { kind: 'true' } },
      { name: 'true implies false', expr: bin('implies', bool(true), bool(false)), expected: { kind: 'false' } },
      { name: 'false implies true (vacuous)', expr: bin('implies', bool(false), bool(true)), expected: { kind: 'true' } },
      { name: 'false implies false (vacuous)', expr: bin('implies', bool(false), bool(false)), expected: { kind: 'true' } },
      
      // IFF
      { name: 'true iff true', expr: bin('iff', bool(true), bool(true)), expected: { kind: 'true' } },
      { name: 'false iff false', expr: bin('iff', bool(false), bool(false)), expected: { kind: 'true' } },
      { name: 'true iff false', expr: bin('iff', bool(true), bool(false)), expected: { kind: 'false' } },
    ]);
  });

  // ==========================================================================
  // SHORT-CIRCUIT EVALUATION
  // ==========================================================================
  
  describe('Short-Circuit Evaluation', () => {
    runGoldenTests([
      // false && unknown = false (short-circuit)
      { name: 'false and unknown', expr: bin('and', bool(false), id('unknown')), expected: { kind: 'false' } },
      // true || unknown = true (short-circuit)
      { name: 'true or unknown', expr: bin('or', bool(true), id('unknown')), expected: { kind: 'true' } },
      // false implies unknown = true (vacuous truth)
      { name: 'false implies unknown', expr: bin('implies', bool(false), id('unknown')), expected: { kind: 'true' } },
      // true && unknown = unknown (no short-circuit)
      { name: 'true and unknown', expr: bin('and', bool(true), id('unknown')), expected: { kind: 'unknown' } },
      // false || unknown = unknown (no short-circuit)
      { name: 'false or unknown', expr: bin('or', bool(false), id('unknown')), expected: { kind: 'unknown' } },
    ]);
  });

  // ==========================================================================
  // ARITHMETIC OPERATORS
  // ==========================================================================
  
  describe('Arithmetic Operators', () => {
    runGoldenTests([
      // Addition
      { name: '2 + 3', expr: bin('+', num(2), num(3)), expected: { kind: 'true', value: 5 } },
      { name: '-1 + 1', expr: bin('+', num(-1), num(1)), expected: { kind: 'true', value: 0 } },
      { name: '1.5 + 2.5', expr: bin('+', num(1.5), num(2.5)), expected: { kind: 'true', value: 4 } },
      { name: 'string concat', expr: bin('+', str('hello'), str(' world')), expected: { kind: 'true', value: 'hello world' } },
      
      // Subtraction
      { name: '10 - 3', expr: bin('-', num(10), num(3)), expected: { kind: 'true', value: 7 } },
      { name: '0 - 5', expr: bin('-', num(0), num(5)), expected: { kind: 'true', value: -5 } },
      
      // Multiplication
      { name: '4 * 5', expr: bin('*', num(4), num(5)), expected: { kind: 'true', value: 20 } },
      { name: '-2 * 3', expr: bin('*', num(-2), num(3)), expected: { kind: 'true', value: -6 } },
      { name: '0 * 100', expr: bin('*', num(0), num(100)), expected: { kind: 'true', value: 0 } },
      
      // Division
      { name: '10 / 2', expr: bin('/', num(10), num(2)), expected: { kind: 'true', value: 5 } },
      { name: '7 / 2', expr: bin('/', num(7), num(2)), expected: { kind: 'true', value: 3.5 } },
      { name: 'division by zero', expr: bin('/', num(10), num(0)), expected: { kind: 'unknown', reasonCode: 'DIVISION_BY_ZERO' } },
      
      // Modulo
      { name: '10 % 3', expr: bin('%', num(10), num(3)), expected: { kind: 'true', value: 1 } },
      { name: '15 % 5', expr: bin('%', num(15), num(5)), expected: { kind: 'true', value: 0 } },
      { name: 'modulo by zero', expr: bin('%', num(10), num(0)), expected: { kind: 'unknown', reasonCode: 'DIVISION_BY_ZERO' } },
      
      // Unary minus
      { name: '-5', expr: unary('-', num(5)), expected: { kind: 'true', value: -5 } },
      { name: '--5', expr: unary('-', unary('-', num(5))), expected: { kind: 'true', value: 5 } },
    ]);
  });

  // ==========================================================================
  // MEMBERSHIP OPERATOR
  // ==========================================================================
  
  describe('Membership Operator (in)', () => {
    runGoldenTests([
      // Array membership
      { name: '2 in [1,2,3]', expr: bin('in', num(2), list([num(1), num(2), num(3)])), expected: { kind: 'true' } },
      { name: '5 in [1,2,3]', expr: bin('in', num(5), list([num(1), num(2), num(3)])), expected: { kind: 'false' } },
      { name: '"b" in ["a","b","c"]', expr: bin('in', str('b'), list([str('a'), str('b'), str('c')])), expected: { kind: 'true' } },
      
      // String membership
      { name: '"world" in "hello world"', expr: bin('in', str('world'), str('hello world')), expected: { kind: 'true' } },
      { name: '"xyz" in "hello"', expr: bin('in', str('xyz'), str('hello')), expected: { kind: 'false' } },
      
      // Object key membership
      { name: '"name" in object', expr: bin('in', str('name'), id('obj')), ctx: { variables: new Map([['obj', { name: 'test' }]]) }, expected: { kind: 'true' } },
      { name: '"missing" in object', expr: bin('in', str('missing'), id('obj')), ctx: { variables: new Map([['obj', { name: 'test' }]]) }, expected: { kind: 'false' } },
    ]);
  });

  // ==========================================================================
  // QUANTIFIERS
  // ==========================================================================
  
  describe('Quantifiers', () => {
    runGoldenTests([
      // ALL (forall)
      { name: 'all positive', expr: quantifier('all', 'x', id('items'), bin('>', id('x'), num(0))), ctx: { variables: new Map([['items', [1, 2, 3]]]) }, expected: { kind: 'true' } },
      { name: 'all fails one', expr: quantifier('all', 'x', id('items'), bin('>', id('x'), num(0))), ctx: { variables: new Map([['items', [1, -1, 3]]]) }, expected: { kind: 'false' } },
      { name: 'all empty (vacuous)', expr: quantifier('all', 'x', id('items'), bool(false)), ctx: { variables: new Map([['items', []]]) }, expected: { kind: 'true' } },
      
      // ANY (exists)
      { name: 'any > 2', expr: quantifier('any', 'x', id('items'), bin('>', id('x'), num(2))), ctx: { variables: new Map([['items', [1, 2, 3]]]) }, expected: { kind: 'true' } },
      { name: 'any > 10', expr: quantifier('any', 'x', id('items'), bin('>', id('x'), num(10))), ctx: { variables: new Map([['items', [1, 2, 3]]]) }, expected: { kind: 'false' } },
      { name: 'any empty', expr: quantifier('any', 'x', id('items'), bool(true)), ctx: { variables: new Map([['items', []]]) }, expected: { kind: 'false' } },
      
      // NONE
      { name: 'none > 10', expr: quantifier('none', 'x', id('items'), bin('>', id('x'), num(10))), ctx: { variables: new Map([['items', [1, 2, 3]]]) }, expected: { kind: 'true' } },
      { name: 'none > 0', expr: quantifier('none', 'x', id('items'), bin('>', id('x'), num(0))), ctx: { variables: new Map([['items', [1, 2, 3]]]) }, expected: { kind: 'false' } },
      { name: 'none empty (vacuous)', expr: quantifier('none', 'x', id('items'), bool(true)), ctx: { variables: new Map([['items', []]]) }, expected: { kind: 'true' } },
      
      // COUNT
      { name: 'count > 2', expr: quantifier('count', 'x', id('items'), bin('>', id('x'), num(2))), ctx: { variables: new Map([['items', [1, 2, 3, 4, 5]]]) }, expected: { kind: 'true', value: 3 } },
      { name: 'count empty', expr: quantifier('count', 'x', id('items'), bool(true)), ctx: { variables: new Map([['items', []]]) }, expected: { kind: 'true', value: 0 } },
      
      // FILTER
      { name: 'filter > 2', expr: quantifier('filter', 'x', id('items'), bin('>', id('x'), num(2))), ctx: { variables: new Map([['items', [1, 2, 3, 4, 5]]]) }, expected: { kind: 'true', value: [3, 4, 5] } },
      { name: 'filter empty', expr: quantifier('filter', 'x', id('items'), bool(false)), ctx: { variables: new Map([['items', [1, 2, 3]]]) }, expected: { kind: 'true', value: [] } },
      
      // Unknown collection
      { name: 'quantifier over unknown', expr: quantifier('all', 'x', id('unknown'), bool(true)), expected: { kind: 'unknown', reasonCode: 'COLLECTION_UNKNOWN' } },
    ]);
  });

  // ==========================================================================
  // OLD EXPRESSION
  // ==========================================================================
  
  describe('old() Expression', () => {
    runGoldenTests([
      // Basic old access
      { name: 'old(balance)', expr: oldExpr(id('balance')), ctx: { oldState: new Map([['balance', 100]]) }, expected: { kind: 'true', value: 100 } },
      
      // Comparison with old
      { name: 'balance > old(balance)', expr: bin('>', id('balance'), oldExpr(id('balance'))), ctx: { variables: new Map([['balance', 150]]), oldState: new Map([['balance', 100]]) }, expected: { kind: 'true' } },
      
      // Old without state
      { name: 'old() without snapshot', expr: oldExpr(id('x')), expected: { kind: 'unknown', reasonCode: 'MISSING_OLD_STATE' } },
    ]);
  });

  // ==========================================================================
  // INPUT/RESULT EXPRESSIONS
  // ==========================================================================
  
  describe('Input/Result Expressions', () => {
    runGoldenTests([
      // InputExpr
      { name: 'input.email', expr: inputExpr('email'), ctx: { input: { email: 'test@example.com' } }, expected: { kind: 'true', value: 'test@example.com' } },
      { name: 'input.missing', expr: inputExpr('missing'), ctx: { input: { email: 'test' } }, expected: { kind: 'unknown', reasonCode: 'MISSING_INPUT' } },
      
      // ResultExpr
      { name: 'result (whole)', expr: resultExpr(), ctx: { result: { id: 123 } }, expected: { kind: 'true', value: { id: 123 } } },
      { name: 'result.id', expr: resultExpr('id'), ctx: { result: { id: 123, name: 'test' } }, expected: { kind: 'true', value: 123 } },
      { name: 'result.missing', expr: resultExpr('missing'), ctx: { result: { id: 123 } }, expected: { kind: 'unknown', reasonCode: 'MISSING_PROPERTY' } },
      { name: 'result not available', expr: resultExpr(), expected: { kind: 'unknown', reasonCode: 'MISSING_RESULT' } },
    ]);
  });

  // ==========================================================================
  // CONDITIONAL EXPRESSION
  // ==========================================================================
  
  describe('Conditional Expression', () => {
    runGoldenTests([
      { name: 'true ? 1 : 2', expr: conditional(bool(true), num(1), num(2)), expected: { kind: 'true', value: 1 } },
      { name: 'false ? 1 : 2', expr: conditional(bool(false), num(1), num(2)), expected: { kind: 'true', value: 2 } },
      { name: 'unknown ? 1 : 2', expr: conditional(id('unknown'), num(1), num(2)), expected: { kind: 'unknown', reasonCode: 'PROPAGATED' } },
    ]);
  });

  // ==========================================================================
  // INDEX EXPRESSION
  // ==========================================================================
  
  describe('Index Expression', () => {
    runGoldenTests([
      { name: 'arr[0]', expr: indexExpr(id('arr'), num(0)), ctx: { variables: new Map([['arr', [10, 20, 30]]]) }, expected: { kind: 'true', value: 10 } },
      { name: 'arr[2]', expr: indexExpr(id('arr'), num(2)), ctx: { variables: new Map([['arr', [10, 20, 30]]]) }, expected: { kind: 'true', value: 30 } },
      { name: 'arr[-1] (out of bounds)', expr: indexExpr(id('arr'), num(-1)), ctx: { variables: new Map([['arr', [1, 2, 3]]]) }, expected: { kind: 'false' } },
      { name: 'string[0]', expr: indexExpr(id('s'), num(0)), ctx: { variables: new Map([['s', 'hello']]) }, expected: { kind: 'true', value: 'h' } },
      { name: 'obj["key"]', expr: indexExpr(id('obj'), str('name')), ctx: { variables: new Map([['obj', { name: 'test' }]]) }, expected: { kind: 'true', value: 'test' } },
    ]);
  });

  // ==========================================================================
  // MAP EXPRESSION
  // ==========================================================================
  
  describe('Map Expression', () => {
    runGoldenTests([
      { name: '{ "a": 1, "b": 2 }', expr: mapExpr([{ key: str('a'), value: num(1) }, { key: str('b'), value: num(2) }]), expected: { kind: 'true', value: { a: 1, b: 2 } } },
      { name: 'empty map', expr: mapExpr([]), expected: { kind: 'true', value: {} } },
    ]);
  });

  // ==========================================================================
  // DURATION LITERAL
  // ==========================================================================
  
  describe('Duration Literal', () => {
    runGoldenTests([
      { name: '5 seconds', expr: duration(5, 'seconds'), expected: { kind: 'true' } },
      { name: '2 minutes', expr: duration(2, 'minutes'), expected: { kind: 'true' } },
      { name: '1 hour', expr: duration(1, 'hours'), expected: { kind: 'true' } },
    ]);
  });

  // ==========================================================================
  // REGEX LITERAL
  // ==========================================================================
  
  describe('Regex Literal', () => {
    runGoldenTests([
      { name: 'valid regex', expr: regex('[a-z]+', 'i'), expected: { kind: 'true' } },
      { name: 'invalid regex', expr: regex('[invalid(', ''), expected: { kind: 'unknown', reasonCode: 'INVALID_PATTERN' } },
    ]);
  });

  // ==========================================================================
  // BUILT-IN FUNCTIONS
  // ==========================================================================
  
  describe('Built-in Functions', () => {
    runGoldenTests([
      // is_valid
      { name: 'is_valid("test")', expr: call(id('is_valid'), [str('test')]), expected: { kind: 'true' } },
      { name: 'is_valid("")', expr: call(id('is_valid'), [str('')]), expected: { kind: 'false' } },
      { name: 'is_valid(null)', expr: call(id('is_valid'), [nullLit()]), expected: { kind: 'false' } },
      
      // length
      { name: 'length("hello")', expr: call(id('length'), [str('hello')]), expected: { kind: 'true', value: 5 } },
      { name: 'length([1,2,3])', expr: call(id('length'), [list([num(1), num(2), num(3)])]), expected: { kind: 'true', value: 3 } },
      
      // is_valid_format
      { name: 'is_valid_format email', expr: call(id('is_valid_format'), [str('test@example.com'), str('email')]), expected: { kind: 'true' } },
      { name: 'is_valid_format invalid email', expr: call(id('is_valid_format'), [str('not-an-email'), str('email')]), expected: { kind: 'false' } },
      { name: 'is_valid_format uuid', expr: call(id('is_valid_format'), [str('550e8400-e29b-41d4-a716-446655440000'), str('uuid')]), expected: { kind: 'true' } },
      
      // Math functions
      { name: 'abs(-5)', expr: call(id('abs'), [num(-5)]), expected: { kind: 'true', value: 5 } },
      { name: 'ceil(4.2)', expr: call(id('ceil'), [num(4.2)]), expected: { kind: 'true', value: 5 } },
      { name: 'floor(4.8)', expr: call(id('floor'), [num(4.8)]), expected: { kind: 'true', value: 4 } },
      { name: 'round(4.5)', expr: call(id('round'), [num(4.5)]), expected: { kind: 'true', value: 5 } },
      { name: 'min(3, 1, 5)', expr: call(id('min'), [num(3), num(1), num(5)]), expected: { kind: 'true', value: 1 } },
      { name: 'max(3, 1, 5)', expr: call(id('max'), [num(3), num(1), num(5)]), expected: { kind: 'true', value: 5 } },
      { name: 'pow(2, 3)', expr: call(id('pow'), [num(2), num(3)]), expected: { kind: 'true', value: 8 } },
      { name: 'sqrt(16)', expr: call(id('sqrt'), [num(16)]), expected: { kind: 'true', value: 4 } },
    ]);
  });

  // ==========================================================================
  // STRING METHODS
  // ==========================================================================
  
  describe('String Methods', () => {
    runGoldenTests([
      { name: 'str.startsWith', expr: call(member(id('s'), 'startsWith'), [str('hello')]), ctx: { variables: new Map([['s', 'hello world']]) }, expected: { kind: 'true' } },
      { name: 'str.endsWith', expr: call(member(id('s'), 'endsWith'), [str('world')]), ctx: { variables: new Map([['s', 'hello world']]) }, expected: { kind: 'true' } },
      { name: 'str.includes', expr: call(member(id('s'), 'includes'), [str('lo wo')]), ctx: { variables: new Map([['s', 'hello world']]) }, expected: { kind: 'true' } },
      { name: 'str.trim', expr: call(member(id('s'), 'trim'), []), ctx: { variables: new Map([['s', '  hello  ']]) }, expected: { kind: 'true', value: 'hello' } },
      { name: 'str.toLowerCase', expr: call(member(id('s'), 'toLowerCase'), []), ctx: { variables: new Map([['s', 'HELLO']]) }, expected: { kind: 'true', value: 'hello' } },
      { name: 'str.toUpperCase', expr: call(member(id('s'), 'toUpperCase'), []), ctx: { variables: new Map([['s', 'hello']]) }, expected: { kind: 'true', value: 'HELLO' } },
      { name: 'str.split', expr: call(member(id('s'), 'split'), [str(',')]), ctx: { variables: new Map([['s', 'a,b,c']]) }, expected: { kind: 'true', value: ['a', 'b', 'c'] } },
    ]);
  });

  // ==========================================================================
  // ARRAY METHODS
  // ==========================================================================
  
  describe('Array Methods', () => {
    runGoldenTests([
      { name: 'arr.indexOf', expr: call(member(id('arr'), 'indexOf'), [num(2)]), ctx: { variables: new Map([['arr', [1, 2, 3]]]) }, expected: { kind: 'true', value: 1 } },
      { name: 'arr.includes', expr: call(member(id('arr'), 'includes'), [num(2)]), ctx: { variables: new Map([['arr', [1, 2, 3]]]) }, expected: { kind: 'true' } },
      { name: 'arr.includes (not found)', expr: call(member(id('arr'), 'includes'), [num(5)]), ctx: { variables: new Map([['arr', [1, 2, 3]]]) }, expected: { kind: 'false' } },
      { name: 'arr.join', expr: call(member(id('arr'), 'join'), [str('-')]), ctx: { variables: new Map([['arr', ['a', 'b', 'c']]]) }, expected: { kind: 'true', value: 'a-b-c' } },
      { name: 'arr.slice', expr: call(member(id('arr'), 'slice'), [num(1), num(3)]), ctx: { variables: new Map([['arr', [1, 2, 3, 4, 5]]]) }, expected: { kind: 'true', value: [2, 3] } },
      { name: 'arr.reverse', expr: call(member(id('arr'), 'reverse'), []), ctx: { variables: new Map([['arr', [1, 2, 3]]]) }, expected: { kind: 'true', value: [3, 2, 1] } },
      { name: 'arr.first', expr: call(member(id('arr'), 'first'), []), ctx: { variables: new Map([['arr', [10, 20, 30]]]) }, expected: { kind: 'true', value: 10 } },
      { name: 'arr.last', expr: call(member(id('arr'), 'last'), []), ctx: { variables: new Map([['arr', [10, 20, 30]]]) }, expected: { kind: 'true', value: 30 } },
      { name: 'arr.isEmpty', expr: call(member(id('arr'), 'isEmpty'), []), ctx: { variables: new Map([['arr', []]]) }, expected: { kind: 'true' } },
      { name: 'arr.isEmpty (not empty)', expr: call(member(id('arr'), 'isEmpty'), []), ctx: { variables: new Map([['arr', [1]]]) }, expected: { kind: 'false' } },
    ]);
  });

  // ==========================================================================
  // COMPLEX EXPRESSIONS (Real-world patterns)
  // ==========================================================================
  
  describe('Complex Real-World Patterns', () => {
    runGoldenTests([
      // Pattern: success implies result.session.status == "ACTIVE"
      {
        name: 'success implies session active',
        expr: bin('implies', id('success'), bin('==', member(member(id('result'), 'session'), 'status'), str('ACTIVE'))),
        ctx: {
          variables: new Map([['success', true]]),
          result: { session: { status: 'ACTIVE', id: 'sess-123' } },
        },
        expected: { kind: 'true' },
      },
      
      // Pattern: result.balance == old(balance) + input.amount
      {
        name: 'balance postcondition',
        expr: bin('==', member(id('result'), 'balance'), bin('+', oldExpr(id('balance')), member(id('input'), 'amount'))),
        ctx: {
          result: { balance: 150 },
          input: { amount: 50 },
          oldState: new Map([['balance', 100]]),
        },
        expected: { kind: 'true' },
      },
      
      // Pattern: all item in items: item.price > 0
      {
        name: 'all items have positive price',
        expr: quantifier('all', 'item', id('items'), bin('>', member(id('item'), 'price'), num(0))),
        ctx: { variables: new Map([['items', [{ price: 10 }, { price: 20 }, { price: 30 }]]]) },
        expected: { kind: 'true' },
      },
      
      // Pattern: input.status in [ACTIVE, PENDING]
      {
        name: 'status in enum values',
        expr: bin('in', member(id('input'), 'status'), list([str('ACTIVE'), str('PENDING')])),
        ctx: { input: { status: 'ACTIVE' } },
        expected: { kind: 'true' },
      },
      
      // Pattern: is_valid_format(input.email, "email") and length(input.password) >= 8
      {
        name: 'email and password validation',
        expr: bin('and',
          call(id('is_valid_format'), [member(id('input'), 'email'), str('email')]),
          bin('>=', call(id('length'), [member(id('input'), 'password')]), num(8))
        ),
        ctx: { input: { email: 'user@example.com', password: 'secretpassword' } },
        expected: { kind: 'true' },
      },
    ]);
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  
  describe('Edge Cases', () => {
    runGoldenTests([
      // Deep equality for arrays
      { name: 'array equality', expr: bin('==', list([num(1), num(2)]), list([num(1), num(2)])), expected: { kind: 'true' } },
      { name: 'array inequality', expr: bin('==', list([num(1), num(2)]), list([num(1), num(3)])), expected: { kind: 'false' } },
      
      // Double negation
      { name: 'double negation', expr: unary('not', unary('not', bool(true))), expected: { kind: 'true' } },
      
      // Nested conditionals
      { name: 'nested conditional', expr: conditional(bool(true), conditional(bool(false), num(1), num(2)), num(3)), expected: { kind: 'true', value: 2 } },
      
      // Empty list
      { name: 'empty list', expr: list([]), expected: { kind: 'true', value: [] } },
      
      // Comparison with null
      { name: 'value == null (true)', expr: bin('==', id('x'), nullLit()), ctx: { variables: new Map([['x', null]]) }, expected: { kind: 'true' } },
      { name: 'value == null (false)', expr: bin('==', id('x'), nullLit()), ctx: { variables: new Map([['x', 'not null']]) }, expected: { kind: 'false' } },
    ]);
  });
});
