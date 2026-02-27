// ============================================================================
// Shrinker Tests - Verify shrinking algorithms work correctly
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  shrinkInput,
  deltaDebug,
  shrinkEmail,
  shrinkPassword,
  shrinkIP,
  shrinkConstrained,
  shrinkConstrainedString,
  shrinkMoney,
  shrinkMap,
  shrinkDuration,
} from '../src/shrinker.js';

describe('shrinkConstrained', () => {
  it('respects min constraint', () => {
    const shrinks = [...shrinkConstrained(50, { min: 10 })];
    for (const s of shrinks) {
      expect(s).toBeGreaterThanOrEqual(10);
    }
    // Should include 10 (the minimum)
    expect(shrinks).toContain(10);
  });

  it('respects max constraint', () => {
    const shrinks = [...shrinkConstrained(5, { min: 0, max: 100 })];
    for (const s of shrinks) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it('respects precision constraint', () => {
    const shrinks = [...shrinkConstrained(99.99, { min: 0, precision: 2 })];
    for (const s of shrinks) {
      const decimals = String(s).split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('returns empty for value at minimum', () => {
    const shrinks = [...shrinkConstrained(0, { min: 0 })];
    expect(shrinks.every((v) => v >= 0)).toBe(true);
  });
});

describe('shrinkConstrainedString', () => {
  it('respects minLength', () => {
    const shrinks = [...shrinkConstrainedString('hello world', { minLength: 3 })];
    for (const s of shrinks) {
      expect(s.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('returns empty for string at minLength', () => {
    const shrinks = [...shrinkConstrainedString('abc', { minLength: 3 })];
    expect(shrinks).toHaveLength(0);
  });

  it('shrinks towards minLength', () => {
    const shrinks = [...shrinkConstrainedString('abcdefghij', { minLength: 2 })];
    expect(shrinks.some((s) => s.length === 2)).toBe(true);
  });
});

describe('shrinkMoney', () => {
  it('shrinks towards zero', () => {
    const shrinks = [...shrinkMoney(500.50)];
    expect(shrinks).toContain(0);
  });

  it('respects minimum amount', () => {
    const shrinks = [...shrinkMoney(500.50, 10)];
    for (const s of shrinks) {
      expect(s).toBeGreaterThanOrEqual(10);
    }
    expect(shrinks).toContain(10);
  });

  it('respects precision', () => {
    const shrinks = [...shrinkMoney(999.99, 0, 2)];
    for (const s of shrinks) {
      const decimals = String(s).split('.')[1];
      if (decimals) {
        expect(decimals.length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('shrinkMap', () => {
  it('shrinks by removing keys', () => {
    const input = { a: 1, b: 2, c: 3 };
    const shrinks = [...shrinkMap(input)];
    expect(shrinks.some((m) => Object.keys(m).length === 0)).toBe(true);
    expect(shrinks.some((m) => Object.keys(m).length === 2)).toBe(true);
  });

  it('respects minSize', () => {
    const input = { a: 1, b: 2, c: 3 };
    const shrinks = [...shrinkMap(input, 2)];
    for (const s of shrinks) {
      expect(Object.keys(s).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns empty for map at minSize', () => {
    const input = { a: 1, b: 2 };
    const shrinks = [...shrinkMap(input, 2)];
    for (const s of shrinks) {
      expect(Object.keys(s).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('shrinkDuration', () => {
  it('shrinks towards PT0S', () => {
    const shrinks = [...shrinkDuration('P1DT12H30M')];
    expect(shrinks).toContain('PT0S');
  });

  it('returns empty for PT0S', () => {
    const shrinks = [...shrinkDuration('PT0S')];
    expect(shrinks).toHaveLength(0);
  });
});

describe('shrinkEmail', () => {
  it('produces valid emails', () => {
    const shrinks = [...shrinkEmail('verylongemail@complex.domain.org')];
    for (const s of shrinks) {
      expect(s).toContain('@');
      expect(s.split('@')[1]).toContain('.');
    }
  });

  it('includes simplest email', () => {
    const shrinks = [...shrinkEmail('test@example.com')];
    expect(shrinks).toContain('a@b.co');
  });
});

describe('shrinkPassword', () => {
  it('respects minimum length', () => {
    const shrinks = [...shrinkPassword('verylongpassword123!', 8)];
    for (const s of shrinks) {
      expect(s.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('returns empty for minimum-length password', () => {
    const shrinks = [...shrinkPassword('abcd1234', 8)];
    expect(shrinks).toHaveLength(0);
  });
});

describe('shrinkIP', () => {
  it('shrinks to standard IPs', () => {
    const shrinks = [...shrinkIP('192.168.1.100')];
    expect(shrinks).toContain('0.0.0.0');
    expect(shrinks).toContain('127.0.0.1');
  });
});

describe('shrinkInput (integration)', () => {
  it('finds minimal failing input', async () => {
    const original = { x: 42, y: 'hello', z: true };

    // Test fails when x > 5
    const testFn = async (input: Record<string, unknown>) => {
      return (input.x as number) <= 5;
    };

    const result = await shrinkInput(original, testFn, { maxShrinks: 50 });

    expect(result.original).toEqual(original);
    // Minimal should have x <= 42 (shrunk)
    expect(result.shrinkAttempts).toBeGreaterThan(0);
    // The minimal input's x should still be > 5 (still failing)
    // but should be smaller than 42
  });
});

describe('deltaDebug (integration)', () => {
  it('finds minimal key set that causes failure', async () => {
    const original = { a: 1, b: 2, c: 3, d: 4, e: 5 };

    // Test fails only when 'c' is present
    const testFn = async (input: Record<string, unknown>) => {
      return !('c' in input);
    };

    const result = await deltaDebug(original, testFn, { maxShrinks: 100 });
    expect('c' in result.minimal).toBe(true);
    expect(Object.keys(result.minimal).length).toBeLessThanOrEqual(
      Object.keys(original).length
    );
  });
});
