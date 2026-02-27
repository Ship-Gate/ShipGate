/**
 * IR Types and Normalization Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IR,
  resetNodeIdCounter,
  normalizeIR,
  serializeIR,
  type IRExpr,
} from '../src/index.js';

describe('IR Builders', () => {
  beforeEach(() => {
    resetNodeIdCounter();
  });

  describe('Literals', () => {
    it.each([
      ['null', IR.null(), 'null'],
      ['true', IR.bool(true), 'true'],
      ['false', IR.bool(false), 'false'],
      ['number 42', IR.number(42), '42'],
      ['number -3.14', IR.number(-3.14), '-3.14'],
      ['string "hello"', IR.string('hello'), '"hello"'],
      ['string empty', IR.string(''), '""'],
      ['regex /abc/i', IR.regex('abc', 'i'), '/abc/i'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });

    it('builds list correctly', () => {
      const list = IR.list([IR.number(1), IR.number(2), IR.number(3)]);
      expect(serializeIR(list)).toBe('[1, 2, 3]');
    });

    it('builds map correctly', () => {
      const map = IR.map([
        { key: 'a', value: IR.number(1) },
        { key: 'b', value: IR.string('two') },
      ]);
      expect(serializeIR(map)).toBe('{a: 1, b: "two"}');
    });
  });

  describe('Variables and Access', () => {
    it.each([
      ['variable x', IR.variable('x'), 'x'],
      ['property access', IR.prop(IR.variable('user'), 'name'), 'user.name'],
      ['nested property', IR.prop(IR.prop(IR.variable('a'), 'b'), 'c'), 'a.b.c'],
      ['index access', IR.index(IR.variable('arr'), IR.number(0)), 'arr[0]'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Existence Checks', () => {
    it.each([
      ['x != null', IR.exists(IR.variable('x'), true), '(x != null)'],
      ['x == null', IR.exists(IR.variable('x'), false), '(x == null)'],
      ['a.b != null', IR.exists(IR.prop(IR.variable('a'), 'b'), true), '(a.b != null)'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Comparisons', () => {
    it.each([
      ['x < 10', IR.compare('<', IR.variable('x'), IR.number(10)), '(x < 10)'],
      ['x <= 10', IR.compare('<=', IR.variable('x'), IR.number(10)), '(x <= 10)'],
      ['x > 0', IR.compare('>', IR.variable('x'), IR.number(0)), '(x > 0)'],
      ['x >= 0', IR.compare('>=', IR.variable('x'), IR.number(0)), '(x >= 0)'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Boolean Operations', () => {
    it.each([
      ['a && b', IR.and([IR.variable('a'), IR.variable('b')]), '(a && b)'],
      ['a || b', IR.or([IR.variable('a'), IR.variable('b')]), '(a || b)'],
      ['!a', IR.not(IR.variable('a')), '!a'],
      ['a => b', IR.implies(IR.variable('a'), IR.variable('b')), '(a => b)'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });

    it('builds multi-operand AND', () => {
      const ir = IR.and([IR.variable('a'), IR.variable('b'), IR.variable('c')]);
      expect(serializeIR(ir)).toBe('(a && b && c)');
    });

    it('builds multi-operand OR', () => {
      const ir = IR.or([IR.variable('a'), IR.variable('b'), IR.variable('c')]);
      expect(serializeIR(ir)).toBe('(a || b || c)');
    });
  });

  describe('String Operations', () => {
    it.each([
      ['str.length', IR.strLen(IR.variable('str')), 'str.length'],
      ['str.includes("x")', IR.strIncludes(IR.variable('str'), IR.string('x')), 'str.includes("x")'],
      ['str.startsWith("a")', IR.strStartsWith(IR.variable('str'), IR.string('a')), 'str.startsWith("a")'],
      ['str.endsWith("z")', IR.strEndsWith(IR.variable('str'), IR.string('z')), 'str.endsWith("z")'],
      ['str.matches(/abc/)', IR.strMatches(IR.variable('str'), IR.regex('abc', '')), 'str.matches(/abc/)'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Set Membership', () => {
    it.each([
      ['x in [1,2]', IR.inSet(IR.variable('x'), [IR.number(1), IR.number(2)], false), '(x in [1, 2])'],
      ['x not in [1]', IR.inSet(IR.variable('x'), [IR.number(1)], true), '(x not in [1])'],
      ['status in ["a","b"]', IR.inSet(IR.variable('status'), [IR.string('a'), IR.string('b')], false), '(status in ["a", "b"])'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Array Operations', () => {
    it.each([
      ['arr.length', IR.arrayLen(IR.variable('arr')), 'arr.length'],
      ['arr.includes(x)', IR.arrayIncludes(IR.variable('arr'), IR.variable('x')), 'arr.includes(x)'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Quantifiers', () => {
    it.each([
      ['all(x in xs, x > 0)', IR.quantAll(IR.variable('xs'), 'x', IR.compare('>', IR.variable('x'), IR.number(0))), 'all(x in xs, (x > 0))'],
      ['any(x in xs, x > 0)', IR.quantAny(IR.variable('xs'), 'x', IR.compare('>', IR.variable('x'), IR.number(0))), 'any(x in xs, (x > 0))'],
      ['none(x in xs, x < 0)', IR.quantNone(IR.variable('xs'), 'x', IR.compare('<', IR.variable('x'), IR.number(0))), 'none(x in xs, (x < 0))'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Special Expressions', () => {
    it.each([
      ['result', IR.result(), 'result'],
      ['result.id', IR.result('id'), 'result.id'],
      ['input.email', IR.input('email'), 'input.email'],
      ['old(x)', IR.old(IR.variable('x')), 'old(x)'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });

  describe('Entity Operations', () => {
    it.each([
      ['User.exists()', IR.entityExists('User'), 'User.exists()'],
      ['User.exists({id:1})', IR.entityExists('User', IR.map([{ key: 'id', value: IR.number(1) }])), 'User.exists({id: 1})'],
      ['User.count()', IR.entityCount('User'), 'User.count()'],
    ])('builds %s correctly', (_, ir, expected) => {
      expect(serializeIR(ir)).toBe(expected);
    });
  });
});

describe('IR Normalization', () => {
  beforeEach(() => {
    resetNodeIdCounter();
  });

  describe('AND flattening', () => {
    it('flattens nested ANDs', () => {
      const nested = IR.and([
        IR.and([IR.variable('a'), IR.variable('b')]),
        IR.variable('c'),
      ]);
      const normalized = normalizeIR(nested);
      expect(serializeIR(normalized)).toMatch(/\(.*a.*&&.*b.*&&.*c.*\)/);
    });

    it('removes duplicate operands', () => {
      const dup = IR.and([IR.variable('a'), IR.variable('a')]);
      const normalized = normalizeIR(dup);
      expect(serializeIR(normalized)).toBe('a');
    });

    it('returns true for empty AND', () => {
      const empty = IR.and([]);
      const normalized = normalizeIR(empty);
      expect(serializeIR(normalized)).toBe('true');
    });

    it('returns single operand for AND with one element', () => {
      const single = IR.and([IR.variable('x')]);
      const normalized = normalizeIR(single);
      expect(serializeIR(normalized)).toBe('x');
    });
  });

  describe('OR flattening', () => {
    it('flattens nested ORs', () => {
      const nested = IR.or([
        IR.or([IR.variable('a'), IR.variable('b')]),
        IR.variable('c'),
      ]);
      const normalized = normalizeIR(nested);
      expect(serializeIR(normalized)).toMatch(/\(.*a.*\|\|.*b.*\|\|.*c.*\)/);
    });

    it('returns false for empty OR', () => {
      const empty = IR.or([]);
      const normalized = normalizeIR(empty);
      expect(serializeIR(normalized)).toBe('false');
    });
  });

  describe('Sorting for determinism', () => {
    it('sorts AND operands alphabetically', () => {
      const unsorted = IR.and([IR.variable('z'), IR.variable('a'), IR.variable('m')]);
      const normalized = normalizeIR(unsorted);
      // After sorting: a, m, z
      expect(serializeIR(normalized)).toBe('(a && m && z)');
    });

    it('sorts InSet values', () => {
      const unsorted = IR.inSet(IR.variable('x'), [IR.string('c'), IR.string('a'), IR.string('b')], false);
      const normalized = normalizeIR(unsorted);
      expect(serializeIR(normalized)).toBe('(x in ["a", "b", "c"])');
    });
  });
});
