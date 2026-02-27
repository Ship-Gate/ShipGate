/**
 * Evaluator Tests - Table-driven tests for all 25 patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IR,
  evaluate,
  createEvaluationContext,
  resetNodeIdCounter,
  type IRExpr,
  type ContextOptions,
} from '../src/index.js';

// Helper to create context and evaluate
function eval_(ir: IRExpr, opts: ContextOptions = {}): unknown {
  return evaluate(ir, createEvaluationContext(opts));
}

describe('Pattern 1: Existence Checks (x != null, x == null)', () => {
  beforeEach(() => resetNodeIdCounter());

  const existenceTests = [
    // [description, IR expression, context options, expected result]
    ['x != null when x is "hello"', IR.exists(IR.variable('x'), true), { variables: { x: 'hello' } }, true],
    ['x != null when x is null', IR.exists(IR.variable('x'), true), { variables: { x: null } }, false],
    ['x != null when x is undefined', IR.exists(IR.variable('x'), true), { variables: {} }, false],
    ['x != null when x is 0', IR.exists(IR.variable('x'), true), { variables: { x: 0 } }, true],
    ['x != null when x is ""', IR.exists(IR.variable('x'), true), { variables: { x: '' } }, true],
    ['x == null when x is null', IR.exists(IR.variable('x'), false), { variables: { x: null } }, true],
    ['x == null when x is "hello"', IR.exists(IR.variable('x'), false), { variables: { x: 'hello' } }, false],
    ['a.b != null when a.b exists', IR.exists(IR.prop(IR.variable('a'), 'b'), true), { variables: { a: { b: 1 } } }, true],
    ['a.b != null when a.b is null', IR.exists(IR.prop(IR.variable('a'), 'b'), true), { variables: { a: { b: null } } }, false],
    ['a.b != null when a is null', IR.exists(IR.prop(IR.variable('a'), 'b'), true), { variables: { a: null } }, false],
  ] as const;

  it.each(existenceTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });
});

describe('Pattern 2: String Operations', () => {
  beforeEach(() => resetNodeIdCounter());

  describe('String Length', () => {
    const lengthTests = [
      ['length of "hello" is 5', IR.strLen(IR.variable('s')), { variables: { s: 'hello' } }, 5],
      ['length of "" is 0', IR.strLen(IR.variable('s')), { variables: { s: '' } }, 0],
      ['length of null is 0', IR.strLen(IR.variable('s')), { variables: { s: null } }, 0],
    ] as const;

    it.each(lengthTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });

    const lengthComparisonTests = [
      ['length > 0 for "hello"', IR.compare('>', IR.strLen(IR.variable('s')), IR.number(0)), { variables: { s: 'hello' } }, true],
      ['length > 0 for ""', IR.compare('>', IR.strLen(IR.variable('s')), IR.number(0)), { variables: { s: '' } }, false],
      ['length >= 5 for "hello"', IR.compare('>=', IR.strLen(IR.variable('s')), IR.number(5)), { variables: { s: 'hello' } }, true],
      ['length < 10 for "hello"', IR.compare('<', IR.strLen(IR.variable('s')), IR.number(10)), { variables: { s: 'hello' } }, true],
    ] as const;

    it.each(lengthComparisonTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('String Matches (Regex)', () => {
    const matchTests = [
      ['matches email regex', IR.strMatches(IR.variable('s'), IR.regex('^[^@]+@[^@]+$', '')), { variables: { s: 'test@example.com' } }, true],
      ['does not match email regex', IR.strMatches(IR.variable('s'), IR.regex('^[^@]+@[^@]+$', '')), { variables: { s: 'invalid' } }, false],
      ['matches case insensitive', IR.strMatches(IR.variable('s'), IR.regex('hello', 'i')), { variables: { s: 'HELLO' } }, true],
      ['matches digits', IR.strMatches(IR.variable('s'), IR.regex('^\\d+$', '')), { variables: { s: '12345' } }, true],
      ['does not match digits', IR.strMatches(IR.variable('s'), IR.regex('^\\d+$', '')), { variables: { s: 'abc' } }, false],
    ] as const;

    it.each(matchTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('String Includes', () => {
    const includesTests = [
      ['"hello world" includes "world"', IR.strIncludes(IR.variable('s'), IR.string('world')), { variables: { s: 'hello world' } }, true],
      ['"hello" does not include "world"', IR.strIncludes(IR.variable('s'), IR.string('world')), { variables: { s: 'hello' } }, false],
      ['empty string includes ""', IR.strIncludes(IR.variable('s'), IR.string('')), { variables: { s: '' } }, true],
      ['"abc" includes ""', IR.strIncludes(IR.variable('s'), IR.string('')), { variables: { s: 'abc' } }, true],
    ] as const;

    it.each(includesTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('String StartsWith/EndsWith', () => {
    const startsEndsTests = [
      ['"hello" startsWith "he"', IR.strStartsWith(IR.variable('s'), IR.string('he')), { variables: { s: 'hello' } }, true],
      ['"hello" startsWith "lo"', IR.strStartsWith(IR.variable('s'), IR.string('lo')), { variables: { s: 'hello' } }, false],
      ['"hello" endsWith "lo"', IR.strEndsWith(IR.variable('s'), IR.string('lo')), { variables: { s: 'hello' } }, true],
      ['"hello" endsWith "he"', IR.strEndsWith(IR.variable('s'), IR.string('he')), { variables: { s: 'hello' } }, false],
    ] as const;

    it.each(startsEndsTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });
});

describe('Pattern 3: Number Comparisons', () => {
  beforeEach(() => resetNodeIdCounter());

  const comparisonTests = [
    ['5 < 10', IR.compare('<', IR.number(5), IR.number(10)), {}, true],
    ['10 < 5', IR.compare('<', IR.number(10), IR.number(5)), {}, false],
    ['5 < 5', IR.compare('<', IR.number(5), IR.number(5)), {}, false],
    ['5 <= 10', IR.compare('<=', IR.number(5), IR.number(10)), {}, true],
    ['5 <= 5', IR.compare('<=', IR.number(5), IR.number(5)), {}, true],
    ['10 > 5', IR.compare('>', IR.number(10), IR.number(5)), {}, true],
    ['5 > 10', IR.compare('>', IR.number(5), IR.number(10)), {}, false],
    ['5 >= 5', IR.compare('>=', IR.number(5), IR.number(5)), {}, true],
    ['x > 0 where x=5', IR.compare('>', IR.variable('x'), IR.number(0)), { variables: { x: 5 } }, true],
    ['x > 0 where x=-1', IR.compare('>', IR.variable('x'), IR.number(0)), { variables: { x: -1 } }, false],
  ] as const;

  it.each(comparisonTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });

  describe('Between', () => {
    const betweenTests = [
      ['5 between 0 and 10 (inclusive)', IR.between(IR.number(5), IR.number(0), IR.number(10), true), {}, true],
      ['0 between 0 and 10 (inclusive)', IR.between(IR.number(0), IR.number(0), IR.number(10), true), {}, true],
      ['10 between 0 and 10 (inclusive)', IR.between(IR.number(10), IR.number(0), IR.number(10), true), {}, true],
      ['0 between 0 and 10 (exclusive)', IR.between(IR.number(0), IR.number(0), IR.number(10), false), {}, false],
      ['5 between 0 and 10 (exclusive)', IR.between(IR.number(5), IR.number(0), IR.number(10), false), {}, true],
      ['-1 between 0 and 10', IR.between(IR.number(-1), IR.number(0), IR.number(10), true), {}, false],
      ['15 between 0 and 10', IR.between(IR.number(15), IR.number(0), IR.number(10), true), {}, false],
    ] as const;

    it.each(betweenTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });
});

describe('Pattern 4: Enum/Set Membership', () => {
  beforeEach(() => resetNodeIdCounter());

  const inSetTests = [
    ['"a" in ["a","b","c"]', IR.inSet(IR.string('a'), [IR.string('a'), IR.string('b'), IR.string('c')], false), {}, true],
    ['"d" in ["a","b","c"]', IR.inSet(IR.string('d'), [IR.string('a'), IR.string('b'), IR.string('c')], false), {}, false],
    ['"a" not in ["a","b"]', IR.inSet(IR.string('a'), [IR.string('a'), IR.string('b')], true), {}, false],
    ['"x" not in ["a","b"]', IR.inSet(IR.string('x'), [IR.string('a'), IR.string('b')], true), {}, true],
    ['1 in [1,2,3]', IR.inSet(IR.number(1), [IR.number(1), IR.number(2), IR.number(3)], false), {}, true],
    ['5 in [1,2,3]', IR.inSet(IR.number(5), [IR.number(1), IR.number(2), IR.number(3)], false), {}, false],
    ['status in ["paid","succeeded"]', IR.inSet(IR.variable('status'), [IR.string('paid'), IR.string('succeeded')], false), { variables: { status: 'paid' } }, true],
    ['status in ["paid","succeeded"]', IR.inSet(IR.variable('status'), [IR.string('paid'), IR.string('succeeded')], false), { variables: { status: 'pending' } }, false],
  ] as const;

  it.each(inSetTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });
});

describe('Pattern 5: Boolean Operations', () => {
  beforeEach(() => resetNodeIdCounter());

  describe('AND (&&)', () => {
    const andTests = [
      ['true && true', IR.and([IR.bool(true), IR.bool(true)]), {}, true],
      ['true && false', IR.and([IR.bool(true), IR.bool(false)]), {}, false],
      ['false && true', IR.and([IR.bool(false), IR.bool(true)]), {}, false],
      ['false && false', IR.and([IR.bool(false), IR.bool(false)]), {}, false],
      ['a && b (true, true)', IR.and([IR.variable('a'), IR.variable('b')]), { variables: { a: true, b: true } }, true],
      ['a && b && c', IR.and([IR.variable('a'), IR.variable('b'), IR.variable('c')]), { variables: { a: true, b: true, c: true } }, true],
      ['a && b && c (one false)', IR.and([IR.variable('a'), IR.variable('b'), IR.variable('c')]), { variables: { a: true, b: false, c: true } }, false],
    ] as const;

    it.each(andTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('OR (||)', () => {
    const orTests = [
      ['true || true', IR.or([IR.bool(true), IR.bool(true)]), {}, true],
      ['true || false', IR.or([IR.bool(true), IR.bool(false)]), {}, true],
      ['false || true', IR.or([IR.bool(false), IR.bool(true)]), {}, true],
      ['false || false', IR.or([IR.bool(false), IR.bool(false)]), {}, false],
      ['a || b (false, true)', IR.or([IR.variable('a'), IR.variable('b')]), { variables: { a: false, b: true } }, true],
    ] as const;

    it.each(orTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('NOT (!)', () => {
    const notTests = [
      ['!true', IR.not(IR.bool(true)), {}, false],
      ['!false', IR.not(IR.bool(false)), {}, true],
      ['!a where a=true', IR.not(IR.variable('a')), { variables: { a: true } }, false],
      ['!a where a=false', IR.not(IR.variable('a')), { variables: { a: false } }, true],
      ['!!true', IR.not(IR.not(IR.bool(true))), {}, true],
    ] as const;

    it.each(notTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('Implies (=>)', () => {
    const impliesTests = [
      ['true => true', IR.implies(IR.bool(true), IR.bool(true)), {}, true],
      ['true => false', IR.implies(IR.bool(true), IR.bool(false)), {}, false],
      ['false => true', IR.implies(IR.bool(false), IR.bool(true)), {}, true],
      ['false => false', IR.implies(IR.bool(false), IR.bool(false)), {}, true],
    ] as const;

    it.each(impliesTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });
});

describe('Pattern 6: Property Chains', () => {
  beforeEach(() => resetNodeIdCounter());

  const chainTests = [
    ['a.b', IR.prop(IR.variable('a'), 'b'), { variables: { a: { b: 'value' } } }, 'value'],
    ['a.b.c', IR.prop(IR.prop(IR.variable('a'), 'b'), 'c'), { variables: { a: { b: { c: 123 } } } }, 123],
    ['result.user.id', IR.prop(IR.prop(IR.result(), 'user'), 'id'), { result: { user: { id: 'uid-123' } } }, 'uid-123'],
    ['a.b when a is null', IR.prop(IR.variable('a'), 'b'), { variables: { a: null } }, undefined],
    ['a.b.c when b is null', IR.prop(IR.prop(IR.variable('a'), 'b'), 'c'), { variables: { a: { b: null } } }, undefined],
  ] as const;

  it.each(chainTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });

  it('result.user.id != null (exists)', () => {
    const ir = IR.exists(IR.prop(IR.prop(IR.result(), 'user'), 'id'), true);
    expect(eval_(ir, { result: { user: { id: 'x' } } })).toBe(true);
    expect(eval_(ir, { result: { user: { id: null } } })).toBe(false);
    expect(eval_(ir, { result: { user: {} } })).toBe(false);
  });
});

describe('Pattern 7: Array Operations', () => {
  beforeEach(() => resetNodeIdCounter());

  describe('Array Length', () => {
    const lengthTests = [
      ['[1,2,3].length', IR.arrayLen(IR.variable('arr')), { variables: { arr: [1, 2, 3] } }, 3],
      ['[].length', IR.arrayLen(IR.variable('arr')), { variables: { arr: [] } }, 0],
      ['items.length > 0', IR.compare('>', IR.arrayLen(IR.variable('items')), IR.number(0)), { variables: { items: [1] } }, true],
      ['items.length > 0 (empty)', IR.compare('>', IR.arrayLen(IR.variable('items')), IR.number(0)), { variables: { items: [] } }, false],
    ] as const;

    it.each(lengthTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('Array Includes', () => {
    const includesTests = [
      ['[1,2,3] includes 2', IR.arrayIncludes(IR.variable('arr'), IR.number(2)), { variables: { arr: [1, 2, 3] } }, true],
      ['[1,2,3] includes 5', IR.arrayIncludes(IR.variable('arr'), IR.number(5)), { variables: { arr: [1, 2, 3] } }, false],
      ['["a","b"] includes "a"', IR.arrayIncludes(IR.variable('arr'), IR.string('a')), { variables: { arr: ['a', 'b'] } }, true],
    ] as const;

    it.each(includesTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('Array Every/Some', () => {
    it('every item > 0', () => {
      const ir = IR.arrayEvery(IR.variable('arr'), 'x', IR.compare('>', IR.variable('x'), IR.number(0)));
      expect(eval_(ir, { variables: { arr: [1, 2, 3] } })).toBe(true);
      expect(eval_(ir, { variables: { arr: [1, -1, 3] } })).toBe(false);
      expect(eval_(ir, { variables: { arr: [] } })).toBe(true); // vacuous truth
    });

    it('some item > 0', () => {
      const ir = IR.arraySome(IR.variable('arr'), 'x', IR.compare('>', IR.variable('x'), IR.number(0)));
      expect(eval_(ir, { variables: { arr: [-1, 0, 1] } })).toBe(true);
      expect(eval_(ir, { variables: { arr: [-1, -2] } })).toBe(false);
      expect(eval_(ir, { variables: { arr: [] } })).toBe(false);
    });
  });
});

describe('Pattern 8: Status Checks', () => {
  beforeEach(() => resetNodeIdCounter());

  const statusTests = [
    ['status in ["succeeded","paid"]', IR.inSet(IR.variable('status'), [IR.string('succeeded'), IR.string('paid')], false), { variables: { status: 'succeeded' } }, true],
    ['status in ["succeeded","paid"]', IR.inSet(IR.variable('status'), [IR.string('succeeded'), IR.string('paid')], false), { variables: { status: 'paid' } }, true],
    ['status in ["succeeded","paid"]', IR.inSet(IR.variable('status'), [IR.string('succeeded'), IR.string('paid')], false), { variables: { status: 'pending' } }, false],
    ['result.status in ["active"]', IR.inSet(IR.prop(IR.result(), 'status'), [IR.string('active')], false), { result: { status: 'active' } }, true],
  ] as const;

  it.each(statusTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });
});

describe('Pattern 9: Quantifiers', () => {
  beforeEach(() => resetNodeIdCounter());

  describe('all(x in xs, predicate)', () => {
    const allTests = [
      ['all positive', IR.quantAll(IR.variable('nums'), 'n', IR.compare('>', IR.variable('n'), IR.number(0))), { variables: { nums: [1, 2, 3] } }, true],
      ['not all positive', IR.quantAll(IR.variable('nums'), 'n', IR.compare('>', IR.variable('n'), IR.number(0))), { variables: { nums: [1, -2, 3] } }, false],
      ['all in empty', IR.quantAll(IR.variable('nums'), 'n', IR.compare('>', IR.variable('n'), IR.number(0))), { variables: { nums: [] } }, true],
    ] as const;

    it.each(allTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('any(x in xs, predicate)', () => {
    const anyTests = [
      ['any negative', IR.quantAny(IR.variable('nums'), 'n', IR.compare('<', IR.variable('n'), IR.number(0))), { variables: { nums: [1, -2, 3] } }, true],
      ['none negative', IR.quantAny(IR.variable('nums'), 'n', IR.compare('<', IR.variable('n'), IR.number(0))), { variables: { nums: [1, 2, 3] } }, false],
      ['any in empty', IR.quantAny(IR.variable('nums'), 'n', IR.compare('<', IR.variable('n'), IR.number(0))), { variables: { nums: [] } }, false],
    ] as const;

    it.each(anyTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('none(x in xs, predicate)', () => {
    const noneTests = [
      ['none negative', IR.quantNone(IR.variable('nums'), 'n', IR.compare('<', IR.variable('n'), IR.number(0))), { variables: { nums: [1, 2, 3] } }, true],
      ['has negative', IR.quantNone(IR.variable('nums'), 'n', IR.compare('<', IR.variable('n'), IR.number(0))), { variables: { nums: [1, -2, 3] } }, false],
    ] as const;

    it.each(noneTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });

  describe('count(x in xs, predicate)', () => {
    const countTests = [
      ['count > 0', IR.quantCount(IR.variable('nums'), 'n', IR.compare('>', IR.variable('n'), IR.number(0))), { variables: { nums: [1, -2, 3, -4, 5] } }, 3],
      ['count all match', IR.quantCount(IR.variable('nums'), 'n', IR.compare('>', IR.variable('n'), IR.number(0))), { variables: { nums: [1, 2, 3] } }, 3],
      ['count none match', IR.quantCount(IR.variable('nums'), 'n', IR.compare('>', IR.variable('n'), IR.number(0))), { variables: { nums: [-1, -2, -3] } }, 0],
    ] as const;

    it.each(countTests)('%s', (_, ir, opts, expected) => {
      expect(eval_(ir, opts)).toBe(expected);
    });
  });
});

describe('Pattern 10: Entity Operations', () => {
  beforeEach(() => resetNodeIdCounter());

  const entities = {
    User: [
      { id: 'u1', email: 'alice@example.com', status: 'active' },
      { id: 'u2', email: 'bob@example.com', status: 'pending' },
    ],
  };

  describe('Entity.exists()', () => {
    it('exists with no criteria returns true when entities exist', () => {
      const ir = IR.entityExists('User');
      expect(eval_(ir, { entities })).toBe(true);
    });

    it('exists with no criteria returns false when no entities', () => {
      const ir = IR.entityExists('User');
      expect(eval_(ir, { entities: {} })).toBe(false);
    });

    it('exists with criteria finds matching entity', () => {
      const ir = IR.entityExists('User', IR.map([{ key: 'email', value: IR.string('alice@example.com') }]));
      expect(eval_(ir, { entities })).toBe(true);
    });

    it('exists with criteria returns false when no match', () => {
      const ir = IR.entityExists('User', IR.map([{ key: 'email', value: IR.string('nobody@example.com') }]));
      expect(eval_(ir, { entities })).toBe(false);
    });
  });

  describe('Entity.count()', () => {
    it('count with no criteria', () => {
      const ir = IR.entityCount('User');
      expect(eval_(ir, { entities })).toBe(2);
    });

    it('count with criteria', () => {
      const ir = IR.entityCount('User', IR.map([{ key: 'status', value: IR.string('active') }]));
      expect(eval_(ir, { entities })).toBe(1);
    });

    it('count returns 0 for unknown entity', () => {
      const ir = IR.entityCount('Unknown');
      expect(eval_(ir, { entities })).toBe(0);
    });
  });

  describe('Entity.lookup()', () => {
    it('lookup finds entity', () => {
      const ir = IR.entityLookup('User', IR.map([{ key: 'id', value: IR.string('u1') }]));
      const result = eval_(ir, { entities });
      expect(result).toEqual({ id: 'u1', email: 'alice@example.com', status: 'active' });
    });

    it('lookup returns undefined when not found', () => {
      const ir = IR.entityLookup('User', IR.map([{ key: 'id', value: IR.string('u999') }]));
      expect(eval_(ir, { entities })).toBeUndefined();
    });
  });
});

describe('Special: Input and Result', () => {
  beforeEach(() => resetNodeIdCounter());

  describe('Input values', () => {
    it('input.email', () => {
      const ir = IR.input('email');
      expect(eval_(ir, { input: { email: 'test@example.com' } })).toBe('test@example.com');
    });

    it('input.email == result.email', () => {
      const ir = IR.eq(IR.input('email'), IR.prop(IR.result(), 'email'), false);
      expect(eval_(ir, { input: { email: 'a@b.com' }, result: { email: 'a@b.com' } })).toBe(true);
      expect(eval_(ir, { input: { email: 'a@b.com' }, result: { email: 'x@y.com' } })).toBe(false);
    });
  });

  describe('Result values', () => {
    it('result', () => {
      const ir = IR.result();
      expect(eval_(ir, { result: { id: 123 } })).toEqual({ id: 123 });
    });

    it('result.id', () => {
      const ir = IR.result('id');
      expect(eval_(ir, { result: { id: 'abc-123' } })).toBe('abc-123');
    });

    it('result != null', () => {
      const ir = IR.exists(IR.result(), true);
      expect(eval_(ir, { result: { id: 1 } })).toBe(true);
      expect(eval_(ir, { result: null })).toBe(false);
    });
  });
});

describe('Arithmetic Operations', () => {
  beforeEach(() => resetNodeIdCounter());

  const arithmeticTests = [
    ['5 + 3', IR.arithmetic('+', IR.number(5), IR.number(3)), {}, 8],
    ['10 - 3', IR.arithmetic('-', IR.number(10), IR.number(3)), {}, 7],
    ['4 * 5', IR.arithmetic('*', IR.number(4), IR.number(5)), {}, 20],
    ['15 / 3', IR.arithmetic('/', IR.number(15), IR.number(3)), {}, 5],
    ['17 % 5', IR.arithmetic('%', IR.number(17), IR.number(5)), {}, 2],
    ['x + y', IR.arithmetic('+', IR.variable('x'), IR.variable('y')), { variables: { x: 10, y: 20 } }, 30],
    ['division by zero', IR.arithmetic('/', IR.number(10), IR.number(0)), {}, 0],
  ] as const;

  it.each(arithmeticTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });
});

describe('Conditional Expressions', () => {
  beforeEach(() => resetNodeIdCounter());

  const conditionalTests = [
    ['true ? 1 : 2', IR.conditional(IR.bool(true), IR.number(1), IR.number(2)), {}, 1],
    ['false ? 1 : 2', IR.conditional(IR.bool(false), IR.number(1), IR.number(2)), {}, 2],
    ['x > 0 ? "pos" : "neg"', IR.conditional(IR.compare('>', IR.variable('x'), IR.number(0)), IR.string('pos'), IR.string('neg')), { variables: { x: 5 } }, 'pos'],
    ['x > 0 ? "pos" : "neg"', IR.conditional(IR.compare('>', IR.variable('x'), IR.number(0)), IR.string('pos'), IR.string('neg')), { variables: { x: -5 } }, 'neg'],
  ] as const;

  it.each(conditionalTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });
});

describe('Equality Checks', () => {
  beforeEach(() => resetNodeIdCounter());

  const equalityTests = [
    ['5 == 5', IR.eq(IR.number(5), IR.number(5), false), {}, true],
    ['5 == 6', IR.eq(IR.number(5), IR.number(6), false), {}, false],
    ['"a" == "a"', IR.eq(IR.string('a'), IR.string('a'), false), {}, true],
    ['"a" != "b"', IR.eq(IR.string('a'), IR.string('b'), true), {}, true],
    ['deep equality [1,2] == [1,2]', IR.eq(IR.list([IR.number(1), IR.number(2)]), IR.list([IR.number(1), IR.number(2)]), false), {}, true],
    ['deep equality [1,2] == [1,3]', IR.eq(IR.list([IR.number(1), IR.number(2)]), IR.list([IR.number(1), IR.number(3)]), false), {}, false],
  ] as const;

  it.each(equalityTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });
});

describe('Function Calls', () => {
  beforeEach(() => resetNodeIdCounter());

  const funcTests = [
    ['length([1,2,3])', IR.call('length', [IR.list([IR.number(1), IR.number(2), IR.number(3)])]), {}, 3],
    ['count([1,2,3])', IR.call('count', [IR.list([IR.number(1), IR.number(2), IR.number(3)])]), {}, 3],
    ['sum([1,2,3])', IR.call('sum', [IR.list([IR.number(1), IR.number(2), IR.number(3)])]), {}, 6],
    ['min([5,2,8])', IR.call('min', [IR.list([IR.number(5), IR.number(2), IR.number(8)])]), {}, 2],
    ['max([5,2,8])', IR.call('max', [IR.list([IR.number(5), IR.number(2), IR.number(8)])]), {}, 8],
    ['abs(-5)', IR.call('abs', [IR.number(-5)]), {}, 5],
    ['round(3.7)', IR.call('round', [IR.number(3.7)]), {}, 4],
    ['floor(3.7)', IR.call('floor', [IR.number(3.7)]), {}, 3],
    ['ceil(3.2)', IR.call('ceil', [IR.number(3.2)]), {}, 4],
    ['between(5, 0, 10)', IR.call('between', [IR.number(5), IR.number(0), IR.number(10)]), {}, true],
  ] as const;

  it.each(funcTests)('%s', (_, ir, opts, expected) => {
    expect(eval_(ir, opts)).toBe(expected);
  });
});
