// ============================================================================
// Built-in Functions Tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  createBuiltinRegistry,
  getDefaultBuiltins,
  createEntityStore,
  TypeError,
  RuntimeError,
} from '../src/index.js';
import type { EvaluationContext, SourceLocation, BuiltinRegistry } from '../src/index.js';

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

function callBuiltin(
  registry: BuiltinRegistry,
  name: string,
  args: unknown[],
  ctx?: EvaluationContext
): unknown {
  const fn = registry.get(name);
  if (!fn) throw new Error(`Builtin not found: ${name}`);
  return fn(args, ctx ?? createContext(), defaultLocation);
}

// ============================================================================
// REGISTRY TESTS
// ============================================================================

describe('BuiltinRegistry', () => {
  it('creates a registry with default builtins', () => {
    const registry = createBuiltinRegistry();
    
    expect(registry.has('len')).toBe(true);
    expect(registry.has('sum')).toBe(true);
    expect(registry.has('all')).toBe(true);
    expect(registry.has('any')).toBe(true);
  });

  it('lists all registered builtins', () => {
    const registry = createBuiltinRegistry();
    const list = registry.list();
    
    expect(list).toContain('len');
    expect(list).toContain('sum');
    expect(list).toContain('min');
    expect(list).toContain('max');
  });

  it('allows registering custom builtins', () => {
    const registry = createBuiltinRegistry();
    
    registry.register('customFn', (args) => (args[0] as number) * 2);
    
    expect(registry.has('customFn')).toBe(true);
    expect(callBuiltin(registry, 'customFn', [5])).toBe(10);
  });

  it('returns undefined for unknown builtins', () => {
    const registry = createBuiltinRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });
});

// ============================================================================
// TIME FUNCTIONS
// ============================================================================

describe('Builtin - now()', () => {
  it('returns the current timestamp from context', () => {
    const registry = getDefaultBuiltins();
    const testDate = new Date('2024-06-15T12:00:00Z');
    const ctx = createContext({ now: testDate });
    
    expect(callBuiltin(registry, 'now', [], ctx)).toEqual(testDate);
  });
});

// ============================================================================
// COLLECTION FUNCTIONS
// ============================================================================

describe('Builtin - len()', () => {
  const registry = getDefaultBuiltins();

  it('returns array length', () => {
    expect(callBuiltin(registry, 'len', [[1, 2, 3]])).toBe(3);
    expect(callBuiltin(registry, 'len', [[]])).toBe(0);
  });

  it('returns string length', () => {
    expect(callBuiltin(registry, 'len', ['hello'])).toBe(5);
    expect(callBuiltin(registry, 'len', [''])).toBe(0);
  });

  it('returns map size', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    expect(callBuiltin(registry, 'len', [map])).toBe(2);
  });

  it('returns object key count', () => {
    expect(callBuiltin(registry, 'len', [{ a: 1, b: 2, c: 3 }])).toBe(3);
  });

  it('throws for non-collection types', () => {
    expect(() => callBuiltin(registry, 'len', [42])).toThrow(TypeError);
    expect(() => callBuiltin(registry, 'len', [null])).toThrow(TypeError);
  });
});

describe('Builtin - count()', () => {
  const registry = getDefaultBuiltins();

  it('counts array elements', () => {
    expect(callBuiltin(registry, 'count', [[1, 2, 3, 4, 5]])).toBe(5);
  });

  it('counts with predicate', () => {
    const isEven = (x: unknown) => (x as number) % 2 === 0;
    expect(callBuiltin(registry, 'count', [[1, 2, 3, 4, 5], isEven])).toBe(2);
  });

  it('throws for non-arrays', () => {
    expect(() => callBuiltin(registry, 'count', ['string'])).toThrow(TypeError);
  });
});

describe('Builtin - sum()', () => {
  const registry = getDefaultBuiltins();

  it('sums numeric arrays', () => {
    expect(callBuiltin(registry, 'sum', [[1, 2, 3, 4, 5]])).toBe(15);
    expect(callBuiltin(registry, 'sum', [[]])).toBe(0);
  });

  it('sums with selector function', () => {
    const items = [{ value: 10 }, { value: 20 }, { value: 30 }];
    const selector = (item: unknown) => (item as { value: number }).value;
    expect(callBuiltin(registry, 'sum', [items, selector])).toBe(60);
  });

  it('throws for non-numeric arrays without selector', () => {
    expect(() => callBuiltin(registry, 'sum', [['a', 'b', 'c']])).toThrow(TypeError);
  });

  it('throws for non-arrays', () => {
    expect(() => callBuiltin(registry, 'sum', [42])).toThrow(TypeError);
  });
});

describe('Builtin - min()', () => {
  const registry = getDefaultBuiltins();

  it('finds minimum in array', () => {
    expect(callBuiltin(registry, 'min', [[3, 1, 4, 1, 5]])).toBe(1);
    expect(callBuiltin(registry, 'min', [[10]])).toBe(10);
  });

  it('returns undefined for empty array', () => {
    expect(callBuiltin(registry, 'min', [[]])).toBeUndefined();
  });

  it('finds minimum of multiple arguments', () => {
    expect(callBuiltin(registry, 'min', [5, 3, 8, 1])).toBe(1);
  });
});

describe('Builtin - max()', () => {
  const registry = getDefaultBuiltins();

  it('finds maximum in array', () => {
    expect(callBuiltin(registry, 'max', [[3, 1, 4, 1, 5]])).toBe(5);
    expect(callBuiltin(registry, 'max', [[10]])).toBe(10);
  });

  it('returns undefined for empty array', () => {
    expect(callBuiltin(registry, 'max', [[]])).toBeUndefined();
  });

  it('finds maximum of multiple arguments', () => {
    expect(callBuiltin(registry, 'max', [5, 3, 8, 1])).toBe(8);
  });
});

describe('Builtin - avg()', () => {
  const registry = getDefaultBuiltins();

  it('calculates average', () => {
    expect(callBuiltin(registry, 'avg', [[2, 4, 6]])).toBe(4);
    expect(callBuiltin(registry, 'avg', [[10]])).toBe(10);
  });

  it('returns undefined for empty array', () => {
    expect(callBuiltin(registry, 'avg', [[]])).toBeUndefined();
  });

  it('throws for non-arrays', () => {
    expect(() => callBuiltin(registry, 'avg', [42])).toThrow(TypeError);
  });
});

// ============================================================================
// QUANTIFIER FUNCTIONS
// ============================================================================

describe('Builtin - all()/forall()', () => {
  const registry = getDefaultBuiltins();

  it('returns true when all elements satisfy predicate', () => {
    const isPositive = (x: unknown) => (x as number) > 0;
    expect(callBuiltin(registry, 'all', [[1, 2, 3], isPositive])).toBe(true);
  });

  it('returns false when any element fails predicate', () => {
    const isPositive = (x: unknown) => (x as number) > 0;
    expect(callBuiltin(registry, 'all', [[1, -2, 3], isPositive])).toBe(false);
  });

  it('returns true for empty array', () => {
    const always = () => false;
    expect(callBuiltin(registry, 'all', [[], always])).toBe(true);
  });

  it('checks truthiness without predicate', () => {
    expect(callBuiltin(registry, 'all', [[1, 2, 3]])).toBe(true);
    expect(callBuiltin(registry, 'all', [[1, 0, 3]])).toBe(false);
  });

  it('forall is alias for all', () => {
    const isPositive = (x: unknown) => (x as number) > 0;
    expect(callBuiltin(registry, 'forall', [[1, 2, 3], isPositive])).toBe(true);
  });
});

describe('Builtin - any()/exists()', () => {
  const registry = getDefaultBuiltins();

  it('returns true when any element satisfies predicate', () => {
    const isNegative = (x: unknown) => (x as number) < 0;
    expect(callBuiltin(registry, 'any', [[1, -2, 3], isNegative])).toBe(true);
  });

  it('returns false when no element satisfies predicate', () => {
    const isNegative = (x: unknown) => (x as number) < 0;
    expect(callBuiltin(registry, 'any', [[1, 2, 3], isNegative])).toBe(false);
  });

  it('returns false for empty array', () => {
    const always = () => true;
    expect(callBuiltin(registry, 'any', [[], always])).toBe(false);
  });

  it('exists is alias for any', () => {
    const isNegative = (x: unknown) => (x as number) < 0;
    expect(callBuiltin(registry, 'exists', [[1, -2, 3], isNegative])).toBe(true);
  });
});

describe('Builtin - none()', () => {
  const registry = getDefaultBuiltins();

  it('returns true when no elements satisfy predicate', () => {
    const isNegative = (x: unknown) => (x as number) < 0;
    expect(callBuiltin(registry, 'none', [[1, 2, 3], isNegative])).toBe(true);
  });

  it('returns false when any element satisfies predicate', () => {
    const isNegative = (x: unknown) => (x as number) < 0;
    expect(callBuiltin(registry, 'none', [[1, -2, 3], isNegative])).toBe(false);
  });

  it('returns true for empty array', () => {
    const always = () => true;
    expect(callBuiltin(registry, 'none', [[], always])).toBe(true);
  });
});

describe('Builtin - filter()', () => {
  const registry = getDefaultBuiltins();

  it('filters elements by predicate', () => {
    const isEven = (x: unknown) => (x as number) % 2 === 0;
    expect(callBuiltin(registry, 'filter', [[1, 2, 3, 4, 5], isEven])).toEqual([2, 4]);
  });

  it('filters truthy without predicate', () => {
    expect(callBuiltin(registry, 'filter', [[0, 1, '', 'hello', null, true]])).toEqual([1, 'hello', true]);
  });

  it('returns empty array when nothing matches', () => {
    const never = () => false;
    expect(callBuiltin(registry, 'filter', [[1, 2, 3], never])).toEqual([]);
  });
});

// ============================================================================
// MATH FUNCTIONS
// ============================================================================

describe('Builtin - abs()', () => {
  const registry = getDefaultBuiltins();

  it('returns absolute value', () => {
    expect(callBuiltin(registry, 'abs', [-5])).toBe(5);
    expect(callBuiltin(registry, 'abs', [5])).toBe(5);
    expect(callBuiltin(registry, 'abs', [0])).toBe(0);
  });

  it('throws for non-numbers', () => {
    expect(() => callBuiltin(registry, 'abs', ['5'])).toThrow(TypeError);
  });
});

describe('Builtin - round()', () => {
  const registry = getDefaultBuiltins();

  it('rounds to nearest integer', () => {
    expect(callBuiltin(registry, 'round', [3.7])).toBe(4);
    expect(callBuiltin(registry, 'round', [3.2])).toBe(3);
    expect(callBuiltin(registry, 'round', [3.5])).toBe(4);
  });

  it('rounds to specified decimal places', () => {
    expect(callBuiltin(registry, 'round', [3.14159, 2])).toBe(3.14);
    expect(callBuiltin(registry, 'round', [3.14159, 3])).toBe(3.142);
  });
});

describe('Builtin - floor()', () => {
  const registry = getDefaultBuiltins();

  it('floors to integer', () => {
    expect(callBuiltin(registry, 'floor', [3.9])).toBe(3);
    expect(callBuiltin(registry, 'floor', [-3.1])).toBe(-4);
  });
});

describe('Builtin - ceil()', () => {
  const registry = getDefaultBuiltins();

  it('ceils to integer', () => {
    expect(callBuiltin(registry, 'ceil', [3.1])).toBe(4);
    expect(callBuiltin(registry, 'ceil', [-3.9])).toBe(-3);
  });
});

describe('Builtin - sqrt()', () => {
  const registry = getDefaultBuiltins();

  it('calculates square root', () => {
    expect(callBuiltin(registry, 'sqrt', [9])).toBe(3);
    expect(callBuiltin(registry, 'sqrt', [2])).toBeCloseTo(1.414, 3);
  });

  it('throws for negative numbers', () => {
    expect(() => callBuiltin(registry, 'sqrt', [-1])).toThrow(RuntimeError);
  });
});

describe('Builtin - pow()', () => {
  const registry = getDefaultBuiltins();

  it('calculates power', () => {
    expect(callBuiltin(registry, 'pow', [2, 3])).toBe(8);
    expect(callBuiltin(registry, 'pow', [10, 0])).toBe(1);
    expect(callBuiltin(registry, 'pow', [2, -1])).toBe(0.5);
  });

  it('throws for non-numbers', () => {
    expect(() => callBuiltin(registry, 'pow', ['2', 3])).toThrow(TypeError);
  });
});

// ============================================================================
// STRING FUNCTIONS
// ============================================================================

describe('Builtin - concat()', () => {
  const registry = getDefaultBuiltins();

  it('concatenates strings', () => {
    expect(callBuiltin(registry, 'concat', ['hello', ' ', 'world'])).toBe('hello world');
  });

  it('converts non-strings', () => {
    expect(callBuiltin(registry, 'concat', ['num: ', 42])).toBe('num: 42');
  });
});

describe('Builtin - upper()', () => {
  const registry = getDefaultBuiltins();

  it('converts to uppercase', () => {
    expect(callBuiltin(registry, 'upper', ['hello'])).toBe('HELLO');
    expect(callBuiltin(registry, 'upper', ['HeLLo'])).toBe('HELLO');
  });

  it('throws for non-strings', () => {
    expect(() => callBuiltin(registry, 'upper', [42])).toThrow(TypeError);
  });
});

describe('Builtin - lower()', () => {
  const registry = getDefaultBuiltins();

  it('converts to lowercase', () => {
    expect(callBuiltin(registry, 'lower', ['HELLO'])).toBe('hello');
    expect(callBuiltin(registry, 'lower', ['HeLLo'])).toBe('hello');
  });
});

describe('Builtin - trim()', () => {
  const registry = getDefaultBuiltins();

  it('trims whitespace', () => {
    expect(callBuiltin(registry, 'trim', ['  hello  '])).toBe('hello');
    expect(callBuiltin(registry, 'trim', ['\n\thello\t\n'])).toBe('hello');
  });
});

describe('Builtin - split()', () => {
  const registry = getDefaultBuiltins();

  it('splits by separator', () => {
    expect(callBuiltin(registry, 'split', ['a,b,c', ','])).toEqual(['a', 'b', 'c']);
    expect(callBuiltin(registry, 'split', ['hello world', ' '])).toEqual(['hello', 'world']);
  });

  it('splits by empty string into characters', () => {
    expect(callBuiltin(registry, 'split', ['abc', ''])).toEqual(['a', 'b', 'c']);
  });
});

describe('Builtin - substring()', () => {
  const registry = getDefaultBuiltins();

  it('extracts substring', () => {
    expect(callBuiltin(registry, 'substring', ['hello', 1, 4])).toBe('ell');
    expect(callBuiltin(registry, 'substring', ['hello', 2])).toBe('llo');
  });
});

// ============================================================================
// TYPE FUNCTIONS
// ============================================================================

describe('Builtin - typeof()', () => {
  const registry = getDefaultBuiltins();

  it('returns type names', () => {
    expect(callBuiltin(registry, 'typeof', [42])).toBe('number');
    expect(callBuiltin(registry, 'typeof', ['hello'])).toBe('string');
    expect(callBuiltin(registry, 'typeof', [true])).toBe('boolean');
    expect(callBuiltin(registry, 'typeof', [null])).toBe('null');
    expect(callBuiltin(registry, 'typeof', [undefined])).toBe('undefined');
    expect(callBuiltin(registry, 'typeof', [[1, 2, 3]])).toBe('array');
    expect(callBuiltin(registry, 'typeof', [{ a: 1 }])).toBe('object');
  });
});

describe('Builtin - isNull()', () => {
  const registry = getDefaultBuiltins();

  it('checks for null/undefined', () => {
    expect(callBuiltin(registry, 'isNull', [null])).toBe(true);
    expect(callBuiltin(registry, 'isNull', [undefined])).toBe(true);
    expect(callBuiltin(registry, 'isNull', [0])).toBe(false);
    expect(callBuiltin(registry, 'isNull', [''])).toBe(false);
  });
});

describe('Builtin - isNumber()', () => {
  const registry = getDefaultBuiltins();

  it('checks for numbers', () => {
    expect(callBuiltin(registry, 'isNumber', [42])).toBe(true);
    expect(callBuiltin(registry, 'isNumber', [3.14])).toBe(true);
    expect(callBuiltin(registry, 'isNumber', ['42'])).toBe(false);
    expect(callBuiltin(registry, 'isNumber', [NaN])).toBe(false);
  });
});

describe('Builtin - isString()', () => {
  const registry = getDefaultBuiltins();

  it('checks for strings', () => {
    expect(callBuiltin(registry, 'isString', ['hello'])).toBe(true);
    expect(callBuiltin(registry, 'isString', [''])).toBe(true);
    expect(callBuiltin(registry, 'isString', [42])).toBe(false);
  });
});

describe('Builtin - isArray()', () => {
  const registry = getDefaultBuiltins();

  it('checks for arrays', () => {
    expect(callBuiltin(registry, 'isArray', [[1, 2, 3]])).toBe(true);
    expect(callBuiltin(registry, 'isArray', [[]])).toBe(true);
    expect(callBuiltin(registry, 'isArray', [{ length: 1 }])).toBe(false);
  });
});

describe('Builtin - toNumber()', () => {
  const registry = getDefaultBuiltins();

  it('converts to number', () => {
    expect(callBuiltin(registry, 'toNumber', ['42'])).toBe(42);
    expect(callBuiltin(registry, 'toNumber', ['3.14'])).toBe(3.14);
    expect(callBuiltin(registry, 'toNumber', [true])).toBe(1);
    expect(callBuiltin(registry, 'toNumber', [false])).toBe(0);
    expect(callBuiltin(registry, 'toNumber', [42])).toBe(42);
  });

  it('throws for invalid conversions', () => {
    expect(() => callBuiltin(registry, 'toNumber', ['not a number'])).toThrow(RuntimeError);
  });
});

describe('Builtin - toString()', () => {
  const registry = getDefaultBuiltins();

  it('converts to string', () => {
    expect(callBuiltin(registry, 'toString', [42])).toBe('42');
    expect(callBuiltin(registry, 'toString', [true])).toBe('true');
    expect(callBuiltin(registry, 'toString', [null])).toBe('null');
    expect(callBuiltin(registry, 'toString', [[1, 2]])).toBe('[1,2]');
  });
});

describe('Builtin - toBoolean()', () => {
  const registry = getDefaultBuiltins();

  it('converts to boolean', () => {
    expect(callBuiltin(registry, 'toBoolean', [1])).toBe(true);
    expect(callBuiltin(registry, 'toBoolean', [0])).toBe(false);
    expect(callBuiltin(registry, 'toBoolean', ['hello'])).toBe(true);
    expect(callBuiltin(registry, 'toBoolean', [''])).toBe(false);
    expect(callBuiltin(registry, 'toBoolean', [null])).toBe(false);
  });
});

// ============================================================================
// LOGICAL FUNCTIONS
// ============================================================================

describe('Builtin - implies()', () => {
  const registry = getDefaultBuiltins();

  it('evaluates logical implication', () => {
    // false implies anything is true
    expect(callBuiltin(registry, 'implies', [false, false])).toBe(true);
    expect(callBuiltin(registry, 'implies', [false, true])).toBe(true);
    
    // true implies true is true
    expect(callBuiltin(registry, 'implies', [true, true])).toBe(true);
    
    // true implies false is false
    expect(callBuiltin(registry, 'implies', [true, false])).toBe(false);
  });
});
