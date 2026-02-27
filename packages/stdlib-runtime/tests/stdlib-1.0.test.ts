/**
 * ISL Standard Library 1.0 Integration Tests
 * Tests all 10 modules are properly exported and functional
 */

import { describe, test, expect } from 'vitest';
import StdLib, {
  STDLIB_VERSION,
  STDLIB_MODULES,
  DETERMINISM_INFO,
  isDeterministic,
  getNonDeterministicFunctions,
} from '../src/index';

describe('StdLib 1.0 Integration', () => {
  describe('Module Exports', () => {
    test('all 10 modules are exported', () => {
      expect(StdLib.String).toBeDefined();
      expect(StdLib.Math).toBeDefined();
      expect(StdLib.Collections).toBeDefined();
      expect(StdLib.JSON).toBeDefined();
      expect(StdLib.DateTime).toBeDefined();
      expect(StdLib.UUID).toBeDefined();
      expect(StdLib.Crypto).toBeDefined();
      expect(StdLib.Encoding).toBeDefined();
      expect(StdLib.Regex).toBeDefined();
      expect(StdLib.URL).toBeDefined();
    });

    test('version is 1.0.0', () => {
      expect(STDLIB_VERSION).toBe('1.0.0');
    });

    test('STDLIB_MODULES contains all 10 modules', () => {
      expect(STDLIB_MODULES).toHaveLength(10);
      expect(STDLIB_MODULES).toContain('@isl/string');
      expect(STDLIB_MODULES).toContain('@isl/math');
      expect(STDLIB_MODULES).toContain('@isl/collections');
      expect(STDLIB_MODULES).toContain('@isl/json');
      expect(STDLIB_MODULES).toContain('@isl/datetime');
      expect(STDLIB_MODULES).toContain('@isl/uuid');
      expect(STDLIB_MODULES).toContain('@isl/crypto');
      expect(STDLIB_MODULES).toContain('@isl/encoding');
      expect(STDLIB_MODULES).toContain('@isl/regex');
      expect(STDLIB_MODULES).toContain('@isl/url');
    });
  });

  describe('Determinism Metadata', () => {
    test('fully deterministic modules are identified', () => {
      expect(DETERMINISM_INFO.fully_deterministic).toContain('@isl/string');
      expect(DETERMINISM_INFO.fully_deterministic).toContain('@isl/math');
      expect(DETERMINISM_INFO.fully_deterministic).toContain('@isl/collections');
      expect(DETERMINISM_INFO.fully_deterministic).toContain('@isl/json');
      expect(DETERMINISM_INFO.fully_deterministic).toContain('@isl/encoding');
      expect(DETERMINISM_INFO.fully_deterministic).toContain('@isl/regex');
      expect(DETERMINISM_INFO.fully_deterministic).toContain('@isl/url');
    });

    test('mixed determinism modules are identified', () => {
      expect(DETERMINISM_INFO.mixed_determinism).toContain('@isl/datetime');
      expect(DETERMINISM_INFO.mixed_determinism).toContain('@isl/uuid');
      expect(DETERMINISM_INFO.mixed_determinism).toContain('@isl/crypto');
    });

    test('non-deterministic functions are listed', () => {
      expect(DETERMINISM_INFO.nondeterministic_functions['@isl/datetime']).toContain('now');
      expect(DETERMINISM_INFO.nondeterministic_functions['@isl/uuid']).toContain('generateUUID');
      expect(DETERMINISM_INFO.nondeterministic_functions['@isl/crypto']).toContain('generateToken');
    });

    test('isDeterministic correctly identifies functions', () => {
      // Deterministic functions
      expect(isDeterministic('@isl/string', 'trim')).toBe(true);
      expect(isDeterministic('@isl/math', 'abs')).toBe(true);
      expect(isDeterministic('@isl/datetime', 'formatTimestamp')).toBe(true);
      expect(isDeterministic('@isl/uuid', 'isValidUUID')).toBe(true);
      
      // Non-deterministic functions
      expect(isDeterministic('@isl/datetime', 'now')).toBe(false);
      expect(isDeterministic('@isl/uuid', 'generateUUID')).toBe(false);
      expect(isDeterministic('@isl/crypto', 'generateToken')).toBe(false);
    });

    test('getNonDeterministicFunctions returns all non-det functions', () => {
      const nonDetFns = getNonDeterministicFunctions();
      expect(nonDetFns.length).toBeGreaterThan(0);
      expect(nonDetFns).toContainEqual({ module: '@isl/datetime', function: 'now' });
      expect(nonDetFns).toContainEqual({ module: '@isl/uuid', function: 'generateUUID' });
    });
  });

  describe('String Module Integration', () => {
    test('basic string operations work', () => {
      expect(StdLib.String.trim('  hello  ')).toBe('hello');
      expect(StdLib.String.toLowerCase('HELLO')).toBe('hello');
      expect(StdLib.String.contains('hello world', 'world')).toBe(true);
    });
  });

  describe('Math Module Integration', () => {
    test('basic math operations work', () => {
      expect(StdLib.Math.abs(-5)).toBe(5);
      expect(StdLib.Math.clamp(15, 0, 10)).toBe(10);
      expect(StdLib.Math.sum([1, 2, 3])).toBe(6);
    });
  });

  describe('Collections Module Integration', () => {
    test('basic collection operations work', () => {
      expect(StdLib.Collections.first([1, 2, 3])).toBe(1);
      expect(StdLib.Collections.unique([1, 1, 2, 2, 3])).toEqual([1, 2, 3]);
      expect(StdLib.Collections.filter([1, 2, 3], x => x > 1)).toEqual([2, 3]);
    });
  });

  describe('JSON Module Integration', () => {
    test('basic JSON operations work', () => {
      const obj = { a: 1, b: 2 };
      const str = StdLib.JSON.stringify(obj);
      expect(StdLib.JSON.parse(str)).toEqual(obj);
      expect(StdLib.JSON.get(obj, 'a')).toBe(1);
    });
  });

  describe('DateTime Module Integration', () => {
    test('deterministic datetime operations work', () => {
      const timestamp = 1704067200000; // 2024-01-01 00:00:00 UTC
      expect(StdLib.DateTime.formatTimestamp(timestamp, 'ISO_DATE')).toBe('2024-01-01');
      expect(StdLib.DateTime.isLeapYear(2024)).toBe(true);
      expect(StdLib.DateTime.daysInMonth(2024, 2)).toBe(29);
    });

    test('now() returns current timestamp (non-deterministic)', () => {
      const before = Date.now();
      const result = StdLib.DateTime.now();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe('UUID Module Integration', () => {
    test('deterministic UUID operations work', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(StdLib.UUID.isValidUUID(uuid)).toBe(true);
      expect(StdLib.UUID.normalizeUUID(uuid.toUpperCase())).toBe(uuid);
    });

    test('generateUUID returns valid UUID (non-deterministic)', () => {
      const uuid = StdLib.UUID.generateUUID();
      expect(StdLib.UUID.isValidUUID(uuid)).toBe(true);
    });

    test('generateUUIDv5 is deterministic', () => {
      const uuid1 = StdLib.UUID.generateUUIDv5(StdLib.UUID.NAMESPACE_DNS, 'example.com');
      const uuid2 = StdLib.UUID.generateUUIDv5(StdLib.UUID.NAMESPACE_DNS, 'example.com');
      expect(uuid1).toBe(uuid2);
    });
  });

  describe('Crypto Module Integration', () => {
    test('deterministic hash operations work', async () => {
      const hash1 = await StdLib.Crypto.hashSHA256('hello');
      const hash2 = await StdLib.Crypto.hashSHA256('hello');
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    test('generateToken returns random tokens (non-deterministic)', () => {
      const token1 = StdLib.Crypto.generateToken(32);
      const token2 = StdLib.Crypto.generateToken(32);
      expect(token1).not.toBe(token2);
    });
  });

  describe('Encoding Module Integration', () => {
    test('Base64 encoding is deterministic', () => {
      const encoded = StdLib.Encoding.encodeBase64('hello');
      const decoded = StdLib.Encoding.decodeBase64(encoded);
      expect(decoded).toBe('hello');
    });

    test('URL encoding is deterministic', () => {
      const encoded = StdLib.Encoding.encodeUrlComponent('hello world');
      expect(StdLib.Encoding.decodeUrlComponent(encoded)).toBe('hello world');
    });
  });

  describe('Regex Module Integration', () => {
    test('regex matching is deterministic', () => {
      expect(StdLib.Regex.test('hello', 'hel+')).toBe(true);
      const match = StdLib.Regex.match('hello world', 'world');
      expect(match?.value).toBe('world');
    });

    test('common pattern matchers work', () => {
      const emailMatch = StdLib.Regex.matchEmail('user@example.com');
      expect(emailMatch).not.toBeNull();
    });
  });

  describe('URL Module Integration', () => {
    test('URL parsing is deterministic', () => {
      const url = 'https://example.com:8080/path?query=value#hash';
      const parsed = StdLib.URL.parse(url);
      expect(parsed.protocol).toBe('https');
      expect(parsed.hostname).toBe('example.com');
      expect(parsed.port).toBe(8080);
      expect(parsed.pathname).toBe('/path');
    });

    test('URL manipulation is deterministic', () => {
      const url = 'https://example.com/path';
      const withParam = StdLib.URL.setQueryParam(url, 'key', 'value');
      expect(StdLib.URL.hasQueryParam(withParam, 'key')).toBe(true);
    });
  });

  describe('Cross-Module Integration', () => {
    test('modules can be used together', async () => {
      // Parse JSON config
      const config = StdLib.JSON.parse('{"baseUrl": "https://api.example.com", "timeout": 5000}');
      
      // Extract URL
      const baseUrl = StdLib.JSON.getString(config, 'baseUrl');
      expect(baseUrl).toBe('https://api.example.com');
      
      // Parse and modify URL
      const apiUrl = StdLib.URL.setQueryParam(baseUrl!, 'key', 'value');
      expect(StdLib.URL.getQueryParam(apiUrl, 'key')).toBe('value');
      
      // Generate request ID
      const requestId = StdLib.UUID.generateUUID();
      expect(StdLib.UUID.isValidUUID(requestId)).toBe(true);
      
      // Hash some data
      const data = StdLib.String.join([baseUrl!, requestId], ':');
      const hash = await StdLib.Crypto.hashSHA256(data);
      expect(hash.length).toBe(64);
    });
  });
});
