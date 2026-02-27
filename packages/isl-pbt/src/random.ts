// ============================================================================
// Random Value Generation - Seeded PRNG and type-specific generators
// ============================================================================

import type { PRNG, Generator, FieldConstraints } from './types.js';

// ============================================================================
// SEEDED PRNG (xorshift128+)
// ============================================================================

/**
 * Create a seeded PRNG using xorshift128+ algorithm
 * Provides reproducible random sequences
 */
export function createPRNG(seed?: number): PRNG {
  // Use current time if no seed provided
  const actualSeed = seed ?? Date.now();
  
  // Initialize state from seed
  let s0 = actualSeed >>> 0;
  let s1 = (actualSeed * 1812433253 + 1) >>> 0;
  
  // xorshift128+
  function next(): number {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23;
    s1 = x ^ y ^ (x >>> 17) ^ (y >>> 26);
    return ((s1 + y) >>> 0) / 0xffffffff;
  }
  
  const prng: PRNG = {
    random: next,
    
    int(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    
    bool(probability = 0.5): boolean {
      return next() < probability;
    },
    
    pick<T>(array: readonly T[]): T {
      if (array.length === 0) {
        throw new Error('Cannot pick from empty array');
      }
      return array[Math.floor(next() * array.length)]!;
    },
    
    shuffle<T>(array: T[]): T[] {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [result[i], result[j]] = [result[j]!, result[i]!];
      }
      return result;
    },
    
    seed(): number {
      return actualSeed;
    },
    
    fork(): PRNG {
      return createPRNG(prng.int(0, 0xffffffff));
    },
  };
  
  return prng;
}

// ============================================================================
// BASE GENERATOR CLASS
// ============================================================================

/**
 * Base generator implementation
 */
export class BaseGenerator<T> implements Generator<T> {
  constructor(
    private readonly genFn: (prng: PRNG, size: number) => T,
    private readonly shrinkFn: (value: T) => Iterable<T> = () => []
  ) {}
  
  generate(prng: PRNG, size: number): T {
    return this.genFn(prng, size);
  }
  
  *shrink(value: T): Iterable<T> {
    yield* this.shrinkFn(value);
  }
  
  map<U>(fn: (value: T) => U): Generator<U> {
    return new BaseGenerator(
      (prng, size) => fn(this.generate(prng, size)),
      // Shrinking doesn't preserve mapping in general
      () => []
    );
  }
  
  filter(predicate: (value: T) => boolean): Generator<T> {
    return new BaseGenerator(
      (prng, size) => {
        const maxAttempts = 100;
        for (let i = 0; i < maxAttempts; i++) {
          const value = this.generate(prng.fork(), size);
          if (predicate(value)) {
            return value;
          }
        }
        throw new Error('Failed to generate value satisfying filter');
      },
      (value) => {
        const shrinks: T[] = [];
        for (const shrunk of this.shrink(value)) {
          if (predicate(shrunk)) {
            shrinks.push(shrunk);
          }
        }
        return shrinks;
      }
    );
  }
  
  flatMap<U>(fn: (value: T) => Generator<U>): Generator<U> {
    return new BaseGenerator(
      (prng, size) => {
        const intermediate = this.generate(prng.fork(), size);
        return fn(intermediate).generate(prng.fork(), size);
      },
      () => []
    );
  }
}

// ============================================================================
// PRIMITIVE GENERATORS
// ============================================================================

/**
 * Generate integers
 */
export function integer(min = -1000, max = 1000): Generator<number> {
  return new BaseGenerator(
    (prng, size) => {
      // Scale range with size
      const scaledMin = Math.max(min, -size);
      const scaledMax = Math.min(max, size);
      return prng.int(scaledMin, scaledMax);
    },
    function* (value) {
      // Shrink towards 0
      if (value === 0) return;
      
      // Try 0 first
      yield 0;
      
      // Binary search towards 0
      let current = value;
      while (Math.abs(current) > 1) {
        current = Math.trunc(current / 2);
        if (current !== 0) yield current;
      }
      
      // Try adjacent values
      if (value > 0) {
        yield value - 1;
      } else {
        yield value + 1;
      }
    }
  );
}

/**
 * Generate floating point numbers
 */
export function float(min = -1000, max = 1000, precision = 2): Generator<number> {
  return new BaseGenerator(
    (prng, size) => {
      const scaledMin = Math.max(min, -size);
      const scaledMax = Math.min(max, size);
      const value = scaledMin + prng.random() * (scaledMax - scaledMin);
      return Number(value.toFixed(precision));
    },
    function* (value) {
      if (value === 0) return;
      yield 0;
      yield Math.trunc(value);
      yield Number((value / 2).toFixed(precision));
    }
  );
}

/**
 * Generate booleans
 */
export function boolean(probability = 0.5): Generator<boolean> {
  return new BaseGenerator(
    (prng) => prng.bool(probability),
    function* (value) {
      // Shrink true to false
      if (value) yield false;
    }
  );
}

/**
 * Generate strings
 */
export function string(options: {
  minLength?: number;
  maxLength?: number;
  alphabet?: string;
} = {}): Generator<string> {
  const {
    minLength = 0,
    maxLength = 100,
    alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  } = options;
  
  return new BaseGenerator(
    (prng, size) => {
      const len = prng.int(minLength, Math.min(maxLength, size));
      let result = '';
      for (let i = 0; i < len; i++) {
        result += alphabet[Math.floor(prng.random() * alphabet.length)];
      }
      return result;
    },
    function* (value) {
      if (value.length <= minLength) return;
      
      // Empty string
      if (minLength === 0) {
        yield '';
      }
      
      // Minimum length string
      if (value.length > minLength) {
        yield value.slice(0, minLength);
      }
      
      // Remove characters from the end
      for (let i = value.length - 1; i > minLength; i--) {
        yield value.slice(0, i);
      }
      
      // Remove characters from various positions
      for (let i = 0; i < Math.min(value.length, 5); i++) {
        yield value.slice(0, i) + value.slice(i + 1);
      }
    }
  );
}

/**
 * Generate valid emails
 */
export function email(): Generator<string> {
  const localChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const domains = ['example.com', 'test.org', 'demo.net', 'sample.io'];
  
  return new BaseGenerator(
    (prng, size) => {
      const localLen = prng.int(1, Math.min(20, size));
      let local = '';
      for (let i = 0; i < localLen; i++) {
        local += localChars[Math.floor(prng.random() * localChars.length)];
      }
      const domain = prng.pick(domains);
      return `${local}@${domain}`;
    },
    function* (value) {
      const [local, domain] = value.split('@');
      if (!local || !domain) return;
      
      // Shrink local part
      if (local.length > 1) {
        yield `${local[0]}@${domain}`;
        yield `${local.slice(0, Math.ceil(local.length / 2))}@${domain}`;
      }
      
      // Try simplest domain
      if (domain !== 'example.com') {
        yield `${local}@example.com`;
      }
    }
  );
}

/**
 * Generate passwords meeting requirements
 */
export function password(minLength = 8, maxLength = 128): Generator<string> {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = lower + upper + digits + special;
  
  return new BaseGenerator(
    (prng, size) => {
      const len = prng.int(minLength, Math.min(maxLength, Math.max(minLength, size)));
      
      // Ensure at least one of each required type
      let result = '';
      result += lower[Math.floor(prng.random() * lower.length)];
      result += upper[Math.floor(prng.random() * upper.length)];
      result += digits[Math.floor(prng.random() * digits.length)];
      result += special[Math.floor(prng.random() * special.length)];
      
      // Fill remaining with random chars
      for (let i = 4; i < len; i++) {
        result += all[Math.floor(prng.random() * all.length)];
      }
      
      // Shuffle
      return prng.shuffle(result.split('')).join('');
    },
    function* (value) {
      if (value.length <= minLength) return;
      
      // Minimum length password
      yield value.slice(0, minLength);
      
      // Shrink progressively
      for (let i = value.length - 1; i > minLength; i--) {
        yield value.slice(0, i);
      }
    }
  );
}

/**
 * Generate UUIDs
 */
export function uuid(): Generator<string> {
  return new BaseGenerator(
    (prng) => {
      const hex = '0123456789abcdef';
      let result = '';
      for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
          result += '-';
        } else if (i === 14) {
          result += '4'; // Version 4
        } else if (i === 19) {
          result += hex[Math.floor(prng.random() * 4) + 8]; // Variant
        } else {
          result += hex[Math.floor(prng.random() * 16)];
        }
      }
      return result;
    },
    // UUIDs don't shrink meaningfully
    () => []
  );
}

/**
 * Generate ISO timestamps
 */
export function timestamp(options: {
  start?: Date;
  end?: Date;
} = {}): Generator<string> {
  const start = options.start?.getTime() ?? Date.now() - 365 * 24 * 60 * 60 * 1000;
  const end = options.end?.getTime() ?? Date.now() + 365 * 24 * 60 * 60 * 1000;
  
  return new BaseGenerator(
    (prng) => {
      const time = prng.int(start, end);
      return new Date(time).toISOString();
    },
    function* (value) {
      // Shrink to epoch
      const epoch = new Date(0).toISOString();
      if (value !== epoch) {
        yield epoch;
      }
      // Shrink to current time
      yield new Date().toISOString();
    }
  );
}

/**
 * Generate IP addresses
 */
export function ipAddress(): Generator<string> {
  return new BaseGenerator(
    (prng) => {
      const octets = [
        prng.int(1, 255),
        prng.int(0, 255),
        prng.int(0, 255),
        prng.int(1, 254),
      ];
      return octets.join('.');
    },
    function* (value) {
      // Shrink to localhost
      if (value !== '127.0.0.1') {
        yield '127.0.0.1';
      }
      // Shrink to 1.1.1.1
      if (value !== '1.1.1.1') {
        yield '1.1.1.1';
      }
    }
  );
}

// ============================================================================
// COMPOSITE GENERATORS
// ============================================================================

/**
 * Generate arrays
 */
export function array<T>(
  elementGen: Generator<T>,
  options: { minLength?: number; maxLength?: number } = {}
): Generator<T[]> {
  const { minLength = 0, maxLength = 20 } = options;
  
  return new BaseGenerator(
    (prng, size) => {
      const len = prng.int(minLength, Math.min(maxLength, size));
      const result: T[] = [];
      for (let i = 0; i < len; i++) {
        result.push(elementGen.generate(prng.fork(), size));
      }
      return result;
    },
    function* (value) {
      if (value.length <= minLength) return;
      
      // Empty array
      if (minLength === 0) {
        yield [];
      }
      
      // Minimum length
      if (value.length > minLength) {
        yield value.slice(0, minLength);
      }
      
      // Remove elements
      for (let i = 0; i < value.length; i++) {
        yield [...value.slice(0, i), ...value.slice(i + 1)];
      }
      
      // Shrink individual elements
      for (let i = 0; i < value.length; i++) {
        for (const shrunk of elementGen.shrink(value[i]!)) {
          yield [...value.slice(0, i), shrunk, ...value.slice(i + 1)];
        }
      }
    }
  );
}

/**
 * Generate one of multiple values
 */
export function oneOf<T>(...generators: Generator<T>[]): Generator<T> {
  if (generators.length === 0) {
    throw new Error('oneOf requires at least one generator');
  }
  
  return new BaseGenerator(
    (prng, size) => {
      const gen = prng.pick(generators);
      return gen.generate(prng.fork(), size);
    },
    (value) => {
      // Try shrinking with all generators
      const shrinks: T[] = [];
      for (const gen of generators) {
        for (const shrunk of gen.shrink(value)) {
          shrinks.push(shrunk);
        }
      }
      return shrinks;
    }
  );
}

/**
 * Generate a constant value
 */
export function constant<T>(value: T): Generator<T> {
  return new BaseGenerator(
    () => value,
    () => []
  );
}

/**
 * Generate from an enum
 */
export function fromEnum<T extends string>(values: readonly T[]): Generator<T> {
  return new BaseGenerator(
    (prng) => prng.pick(values),
    function* (value) {
      // Shrink to first value
      if (value !== values[0]) {
        yield values[0]!;
      }
    }
  );
}

/**
 * Generate optional values
 */
export function optional<T>(gen: Generator<T>, probability = 0.8): Generator<T | undefined> {
  return new BaseGenerator(
    (prng, size) => {
      if (prng.bool(probability)) {
        return gen.generate(prng.fork(), size);
      }
      return undefined;
    },
    function* (value) {
      if (value !== undefined) {
        yield undefined;
        yield* gen.shrink(value);
      }
    }
  );
}

/**
 * Generate objects with specified field generators
 */
export function record<T extends Record<string, unknown>>(
  fields: { [K in keyof T]: Generator<T[K]> }
): Generator<T> {
  return new BaseGenerator(
    (prng, size) => {
      const result: Partial<T> = {};
      for (const [key, gen] of Object.entries(fields)) {
        result[key as keyof T] = (gen as Generator<T[keyof T]>).generate(prng.fork(), size);
      }
      return result as T;
    },
    function* (value) {
      // Shrink individual fields
      for (const [key, gen] of Object.entries(fields)) {
        const fieldValue = value[key as keyof T];
        for (const shrunk of (gen as Generator<T[keyof T]>).shrink(fieldValue)) {
          yield { ...value, [key]: shrunk };
        }
      }
    }
  );
}

/**
 * Generate a set (unique array)
 */
export function set<T>(
  elementGen: Generator<T>,
  options: { minSize?: number; maxSize?: number } = {}
): Generator<T[]> {
  const { minSize = 0, maxSize = 10 } = options;

  return new BaseGenerator(
    (prng, size) => {
      const targetSize = prng.int(minSize, Math.min(maxSize, size));
      const seen = new Set<string>();
      const result: T[] = [];
      let attempts = 0;
      const maxAttempts = targetSize * 10;

      while (result.length < targetSize && attempts < maxAttempts) {
        const value = elementGen.generate(prng.fork(), size);
        const key = JSON.stringify(value);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(value);
        }
        attempts++;
      }
      return result;
    },
    function* (value) {
      if (value.length <= minSize) return;
      if (minSize === 0) yield [];
      if (value.length > minSize) yield value.slice(0, minSize);
      for (let i = 0; i < value.length; i++) {
        yield [...value.slice(0, i), ...value.slice(i + 1)];
      }
    }
  );
}

/**
 * Generate map (key-value records)
 */
export function map<K extends string | number, V>(
  keyGen: Generator<K>,
  valueGen: Generator<V>,
  options: { minSize?: number; maxSize?: number } = {}
): Generator<Record<string, V>> {
  const { minSize = 0, maxSize = 10 } = options;

  return new BaseGenerator(
    (prng, size) => {
      const targetSize = prng.int(minSize, Math.min(maxSize, size));
      const result: Record<string, V> = {};
      let attempts = 0;
      const maxAttempts = targetSize * 10;

      while (Object.keys(result).length < targetSize && attempts < maxAttempts) {
        const key = String(keyGen.generate(prng.fork(), size));
        if (!(key in result)) {
          result[key] = valueGen.generate(prng.fork(), size);
        }
        attempts++;
      }
      return result;
    },
    function* (value) {
      const keys = Object.keys(value);
      if (keys.length <= minSize) return;
      if (minSize === 0) yield {} as Record<string, V>;

      // Remove each key
      for (const key of keys) {
        const copy = { ...value };
        delete copy[key];
        yield copy;
      }

      // Shrink individual values
      for (const key of keys) {
        for (const shrunk of valueGen.shrink(value[key]!)) {
          yield { ...value, [key]: shrunk };
        }
      }
    }
  );
}

// ============================================================================
// DOMAIN-SPECIFIC GENERATORS
// ============================================================================

/**
 * Generate Money values (Decimal with min: 0, precision: 2)
 * Models ISL: type Money = Decimal { min: 0, precision: 2 }
 */
export function money(options: {
  min?: number;
  max?: number;
  precision?: number;
  currency?: string[];
} = {}): Generator<{ amount: number; currency?: string }> {
  const {
    min = 0,
    max = 100000,
    precision = 2,
    currency,
  } = options;

  const factor = Math.pow(10, precision);

  return new BaseGenerator(
    (prng, size) => {
      const scaledMax = Math.min(max, size * 100);
      const raw = min + prng.random() * (scaledMax - min);
      const amount = Math.round(raw * factor) / factor;
      const result: { amount: number; currency?: string } = { amount };
      if (currency && currency.length > 0) {
        result.currency = prng.pick(currency);
      }
      return result;
    },
    function* (value) {
      // Shrink towards zero (minimum valid money)
      if (value.amount !== min) {
        yield { ...value, amount: min };
      }
      // Shrink towards small round numbers
      if (value.amount > 1) {
        yield { ...value, amount: 1 };
      }
      if (value.amount > 0.01 && min <= 0.01) {
        yield { ...value, amount: 0.01 };
      }
      // Binary search towards min
      let current = value.amount;
      while (current > min + 0.01) {
        current = Math.round(((current + min) / 2) * factor) / factor;
        if (current !== value.amount) {
          yield { ...value, amount: current };
        }
      }
      // Shrink currency to first option
      if (currency && value.currency && value.currency !== currency[0]) {
        yield { ...value, currency: currency[0] };
      }
    }
  );
}

/**
 * Generate a plain money amount (number with precision constraints)
 * For fields typed as Money = Decimal { min: 0, precision: 2 }
 */
export function moneyAmount(options: {
  min?: number;
  max?: number;
  precision?: number;
} = {}): Generator<number> {
  const { min = 0, max = 100000, precision = 2 } = options;
  const factor = Math.pow(10, precision);

  return new BaseGenerator(
    (prng, size) => {
      const scaledMax = Math.min(max, Math.max(min + 1, size * 100));
      const raw = min + prng.random() * (scaledMax - min);
      return Math.round(raw * factor) / factor;
    },
    function* (value) {
      if (value === min) return;
      yield min;
      if (value > 1 && min <= 1) yield 1;
      if (value > 0.01 && min <= 0.01) yield 0.01;
      let current = value;
      while (current > min + 0.01) {
        current = Math.round(((current + min) / 2) * factor) / factor;
        if (current !== value) yield current;
      }
    }
  );
}

/**
 * Generate ISO 8601 duration strings (e.g., "PT1H30M", "P1DT12H")
 * Models ISL: type Duration
 */
export function duration(options: {
  maxDays?: number;
  maxHours?: number;
  maxMinutes?: number;
  maxSeconds?: number;
} = {}): Generator<string> {
  const {
    maxDays = 365,
    maxHours = 23,
    maxMinutes = 59,
    maxSeconds = 59,
  } = options;

  return new BaseGenerator(
    (prng, size) => {
      const days = prng.int(0, Math.min(maxDays, size));
      const hours = prng.int(0, Math.min(maxHours, size));
      const minutes = prng.int(0, Math.min(maxMinutes, size));
      const seconds = prng.int(0, Math.min(maxSeconds, size));

      let result = 'P';
      if (days > 0) result += `${days}D`;

      const hasTime = hours > 0 || minutes > 0 || seconds > 0;
      if (hasTime) {
        result += 'T';
        if (hours > 0) result += `${hours}H`;
        if (minutes > 0) result += `${minutes}M`;
        if (seconds > 0) result += `${seconds}S`;
      }

      // Ensure at least PT0S for zero duration
      if (result === 'P') result = 'PT0S';

      return result;
    },
    function* (value) {
      if (value === 'PT0S') return;
      yield 'PT0S';
      yield 'PT1S';
      yield 'PT1M';
      yield 'PT1H';
      yield 'P1D';
    }
  );
}

/**
 * Generate a numeric duration in milliseconds
 */
export function durationMs(options: {
  min?: number;
  max?: number;
} = {}): Generator<number> {
  const { min = 0, max = 86400000 } = options; // Default max: 1 day in ms

  return new BaseGenerator(
    (prng, size) => {
      const scaledMax = Math.min(max, size * 1000);
      return prng.int(min, Math.max(min, scaledMax));
    },
    function* (value) {
      if (value === min) return;
      yield min;
      if (min <= 1000 && value > 1000) yield 1000;
      if (min <= 60000 && value > 60000) yield 60000;
      let current = value;
      while (current > min + 1) {
        current = Math.trunc((current + min) / 2);
        if (current !== value) yield current;
      }
    }
  );
}

// ============================================================================
// CONSTRAINT-BASED GENERATOR
// ============================================================================

/**
 * Create a generator from field constraints
 */
export function fromConstraints(constraints: FieldConstraints, typeName: string): Generator<unknown> {
  // Handle enums
  if (constraints.enum) {
    return fromEnum(constraints.enum);
  }
  
  // Handle specific types
  switch (typeName.toLowerCase()) {
    case 'string':
      if (constraints.format === 'email') {
        return email();
      }
      return string({
        minLength: constraints.minLength ?? 0,
        maxLength: constraints.maxLength ?? 100,
      });
    
    case 'email':
      return email();
    
    case 'password':
      return password(constraints.minLength ?? 8, constraints.maxLength ?? 128);
    
    case 'int':
    case 'integer':
      return integer(constraints.min ?? -1000, constraints.max ?? 1000);
    
    case 'decimal':
    case 'float':
    case 'number':
      return float(constraints.min ?? -1000, constraints.max ?? 1000);
    
    case 'money':
      return moneyAmount({
        min: constraints.min ?? 0,
        max: constraints.max ?? 100000,
      });
    
    case 'boolean':
    case 'bool':
      return boolean();
    
    case 'uuid':
      return uuid();
    
    case 'timestamp':
      return timestamp();
    
    case 'duration':
      return duration();

    case 'ip':
    case 'ip_address':
    case 'ipaddress':
      return ipAddress();
    
    default:
      // Default to string
      return string({
        minLength: constraints.minLength ?? 0,
        maxLength: constraints.maxLength ?? 100,
      });
  }
}
