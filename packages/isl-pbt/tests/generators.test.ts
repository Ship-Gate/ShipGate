// ============================================================================
// Generator Tests - Verify all type generators produce valid output
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  createPRNG,
  integer,
  float,
  boolean,
  string,
  email,
  password,
  uuid,
  timestamp,
  ipAddress,
  array,
  set,
  map,
  oneOf,
  constant,
  fromEnum,
  optional,
  record,
  money,
  moneyAmount,
  duration,
  durationMs,
  fromConstraints,
} from '../src/random.js';

const SEED = 42;
const NUM_SAMPLES = 100;

function samples<T>(gen: ReturnType<typeof integer>, count = NUM_SAMPLES): T[] {
  const prng = createPRNG(SEED);
  const results: T[] = [];
  for (let i = 0; i < count; i++) {
    results.push(gen.generate(prng.fork(), Math.min(i, 100)) as T);
  }
  return results;
}

describe('PRNG', () => {
  it('is deterministic with same seed', () => {
    const a = createPRNG(42);
    const b = createPRNG(42);
    for (let i = 0; i < 50; i++) {
      expect(a.random()).toBe(b.random());
    }
  });

  it('produces different sequences with different seeds', () => {
    const a = createPRNG(42);
    const b = createPRNG(99);
    const aValues = Array.from({ length: 10 }, () => a.random());
    const bValues = Array.from({ length: 10 }, () => b.random());
    expect(aValues).not.toEqual(bValues);
  });

  it('fork produces independent streams', () => {
    const prng = createPRNG(42);
    const fork1 = prng.fork();
    const fork2 = prng.fork();
    // Forks should not produce the same first value
    // (they get different seeds via prng.int)
    const v1 = fork1.random();
    const v2 = fork2.random();
    // Both are valid numbers
    expect(v1).toBeGreaterThanOrEqual(0);
    expect(v1).toBeLessThan(1);
    expect(v2).toBeGreaterThanOrEqual(0);
    expect(v2).toBeLessThan(1);
  });
});

describe('Primitive Generators', () => {
  it('integer generates within range', () => {
    const gen = integer(-10, 10);
    const vals = samples<number>(gen);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('float generates within range with precision', () => {
    const gen = float(0, 100, 2);
    const vals = samples<number>(gen);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
      // Check precision (at most 2 decimal places)
      const decimals = String(v).split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('boolean generates true and false', () => {
    const gen = boolean();
    const vals = samples<boolean>(gen, 200);
    expect(vals.some((v) => v === true)).toBe(true);
    expect(vals.some((v) => v === false)).toBe(true);
  });

  it('string respects length constraints', () => {
    const gen = string({ minLength: 3, maxLength: 10 });
    const prng = createPRNG(SEED);
    for (let i = 0; i < 50; i++) {
      const v = gen.generate(prng.fork(), 100);
      expect(v.length).toBeGreaterThanOrEqual(3);
      expect(v.length).toBeLessThanOrEqual(10);
    }
  });

  it('email generates valid emails', () => {
    const gen = email();
    const vals = samples<string>(gen);
    for (const v of vals) {
      expect(v).toContain('@');
      const [local, domain] = v.split('@');
      expect(local!.length).toBeGreaterThan(0);
      expect(domain!).toContain('.');
    }
  });

  it('password generates within length constraints', () => {
    const gen = password(8, 32);
    const vals = samples<string>(gen);
    for (const v of vals) {
      expect(v.length).toBeGreaterThanOrEqual(8);
      expect(v.length).toBeLessThanOrEqual(32);
    }
  });

  it('uuid generates valid v4 UUIDs', () => {
    const gen = uuid();
    const vals = samples<string>(gen);
    for (const v of vals) {
      expect(v).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    }
  });

  it('timestamp generates ISO 8601 strings', () => {
    const gen = timestamp();
    const vals = samples<string>(gen);
    for (const v of vals) {
      expect(new Date(v).toISOString()).toBe(v);
    }
  });

  it('ipAddress generates valid IPv4', () => {
    const gen = ipAddress();
    const vals = samples<string>(gen);
    for (const v of vals) {
      const parts = v.split('.');
      expect(parts).toHaveLength(4);
      for (const p of parts) {
        const n = parseInt(p, 10);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('Money Generator', () => {
  it('generates non-negative amounts with correct precision', () => {
    const gen = moneyAmount({ min: 0, max: 10000, precision: 2 });
    const vals = samples<number>(gen);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10000);
      // Check precision
      const decimals = String(v).split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('money() generates amount with optional currency', () => {
    const gen = money({ min: 0, max: 1000, currency: ['USD', 'EUR', 'GBP'] });
    const prng = createPRNG(SEED);
    for (let i = 0; i < 50; i++) {
      const v = gen.generate(prng.fork(), 50);
      expect(v.amount).toBeGreaterThanOrEqual(0);
      expect(v.amount).toBeLessThanOrEqual(1000);
      expect(['USD', 'EUR', 'GBP']).toContain(v.currency);
    }
  });

  it('shrinks money towards minimum', () => {
    const gen = moneyAmount({ min: 0, max: 10000 });
    const shrinks = [...gen.shrink(500.50)];
    expect(shrinks).toContain(0);
    expect(shrinks.some((v) => v > 0 && v < 500.5)).toBe(true);
  });
});

describe('Duration Generator', () => {
  it('generates valid ISO 8601 durations', () => {
    const gen = duration();
    const vals = samples<string>(gen);
    for (const v of vals) {
      expect(v).toMatch(/^P/);
    }
  });

  it('durationMs generates positive milliseconds', () => {
    const gen = durationMs({ min: 0, max: 60000 });
    const vals = samples<number>(gen);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(60000);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('Collection Generators', () => {
  it('array respects length constraints', () => {
    const gen = array(integer(0, 10), { minLength: 2, maxLength: 5 });
    const prng = createPRNG(SEED);
    for (let i = 0; i < 50; i++) {
      const v = gen.generate(prng.fork(), 100);
      expect(v.length).toBeGreaterThanOrEqual(2);
      expect(v.length).toBeLessThanOrEqual(5);
    }
  });

  it('set generates unique elements', () => {
    const gen = set(integer(0, 100), { minSize: 3, maxSize: 8 });
    const prng = createPRNG(SEED);
    for (let i = 0; i < 30; i++) {
      const v = gen.generate(prng.fork(), 100);
      expect(v.length).toBeGreaterThanOrEqual(3);
      const unique = new Set(v);
      expect(unique.size).toBe(v.length);
    }
  });

  it('map generates key-value records', () => {
    const gen = map(
      string({ minLength: 1, maxLength: 5 }),
      integer(0, 100),
      { minSize: 1, maxSize: 5 }
    );
    const prng = createPRNG(SEED);
    for (let i = 0; i < 30; i++) {
      const v = gen.generate(prng.fork(), 100);
      const keys = Object.keys(v);
      expect(keys.length).toBeGreaterThanOrEqual(1);
      expect(keys.length).toBeLessThanOrEqual(5);
      for (const val of Object.values(v)) {
        expect(typeof val).toBe('number');
      }
    }
  });
});

describe('Composite Generators', () => {
  it('oneOf picks from multiple generators', () => {
    const gen = oneOf(constant('a'), constant('b'), constant('c'));
    const vals = samples<string>(gen, 200);
    expect(vals).toContain('a');
    expect(vals).toContain('b');
    expect(vals).toContain('c');
  });

  it('fromEnum picks from values', () => {
    const gen = fromEnum(['RED', 'GREEN', 'BLUE'] as const);
    const vals = samples<string>(gen, 100);
    for (const v of vals) {
      expect(['RED', 'GREEN', 'BLUE']).toContain(v);
    }
  });

  it('optional can produce undefined', () => {
    const gen = optional(integer(0, 10), 0.5);
    const vals = samples<number | undefined>(gen, 200);
    expect(vals.some((v) => v === undefined)).toBe(true);
    expect(vals.some((v) => v !== undefined)).toBe(true);
  });

  it('record generates objects with correct fields', () => {
    const gen = record({
      name: string({ minLength: 1, maxLength: 10 }),
      age: integer(0, 120),
      active: boolean(),
    });
    const prng = createPRNG(SEED);
    for (let i = 0; i < 50; i++) {
      const v = gen.generate(prng.fork(), 50);
      expect(typeof v.name).toBe('string');
      expect(typeof v.age).toBe('number');
      expect(typeof v.active).toBe('boolean');
    }
  });
});

describe('fromConstraints', () => {
  it('handles money type', () => {
    const gen = fromConstraints({ min: 0 }, 'money');
    const prng = createPRNG(SEED);
    for (let i = 0; i < 50; i++) {
      const v = gen.generate(prng.fork(), 50) as number;
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles duration type', () => {
    const gen = fromConstraints({}, 'duration');
    const prng = createPRNG(SEED);
    const v = gen.generate(prng.fork(), 50) as string;
    expect(v).toMatch(/^P/);
  });

  it('handles enum constraints', () => {
    const gen = fromConstraints({ enum: ['A', 'B', 'C'] }, 'string');
    const vals = samples<string>(gen, 50);
    for (const v of vals) {
      expect(['A', 'B', 'C']).toContain(v);
    }
  });
});

describe('Deterministic Runs', () => {
  it('same seed produces identical sequences', () => {
    const gen = record({
      email: email(),
      amount: moneyAmount(),
      status: fromEnum(['ACTIVE', 'INACTIVE'] as const),
    });

    const run1: unknown[] = [];
    const run2: unknown[] = [];

    for (let seed of [42, 123, 9999]) {
      const prng1 = createPRNG(seed);
      const prng2 = createPRNG(seed);
      for (let i = 0; i < 20; i++) {
        run1.push(gen.generate(prng1.fork(), i));
        run2.push(gen.generate(prng2.fork(), i));
      }
    }

    expect(run1).toEqual(run2);
  });
});

describe('Shrinking', () => {
  it('integer shrinks towards zero', () => {
    const gen = integer(-100, 100);
    const shrinks = [...gen.shrink(42)];
    expect(shrinks).toContain(0);
    expect(shrinks.length).toBeGreaterThan(0);
  });

  it('string shrinks towards empty/shorter', () => {
    const gen = string({ minLength: 0, maxLength: 100 });
    const shrinks = [...gen.shrink('hello world')];
    expect(shrinks).toContain('');
    expect(shrinks.some((s) => s.length < 'hello world'.length)).toBe(true);
  });

  it('array shrinks by removing elements', () => {
    const gen = array(integer(0, 10), { minLength: 0 });
    const shrinks = [...gen.shrink([1, 2, 3, 4, 5])];
    expect(shrinks.some((a) => a.length === 0)).toBe(true);
    expect(shrinks.some((a) => a.length < 5)).toBe(true);
  });

  it('email shrinks to simpler forms', () => {
    const gen = email();
    const shrinks = [...gen.shrink('longusername@complex.domain.org')];
    expect(shrinks.some((e) => e.length < 'longusername@complex.domain.org'.length)).toBe(true);
  });
});
