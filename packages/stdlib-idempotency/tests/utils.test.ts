// ============================================================================
// ISL Standard Library - Utilities Tests
// @stdlib/idempotency/tests
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  validateKey,
  prefixKey,
  unprefixKey,
  computeRequestHash,
  computeHttpRequestHash,
  canonicalize,
  generateLockToken,
  isValidLockToken,
  calculateExpiration,
  isExpired,
  remainingTtl,
  serializeResponse,
  deserializeResponse,
  byteSize,
  validateResponseSize,
  calculateBackoff,
  generateIdempotencyKey,
  generateDeterministicKey,
  wrapError,
  isRetriableError,
  IdempotencyException,
  IdempotencyErrorCode,
} from '../implementations/typescript';

describe('Key Validation', () => {
  describe('validateKey', () => {
    it('should accept valid keys', () => {
      expect(() => validateKey('simple-key')).not.toThrow();
      expect(() => validateKey('key_with_underscore')).not.toThrow();
      expect(() => validateKey('key.with.dots')).not.toThrow();
      expect(() => validateKey('key:with:colons')).not.toThrow();
      expect(() => validateKey('abc123')).not.toThrow();
    });

    it('should reject empty keys', () => {
      expect(() => validateKey('')).toThrow(IdempotencyException);
    });

    it('should reject keys that are too long', () => {
      const longKey = 'a'.repeat(300);
      expect(() => validateKey(longKey)).toThrow(IdempotencyException);
    });

    it('should reject keys with invalid characters', () => {
      expect(() => validateKey('key with spaces')).toThrow(IdempotencyException);
      expect(() => validateKey('key/with/slashes')).toThrow(IdempotencyException);
      expect(() => validateKey('key@symbol')).toThrow(IdempotencyException);
    });

    it('should respect custom max length', () => {
      expect(() => validateKey('12345', 3)).toThrow();
      expect(() => validateKey('123', 3)).not.toThrow();
    });
  });

  describe('prefixKey', () => {
    it('should add prefix with colon separator', () => {
      expect(prefixKey('mykey', 'prefix')).toBe('prefix:mykey');
    });

    it('should return original key when no prefix', () => {
      expect(prefixKey('mykey')).toBe('mykey');
      expect(prefixKey('mykey', '')).toBe('mykey');
    });
  });

  describe('unprefixKey', () => {
    it('should remove prefix', () => {
      expect(unprefixKey('prefix:mykey', 'prefix')).toBe('mykey');
    });

    it('should return original key when prefix not present', () => {
      expect(unprefixKey('mykey', 'prefix')).toBe('mykey');
    });

    it('should return original key when no prefix specified', () => {
      expect(unprefixKey('mykey')).toBe('mykey');
    });
  });
});

describe('Hashing', () => {
  describe('computeRequestHash', () => {
    it('should compute deterministic hash', () => {
      const data = { name: 'test', value: 123 };
      const hash1 = computeRequestHash(data);
      const hash2 = computeRequestHash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should produce different hashes for different data', () => {
      const hash1 = computeRequestHash({ a: 1 });
      const hash2 = computeRequestHash({ a: 2 });

      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash regardless of key order', () => {
      const hash1 = computeRequestHash({ a: 1, b: 2 });
      const hash2 = computeRequestHash({ b: 2, a: 1 });

      expect(hash1).toBe(hash2);
    });

    it('should handle null and undefined', () => {
      expect(() => computeRequestHash(null)).not.toThrow();
      expect(() => computeRequestHash(undefined)).not.toThrow();
    });
  });

  describe('computeHttpRequestHash', () => {
    it('should include method and path', () => {
      const hash1 = computeHttpRequestHash('POST', '/api/users');
      const hash2 = computeHttpRequestHash('GET', '/api/users');

      expect(hash1).not.toBe(hash2);
    });

    it('should include body when present', () => {
      const hash1 = computeHttpRequestHash('POST', '/api', { data: 1 });
      const hash2 = computeHttpRequestHash('POST', '/api', { data: 2 });

      expect(hash1).not.toBe(hash2);
    });

    it('should include fingerprint headers', () => {
      const headers = {
        'x-client-id': 'client-123',
        'x-request-id': 'req-456',
        'content-type': 'application/json',
      };

      const hash1 = computeHttpRequestHash('POST', '/api', {}, headers, ['x-client-id']);
      const hash2 = computeHttpRequestHash('POST', '/api', {}, { ...headers, 'x-client-id': 'different' }, ['x-client-id']);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('canonicalize', () => {
    it('should sort object keys', () => {
      const result = canonicalize({ z: 1, a: 2, m: 3 });
      expect(result).toBe('{"a":2,"m":3,"z":1}');
    });

    it('should handle nested objects', () => {
      const result = canonicalize({ outer: { z: 1, a: 2 } });
      expect(result).toBe('{"outer":{"a":2,"z":1}}');
    });

    it('should handle arrays', () => {
      const result = canonicalize([3, 1, 2]);
      expect(result).toBe('[3,1,2]'); // Arrays maintain order
    });

    it('should convert dates to ISO strings', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const result = canonicalize({ date });
      expect(result).toContain('2024-01-15T12:00:00.000Z');
    });
  });
});

describe('Lock Tokens', () => {
  describe('generateLockToken', () => {
    it('should generate unique tokens', () => {
      const token1 = generateLockToken();
      const token2 = generateLockToken();

      expect(token1).not.toBe(token2);
    });

    it('should start with lock_ prefix', () => {
      const token = generateLockToken();
      expect(token.startsWith('lock_')).toBe(true);
    });
  });

  describe('isValidLockToken', () => {
    it('should validate generated tokens', () => {
      const token = generateLockToken();
      expect(isValidLockToken(token)).toBe(true);
    });

    it('should reject invalid tokens', () => {
      expect(isValidLockToken('invalid')).toBe(false);
      expect(isValidLockToken('lock_short')).toBe(false);
      expect(isValidLockToken('notlock_12345678901234567890123456789012')).toBe(false);
    });
  });
});

describe('TTL Utilities', () => {
  describe('calculateExpiration', () => {
    it('should calculate future expiration', () => {
      const now = new Date();
      const expiration = calculateExpiration(60000, now);

      expect(expiration.getTime()).toBe(now.getTime() + 60000);
    });
  });

  describe('isExpired', () => {
    it('should return true for past dates', () => {
      const past = new Date(Date.now() - 1000);
      expect(isExpired(past)).toBe(true);
    });

    it('should return false for future dates', () => {
      const future = new Date(Date.now() + 60000);
      expect(isExpired(future)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isExpired(undefined)).toBe(false);
    });
  });

  describe('remainingTtl', () => {
    it('should return positive value for future expiration', () => {
      const future = new Date(Date.now() + 30000);
      const remaining = remainingTtl(future);

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(30000);
    });

    it('should return 0 for past expiration', () => {
      const past = new Date(Date.now() - 1000);
      expect(remainingTtl(past)).toBe(0);
    });
  });
});

describe('Serialization', () => {
  describe('serializeResponse', () => {
    it('should serialize response with metadata', () => {
      const serialized = serializeResponse(
        { result: 'success' },
        201,
        'application/json'
      );

      const parsed = JSON.parse(serialized);
      expect(parsed.statusCode).toBe(201);
      expect(parsed.contentType).toBe('application/json');
      expect(parsed.body).toBe('{"result":"success"}');
    });

    it('should handle string body', () => {
      const serialized = serializeResponse('plain text', 200, 'text/plain');
      const parsed = JSON.parse(serialized);
      expect(parsed.body).toBe('plain text');
    });
  });

  describe('deserializeResponse', () => {
    it('should deserialize stored response', () => {
      const serialized = JSON.stringify({
        body: '{"data": true}',
        statusCode: 200,
        contentType: 'application/json',
      });

      const result = deserializeResponse(serialized);

      expect(result.body).toBe('{"data": true}');
      expect(result.statusCode).toBe(200);
      expect(result.contentType).toBe('application/json');
    });

    it('should handle legacy format (plain body)', () => {
      const result = deserializeResponse('{"legacy": true}');

      expect(result.body).toBe('{"legacy": true}');
      expect(result.statusCode).toBe(200);
    });
  });
});

describe('Size Utilities', () => {
  describe('byteSize', () => {
    it('should calculate ASCII string size', () => {
      expect(byteSize('hello')).toBe(5);
    });

    it('should calculate UTF-8 string size', () => {
      expect(byteSize('🎉')).toBe(4); // Emoji is 4 bytes in UTF-8
    });
  });

  describe('validateResponseSize', () => {
    it('should accept small responses', () => {
      expect(() => validateResponseSize('small', 1000)).not.toThrow();
    });

    it('should reject responses exceeding limit', () => {
      const large = 'x'.repeat(2000);
      expect(() => validateResponseSize(large, 1000)).toThrow(IdempotencyException);
    });
  });
});

describe('Retry Utilities', () => {
  describe('calculateBackoff', () => {
    it('should increase delay exponentially', () => {
      const delay0 = calculateBackoff(0, 100, 10000, false);
      const delay1 = calculateBackoff(1, 100, 10000, false);
      const delay2 = calculateBackoff(2, 100, 10000, false);

      expect(delay0).toBe(100);
      expect(delay1).toBe(200);
      expect(delay2).toBe(400);
    });

    it('should cap at max delay', () => {
      const delay = calculateBackoff(10, 100, 1000, false);
      expect(delay).toBe(1000);
    });

    it('should add jitter when enabled', () => {
      const delays = new Set<number>();
      for (let i = 0; i < 10; i++) {
        delays.add(calculateBackoff(1, 100, 10000, true));
      }
      // With jitter, we should get some variation
      expect(delays.size).toBeGreaterThan(1);
    });
  });
});

describe('Key Generation', () => {
  describe('generateIdempotencyKey', () => {
    it('should join components with colon', () => {
      const key = generateIdempotencyKey('user', '123', 'action');
      expect(key).toBe('user:123:action');
    });

    it('should skip undefined components', () => {
      const key = generateIdempotencyKey('user', undefined, 'action');
      expect(key).toBe('user:action');
    });
  });

  describe('generateDeterministicKey', () => {
    it('should generate key from client and operation', () => {
      const key = generateDeterministicKey('client-1', 'create-order');
      expect(key).toContain('client-1');
      expect(key).toContain('create-order');
    });

    it('should include resource ID when provided', () => {
      const key = generateDeterministicKey('client-1', 'update', 'order-123');
      expect(key).toContain('order-123');
    });
  });
});

describe('Error Handling', () => {
  describe('wrapError', () => {
    it('should pass through IdempotencyException', () => {
      const original = new IdempotencyException(
        IdempotencyErrorCode.REQUEST_MISMATCH,
        'test error'
      );
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
    });

    it('should wrap regular errors', () => {
      const original = new Error('Something failed');
      const wrapped = wrapError(original);

      expect(wrapped).toBeInstanceOf(IdempotencyException);
      expect(wrapped.code).toBe(IdempotencyErrorCode.STORAGE_ERROR);
      expect(wrapped.message).toBe('Something failed');
    });

    it('should handle non-error values', () => {
      const wrapped = wrapError('string error');
      expect(wrapped.message).toBe('string error');
    });
  });

  describe('isRetriableError', () => {
    it('should return true for retriable exceptions', () => {
      const error = new IdempotencyException(
        IdempotencyErrorCode.STORAGE_ERROR,
        'timeout',
        true
      );
      expect(isRetriableError(error)).toBe(true);
    });

    it('should return false for non-retriable exceptions', () => {
      const error = new IdempotencyException(
        IdempotencyErrorCode.REQUEST_MISMATCH,
        'mismatch',
        false
      );
      expect(isRetriableError(error)).toBe(false);
    });

    it('should detect network errors', () => {
      const error = new Error('ECONNREFUSED');
      expect(isRetriableError(error)).toBe(true);
    });

    it('should detect timeout errors', () => {
      const error = new Error('request timeout');
      expect(isRetriableError(error)).toBe(true);
    });
  });
});
