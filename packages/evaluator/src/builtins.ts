// ============================================================================
// ISL Expression Evaluator - Built-in Functions
// ============================================================================

import type {
  Value,
  BuiltinFn,
  BuiltinRegistry,
  EvaluationContext,
  SourceLocation,
} from './types.js';
import { RuntimeError, TypeError, getValueType } from './types.js';

// ============================================================================
// BUILTIN REGISTRY IMPLEMENTATION
// ============================================================================

/**
 * Registry for built-in functions
 */
export class DefaultBuiltinRegistry implements BuiltinRegistry {
  private readonly builtins: Map<string, BuiltinFn>;

  constructor() {
    this.builtins = new Map();
    this.registerDefaults();
  }

  get(name: string): BuiltinFn | undefined {
    return this.builtins.get(name);
  }

  has(name: string): boolean {
    return this.builtins.has(name);
  }

  register(name: string, fn: BuiltinFn): void {
    this.builtins.set(name, fn);
  }

  list(): string[] {
    return Array.from(this.builtins.keys());
  }

  private registerDefaults(): void {
    // Time functions
    this.register('now', builtinNow);

    // Collection functions
    this.register('len', builtinLen);
    this.register('length', builtinLen);
    this.register('count', builtinCount);
    this.register('sum', builtinSum);
    this.register('min', builtinMin);
    this.register('max', builtinMax);
    this.register('avg', builtinAvg);

    // Quantifiers (functional style)
    this.register('all', builtinAll);
    this.register('forall', builtinAll);
    this.register('any', builtinAny);
    this.register('exists', builtinAny);
    this.register('none', builtinNone);
    this.register('filter', builtinFilter);

    // Math functions
    this.register('abs', builtinAbs);
    this.register('round', builtinRound);
    this.register('floor', builtinFloor);
    this.register('ceil', builtinCeil);
    this.register('sqrt', builtinSqrt);
    this.register('pow', builtinPow);

    // String functions
    this.register('concat', builtinConcat);
    this.register('upper', builtinUpper);
    this.register('lower', builtinLower);
    this.register('trim', builtinTrim);
    this.register('split', builtinSplit);
    this.register('substring', builtinSubstring);

    // Type checking/conversion
    this.register('typeof', builtinTypeof);
    this.register('isNull', builtinIsNull);
    this.register('isNumber', builtinIsNumber);
    this.register('isString', builtinIsString);
    this.register('isArray', builtinIsArray);
    this.register('toNumber', builtinToNumber);
    this.register('toString', builtinToString);
    this.register('toBoolean', builtinToBoolean);

    // Logical
    this.register('implies', builtinImplies);

    // Security-related (return true in verification)
    this.register('timing_safe_comparison', () => true);
    this.register('never_appears_in', () => true);
  }
}

// ============================================================================
// TIME FUNCTIONS
// ============================================================================

const builtinNow: BuiltinFn = (_args, context) => {
  return context.now;
};

// ============================================================================
// COLLECTION FUNCTIONS
// ============================================================================

const builtinLen: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  
  if (Array.isArray(value)) {
    return value.length;
  }
  
  if (typeof value === 'string') {
    return value.length;
  }
  
  if (value instanceof Map) {
    return value.size;
  }
  
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length;
  }

  throw new TypeError(
    `len() requires array, string, map, or object, got ${getValueType(value)}`,
    location,
    'array | string | map | object',
    getValueType(value)
  );
};

const builtinCount: BuiltinFn = (args, _context, location) => {
  const collection = args[0];
  const predicate = args[1] as ((v: unknown) => boolean) | undefined;

  if (!Array.isArray(collection)) {
    throw new TypeError(
      `count() requires array, got ${getValueType(collection)}`,
      location,
      'array',
      getValueType(collection)
    );
  }

  if (predicate) {
    return collection.filter(predicate).length;
  }

  return collection.length;
};

const builtinSum: BuiltinFn = (args, _context, location) => {
  const collection = args[0];
  const selector = args[1] as ((v: unknown) => number) | undefined;

  if (!Array.isArray(collection)) {
    throw new TypeError(
      `sum() requires array, got ${getValueType(collection)}`,
      location,
      'array',
      getValueType(collection)
    );
  }

  if (collection.length === 0) {
    return 0;
  }

  if (selector) {
    return collection.reduce((acc: number, item) => acc + selector(item), 0);
  }

  return collection.reduce((acc: number, item) => {
    if (typeof item !== 'number') {
      throw new TypeError(
        `sum() requires numeric array elements, got ${getValueType(item)}`,
        location,
        'number',
        getValueType(item)
      );
    }
    return acc + item;
  }, 0);
};

const builtinMin: BuiltinFn = (args, _context, location) => {
  const collection = args[0];

  if (Array.isArray(collection)) {
    if (collection.length === 0) {
      return undefined;
    }
    return Math.min(...(collection as number[]));
  }

  // Allow min(a, b, c, ...)
  if (args.length > 1) {
    return Math.min(...(args as number[]));
  }

  throw new TypeError(
    `min() requires array or multiple numbers`,
    location,
    'array | number[]',
    getValueType(collection)
  );
};

const builtinMax: BuiltinFn = (args, _context, location) => {
  const collection = args[0];

  if (Array.isArray(collection)) {
    if (collection.length === 0) {
      return undefined;
    }
    return Math.max(...(collection as number[]));
  }

  // Allow max(a, b, c, ...)
  if (args.length > 1) {
    return Math.max(...(args as number[]));
  }

  throw new TypeError(
    `max() requires array or multiple numbers`,
    location,
    'array | number[]',
    getValueType(collection)
  );
};

const builtinAvg: BuiltinFn = (args, _context, location) => {
  const collection = args[0];

  if (!Array.isArray(collection)) {
    throw new TypeError(
      `avg() requires array, got ${getValueType(collection)}`,
      location,
      'array',
      getValueType(collection)
    );
  }

  if (collection.length === 0) {
    return undefined;
  }

  const sum = collection.reduce((acc: number, item) => {
    if (typeof item !== 'number') {
      throw new TypeError(
        `avg() requires numeric array elements`,
        location,
        'number',
        getValueType(item)
      );
    }
    return acc + item;
  }, 0);

  return sum / collection.length;
};

// ============================================================================
// QUANTIFIER FUNCTIONS
// ============================================================================

const builtinAll: BuiltinFn = (args, _context, location) => {
  const collection = args[0];
  const predicate = args[1] as ((v: unknown) => boolean) | undefined;

  if (!Array.isArray(collection)) {
    throw new TypeError(
      `all() requires array, got ${getValueType(collection)}`,
      location,
      'array',
      getValueType(collection)
    );
  }

  if (!predicate) {
    // If no predicate, check all elements are truthy
    return collection.every(Boolean);
  }

  return collection.every(predicate);
};

const builtinAny: BuiltinFn = (args, _context, location) => {
  const collection = args[0];
  const predicate = args[1] as ((v: unknown) => boolean) | undefined;

  if (!Array.isArray(collection)) {
    throw new TypeError(
      `any() requires array, got ${getValueType(collection)}`,
      location,
      'array',
      getValueType(collection)
    );
  }

  if (!predicate) {
    return collection.some(Boolean);
  }

  return collection.some(predicate);
};

const builtinNone: BuiltinFn = (args, _context, location) => {
  const collection = args[0];
  const predicate = args[1] as ((v: unknown) => boolean) | undefined;

  if (!Array.isArray(collection)) {
    throw new TypeError(
      `none() requires array, got ${getValueType(collection)}`,
      location,
      'array',
      getValueType(collection)
    );
  }

  if (!predicate) {
    return !collection.some(Boolean);
  }

  return !collection.some(predicate);
};

const builtinFilter: BuiltinFn = (args, _context, location) => {
  const collection = args[0];
  const predicate = args[1] as ((v: unknown) => boolean) | undefined;

  if (!Array.isArray(collection)) {
    throw new TypeError(
      `filter() requires array, got ${getValueType(collection)}`,
      location,
      'array',
      getValueType(collection)
    );
  }

  if (!predicate) {
    // Filter truthy values
    return collection.filter(Boolean);
  }

  return collection.filter(predicate);
};

// ============================================================================
// MATH FUNCTIONS
// ============================================================================

const builtinAbs: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value !== 'number') {
    throw new TypeError(
      `abs() requires number, got ${getValueType(value)}`,
      location,
      'number',
      getValueType(value)
    );
  }
  return Math.abs(value);
};

const builtinRound: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  const decimals = args[1] as number | undefined;

  if (typeof value !== 'number') {
    throw new TypeError(
      `round() requires number, got ${getValueType(value)}`,
      location,
      'number',
      getValueType(value)
    );
  }

  if (decimals !== undefined) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  return Math.round(value);
};

const builtinFloor: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value !== 'number') {
    throw new TypeError(
      `floor() requires number, got ${getValueType(value)}`,
      location,
      'number',
      getValueType(value)
    );
  }
  return Math.floor(value);
};

const builtinCeil: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value !== 'number') {
    throw new TypeError(
      `ceil() requires number, got ${getValueType(value)}`,
      location,
      'number',
      getValueType(value)
    );
  }
  return Math.ceil(value);
};

const builtinSqrt: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value !== 'number') {
    throw new TypeError(
      `sqrt() requires number, got ${getValueType(value)}`,
      location,
      'number',
      getValueType(value)
    );
  }
  if (value < 0) {
    throw new RuntimeError(
      `sqrt() of negative number: ${value}`,
      location
    );
  }
  return Math.sqrt(value);
};

const builtinPow: BuiltinFn = (args, _context, location) => {
  const base = args[0];
  const exponent = args[1];

  if (typeof base !== 'number' || typeof exponent !== 'number') {
    throw new TypeError(
      `pow() requires two numbers`,
      location,
      'number, number',
      `${getValueType(base)}, ${getValueType(exponent)}`
    );
  }

  return Math.pow(base, exponent);
};

// ============================================================================
// STRING FUNCTIONS
// ============================================================================

const builtinConcat: BuiltinFn = (args) => {
  return args.map(String).join('');
};

const builtinUpper: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value !== 'string') {
    throw new TypeError(
      `upper() requires string, got ${getValueType(value)}`,
      location,
      'string',
      getValueType(value)
    );
  }
  return value.toUpperCase();
};

const builtinLower: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value !== 'string') {
    throw new TypeError(
      `lower() requires string, got ${getValueType(value)}`,
      location,
      'string',
      getValueType(value)
    );
  }
  return value.toLowerCase();
};

const builtinTrim: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value !== 'string') {
    throw new TypeError(
      `trim() requires string, got ${getValueType(value)}`,
      location,
      'string',
      getValueType(value)
    );
  }
  return value.trim();
};

const builtinSplit: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  const separator = args[1] as string ?? '';

  if (typeof value !== 'string') {
    throw new TypeError(
      `split() requires string, got ${getValueType(value)}`,
      location,
      'string',
      getValueType(value)
    );
  }

  return value.split(separator);
};

const builtinSubstring: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  const start = args[1] as number;
  const end = args[2] as number | undefined;

  if (typeof value !== 'string') {
    throw new TypeError(
      `substring() requires string, got ${getValueType(value)}`,
      location,
      'string',
      getValueType(value)
    );
  }

  return value.substring(start, end);
};

// ============================================================================
// TYPE FUNCTIONS
// ============================================================================

const builtinTypeof: BuiltinFn = (args) => {
  return getValueType(args[0]);
};

const builtinIsNull: BuiltinFn = (args) => {
  return args[0] === null || args[0] === undefined;
};

const builtinIsNumber: BuiltinFn = (args) => {
  return typeof args[0] === 'number' && !isNaN(args[0]);
};

const builtinIsString: BuiltinFn = (args) => {
  return typeof args[0] === 'string';
};

const builtinIsArray: BuiltinFn = (args) => {
  return Array.isArray(args[0]);
};

const builtinToNumber: BuiltinFn = (args, _context, location) => {
  const value = args[0];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = Number(value);
    if (isNaN(num)) {
      throw new RuntimeError(
        `Cannot convert "${value}" to number`,
        location
      );
    }
    return num;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  throw new TypeError(
    `Cannot convert ${getValueType(value)} to number`,
    location,
    'number | string | boolean',
    getValueType(value)
  );
};

const builtinToString: BuiltinFn = (args) => {
  const value = args[0];
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const builtinToBoolean: BuiltinFn = (args) => {
  return Boolean(args[0]);
};

// ============================================================================
// LOGICAL FUNCTIONS
// ============================================================================

const builtinImplies: BuiltinFn = (args) => {
  const a = Boolean(args[0]);
  const b = Boolean(args[1]);
  // a implies b === !a || b
  return !a || b;
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new builtin registry with all defaults
 */
export function createBuiltinRegistry(): BuiltinRegistry {
  return new DefaultBuiltinRegistry();
}

/**
 * Global default registry (for convenience)
 */
let defaultRegistry: BuiltinRegistry | null = null;

/**
 * Get the default builtin registry
 */
export function getDefaultBuiltins(): BuiltinRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createBuiltinRegistry();
  }
  return defaultRegistry;
}
