import { describe, it, expect } from 'vitest';
import {
  stableStringify,
  generateFingerprint,
  generateFingerprintFromString,
  isValidFingerprint,
  combineFingerprints,
  generateSpecFingerprint,
  CacheKeys,
} from '../fingerprintCache.js';

describe('stableStringify', () => {
  describe('primitive values', () => {
    it('should stringify strings correctly', () => {
      expect(stableStringify('hello')).toBe('"hello"');
    });

    it('should stringify numbers correctly', () => {
      expect(stableStringify(42)).toBe('42');
      expect(stableStringify(3.14)).toBe('3.14');
    });

    it('should stringify booleans correctly', () => {
      expect(stableStringify(true)).toBe('true');
      expect(stableStringify(false)).toBe('false');
    });

    it('should stringify null correctly', () => {
      expect(stableStringify(null)).toBe('null');
    });
  });

  describe('arrays', () => {
    it('should stringify arrays preserving order', () => {
      expect(stableStringify([1, 2, 3])).toBe('[\n  1,\n  2,\n  3\n]');
    });

    it('should stringify nested arrays', () => {
      const result = stableStringify([[1, 2], [3, 4]]);
      expect(result).toContain('[');
      expect(result).toContain('1');
      expect(result).toContain('4');
    });
  });

  describe('objects with key sorting', () => {
    it('should sort object keys alphabetically', () => {
      const obj = { zebra: 1, apple: 2, mango: 3 };
      const result = stableStringify(obj);

      // Check that keys appear in alphabetical order
      const appleIndex = result.indexOf('apple');
      const mangoIndex = result.indexOf('mango');
      const zebraIndex = result.indexOf('zebra');

      expect(appleIndex).toBeLessThan(mangoIndex);
      expect(mangoIndex).toBeLessThan(zebraIndex);
    });

    it('should produce identical output for objects with same content', () => {
      const obj1 = { b: 2, a: 1, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const obj3 = { a: 1, b: 2, c: 3 };

      expect(stableStringify(obj1)).toBe(stableStringify(obj2));
      expect(stableStringify(obj2)).toBe(stableStringify(obj3));
    });

    it('should sort nested object keys', () => {
      const obj = {
        outer: {
          z: 1,
          a: 2,
        },
      };
      const result = stableStringify(obj);

      const aIndex = result.indexOf('"a"');
      const zIndex = result.indexOf('"z"');

      expect(aIndex).toBeLessThan(zIndex);
    });

    it('should handle deeply nested objects', () => {
      const obj1 = {
        level1: {
          z: {
            c: 3,
            a: 1,
          },
          a: {
            b: 2,
            a: 1,
          },
        },
      };

      const obj2 = {
        level1: {
          a: {
            a: 1,
            b: 2,
          },
          z: {
            a: 1,
            c: 3,
          },
        },
      };

      expect(stableStringify(obj1)).toBe(stableStringify(obj2));
    });
  });

  describe('mixed content', () => {
    it('should handle arrays of objects', () => {
      const arr1 = [{ b: 2, a: 1 }, { d: 4, c: 3 }];
      const arr2 = [{ a: 1, b: 2 }, { c: 3, d: 4 }];

      expect(stableStringify(arr1)).toBe(stableStringify(arr2));
    });

    it('should handle objects with array values', () => {
      const obj1 = { b: [1, 2], a: [3, 4] };
      const obj2 = { a: [3, 4], b: [1, 2] };

      expect(stableStringify(obj1)).toBe(stableStringify(obj2));
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      expect(stableStringify({})).toBe('{}');
    });

    it('should handle empty arrays', () => {
      expect(stableStringify([])).toBe('[]');
    });

    it('should handle undefined in objects (omitted)', () => {
      const obj = { a: 1, b: undefined };
      const result = stableStringify(obj);
      expect(result).not.toContain('undefined');
    });
  });
});

describe('generateFingerprint', () => {
  it('should generate a 64-character hex string', () => {
    const fingerprint = generateFingerprint({ test: 'data' });
    expect(fingerprint).toHaveLength(64);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate identical fingerprints for identical content', () => {
    const fp1 = generateFingerprint({ a: 1, b: 2 });
    const fp2 = generateFingerprint({ b: 2, a: 1 });

    expect(fp1).toBe(fp2);
  });

  it('should generate different fingerprints for different content', () => {
    const fp1 = generateFingerprint({ a: 1 });
    const fp2 = generateFingerprint({ a: 2 });

    expect(fp1).not.toBe(fp2);
  });

  it('should handle complex nested structures', () => {
    const complex = {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
      settings: {
        theme: 'dark',
        notifications: true,
      },
    };

    const fp = generateFingerprint(complex);
    expect(fp).toHaveLength(64);

    // Same structure, different key order
    const complex2 = {
      settings: {
        notifications: true,
        theme: 'dark',
      },
      users: [
        { name: 'Alice', id: 1 },
        { name: 'Bob', id: 2 },
      ],
    };

    expect(generateFingerprint(complex2)).toBe(fp);
  });

  it('should handle primitive values', () => {
    expect(generateFingerprint('string')).toHaveLength(64);
    expect(generateFingerprint(42)).toHaveLength(64);
    expect(generateFingerprint(true)).toHaveLength(64);
    expect(generateFingerprint(null)).toHaveLength(64);
  });
});

describe('generateFingerprintFromString', () => {
  it('should generate a 64-character hex string', () => {
    const fp = generateFingerprintFromString('hello world');
    expect(fp).toHaveLength(64);
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should generate identical fingerprints for identical strings', () => {
    const fp1 = generateFingerprintFromString('test content');
    const fp2 = generateFingerprintFromString('test content');

    expect(fp1).toBe(fp2);
  });

  it('should generate different fingerprints for different strings', () => {
    const fp1 = generateFingerprintFromString('content A');
    const fp2 = generateFingerprintFromString('content B');

    expect(fp1).not.toBe(fp2);
  });

  it('should handle empty strings', () => {
    const fp = generateFingerprintFromString('');
    expect(fp).toHaveLength(64);
  });

  it('should handle unicode strings', () => {
    const fp = generateFingerprintFromString('Hello 世界 🌍');
    expect(fp).toHaveLength(64);
  });
});

describe('isValidFingerprint', () => {
  it('should return true for valid fingerprints', () => {
    const validFp = generateFingerprint({ test: 'data' });
    expect(isValidFingerprint(validFp)).toBe(true);
  });

  it('should return false for too short strings', () => {
    expect(isValidFingerprint('abc123')).toBe(false);
  });

  it('should return false for too long strings', () => {
    expect(isValidFingerprint('a'.repeat(65))).toBe(false);
  });

  it('should return false for non-hex characters', () => {
    expect(isValidFingerprint('g'.repeat(64))).toBe(false);
    expect(isValidFingerprint('ABCD'.repeat(16))).toBe(false); // uppercase not allowed
  });

  it('should return false for empty string', () => {
    expect(isValidFingerprint('')).toBe(false);
  });
});

describe('combineFingerprints', () => {
  it('should combine multiple fingerprints into one', () => {
    const fp1 = generateFingerprint({ a: 1 });
    const fp2 = generateFingerprint({ b: 2 });
    const combined = combineFingerprints(fp1, fp2);

    expect(combined).toHaveLength(64);
    expect(combined).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should produce same result regardless of input order', () => {
    const fp1 = generateFingerprint({ a: 1 });
    const fp2 = generateFingerprint({ b: 2 });
    const fp3 = generateFingerprint({ c: 3 });

    const combined1 = combineFingerprints(fp1, fp2, fp3);
    const combined2 = combineFingerprints(fp3, fp1, fp2);
    const combined3 = combineFingerprints(fp2, fp3, fp1);

    expect(combined1).toBe(combined2);
    expect(combined2).toBe(combined3);
  });

  it('should produce different results for different fingerprints', () => {
    const fpA = generateFingerprint({ a: 1 });
    const fpB = generateFingerprint({ b: 2 });
    const fpC = generateFingerprint({ c: 3 });

    const combined1 = combineFingerprints(fpA, fpB);
    const combined2 = combineFingerprints(fpA, fpC);

    expect(combined1).not.toBe(combined2);
  });

  it('should handle single fingerprint', () => {
    const fp = generateFingerprint({ test: 'data' });
    const combined = combineFingerprints(fp);

    expect(combined).toHaveLength(64);
  });
});

describe('generateSpecFingerprint', () => {
  it('should generate fingerprint for spec content', () => {
    const specContent = `
      contract UserAuth {
        endpoint login(email: String, password: String) -> Session
      }
    `;
    const fp = generateSpecFingerprint(specContent);

    expect(fp).toHaveLength(64);
  });

  it('should include metadata in fingerprint calculation', () => {
    const specContent = 'contract Test {}';

    const fp1 = generateSpecFingerprint(specContent, { version: '1.0.0' });
    const fp2 = generateSpecFingerprint(specContent, { version: '2.0.0' });

    expect(fp1).not.toBe(fp2);
  });

  it('should produce same fingerprint for same content and metadata', () => {
    const specContent = 'contract Test {}';
    const metadata = { version: '1.0.0', name: 'test' };

    const fp1 = generateSpecFingerprint(specContent, metadata);
    const fp2 = generateSpecFingerprint(specContent, { name: 'test', version: '1.0.0' });

    expect(fp1).toBe(fp2);
  });

  it('should handle missing metadata', () => {
    const specContent = 'contract Test {}';

    const fp1 = generateSpecFingerprint(specContent);
    const fp2 = generateSpecFingerprint(specContent, undefined);

    expect(fp1).toBe(fp2);
  });
});

describe('CacheKeys', () => {
  const testFingerprint = generateFingerprint({ test: 'data' });

  describe('parsedAst', () => {
    it('should create AST cache key', () => {
      const key = CacheKeys.parsedAst(testFingerprint);
      expect(key).toBe(`ast:${testFingerprint}`);
    });
  });

  describe('generatedTests', () => {
    it('should create test cache key with generator', () => {
      const key = CacheKeys.generatedTests(testFingerprint, 'vitest');
      expect(key).toBe(`tests:vitest:${testFingerprint}`);
    });

    it('should create different keys for different generators', () => {
      const keyVitest = CacheKeys.generatedTests(testFingerprint, 'vitest');
      const keyJest = CacheKeys.generatedTests(testFingerprint, 'jest');

      expect(keyVitest).not.toBe(keyJest);
    });
  });

  describe('typeCheckResult', () => {
    it('should create typecheck cache key', () => {
      const key = CacheKeys.typeCheckResult(testFingerprint);
      expect(key).toBe(`typecheck:${testFingerprint}`);
    });
  });

  describe('verificationResult', () => {
    it('should create verification cache key with config hash', () => {
      const configHash = 'abc123';
      const key = CacheKeys.verificationResult(testFingerprint, configHash);
      expect(key).toBe(`verify:abc123:${testFingerprint}`);
    });
  });
});
