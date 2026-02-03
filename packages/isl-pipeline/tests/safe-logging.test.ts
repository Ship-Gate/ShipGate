/**
 * Tests for Safe Logging Utilities
 * 
 * @module @isl-lang/pipeline/tests
 */

import { describe, it, expect } from 'vitest';
import {
  redact,
  redactString,
  redactObject,
  mask,
  maskEmail,
  maskIp,
  safeError,
  createSafeLogger,
} from '../src/safe-logging';

describe('Safe Logging Utilities', () => {
  // =========================================================================
  // redactString
  // =========================================================================
  
  describe('redactString', () => {
    it('should redact email addresses', () => {
      const input = 'Contact user@example.com for support';
      const result = redactString(input);
      expect(result).toBe('Contact [EMAIL_REDACTED] for support');
    });

    it('should redact multiple emails', () => {
      const input = 'From: a@b.com To: c@d.com';
      const result = redactString(input);
      expect(result).toBe('From: [EMAIL_REDACTED] To: [EMAIL_REDACTED]');
    });

    it('should redact SSN', () => {
      const input = 'SSN: 123-45-6789';
      const result = redactString(input);
      expect(result).toBe('SSN: [SSN_REDACTED]');
    });

    it('should redact phone numbers', () => {
      const input = 'Call 555-123-4567';
      const result = redactString(input);
      expect(result).toBe('Call [PHONE_REDACTED]');
    });

    it('should redact phone with country code', () => {
      const input = 'Call +1-555-123-4567';
      const result = redactString(input);
      expect(result).toBe('Call [PHONE_REDACTED]');
    });

    it('should redact credit card numbers', () => {
      const input = 'Card: 4111-1111-1111-1111';
      const result = redactString(input);
      expect(result).toBe('Card: [CARD_REDACTED]');
    });

    it('should redact IPv4 addresses', () => {
      const input = 'IP: 192.168.1.100';
      const result = redactString(input);
      expect(result).toBe('IP: [IP_REDACTED]');
    });

    it('should redact JWT tokens', () => {
      const input = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = redactString(input);
      expect(result).toBe('Token: [JWT_REDACTED]');
    });

    it('should redact Bearer tokens', () => {
      const input = 'Authorization: Bearer abc123xyz';
      const result = redactString(input);
      expect(result).toBe('Authorization: [BEARER_REDACTED]');
    });

    it('should redact Stripe-style API keys', () => {
      const input = 'Key: sk_test_1234567890abcdefghijk';
      const result = redactString(input);
      expect(result).toBe('Key: [API_KEY_REDACTED]');
    });

    it('should handle strings without PII', () => {
      const input = 'Hello, this is a normal message';
      const result = redactString(input);
      expect(result).toBe(input);
    });
  });

  // =========================================================================
  // redactObject
  // =========================================================================
  
  describe('redactObject', () => {
    it('should redact email field', () => {
      const obj = { name: 'John', email: 'john@example.com' };
      const result = redactObject(obj);
      expect(result.name).toBe('John');
      expect(result.email).toBe('[REDACTED]');
    });

    it('should redact password field', () => {
      const obj = { username: 'john', password: 'secret123' };
      const result = redactObject(obj);
      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should redact token field', () => {
      const obj = { userId: '123', accessToken: 'xyz789' };
      const result = redactObject(obj);
      expect(result.userId).toBe('123');
      expect(result.accessToken).toBe('[REDACTED]');
    });

    it('should redact nested PII fields', () => {
      const obj = {
        user: {
          id: '123',
          email: 'test@test.com',
          profile: {
            phone: '555-1234',
          },
        },
      };
      const result = redactObject(obj);
      expect((result.user as Record<string, unknown>).id).toBe('123');
      expect((result.user as Record<string, unknown>).email).toBe('[REDACTED]');
      expect(
        ((result.user as Record<string, unknown>).profile as Record<string, unknown>).phone
      ).toBe('[REDACTED]');
    });

    it('should redact PII values in non-PII field names', () => {
      const obj = { message: 'Contact user@example.com for help' };
      const result = redactObject(obj);
      expect(result.message).toBe('Contact [EMAIL_REDACTED] for help');
    });

    it('should handle arrays', () => {
      const obj = {
        emails: ['a@b.com', 'c@d.com'],
      };
      const result = redactObject(obj);
      expect(result.emails).toEqual(['[EMAIL_REDACTED]', '[EMAIL_REDACTED]']);
    });

    it('should use custom redact fields', () => {
      const obj = { customSecret: 'abc123', normal: 'value' };
      const result = redactObject(obj, ['customSecret']);
      expect(result.customSecret).toBe('[REDACTED]');
      expect(result.normal).toBe('value');
    });

    it('should redact credit card fields', () => {
      const obj = { cardNumber: '4111111111111111', cvv: '123' };
      const result = redactObject(obj);
      expect(result.cardNumber).toBe('[REDACTED]');
      expect(result.cvv).toBe('[REDACTED]');
    });

    it('should redact SSN field', () => {
      const obj = { ssn: '123-45-6789', name: 'John' };
      const result = redactObject(obj);
      expect(result.ssn).toBe('[REDACTED]');
      expect(result.name).toBe('John');
    });
  });

  // =========================================================================
  // redact (generic)
  // =========================================================================
  
  describe('redact', () => {
    it('should handle null', () => {
      expect(redact(null)).toBe(null);
    });

    it('should handle undefined', () => {
      expect(redact(undefined)).toBe(undefined);
    });

    it('should handle strings', () => {
      const result = redact('email: test@test.com');
      expect(result).toBe('email: [EMAIL_REDACTED]');
    });

    it('should handle objects', () => {
      const result = redact({ email: 'test@test.com' });
      expect((result as Record<string, unknown>).email).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const result = redact(['test@test.com', { password: 'secret' }]);
      expect((result as unknown[])[0]).toBe('[EMAIL_REDACTED]');
      expect(((result as unknown[])[1] as Record<string, unknown>).password).toBe('[REDACTED]');
    });

    it('should handle numbers', () => {
      expect(redact(42)).toBe(42);
    });

    it('should handle booleans', () => {
      expect(redact(true)).toBe(true);
    });
  });

  // =========================================================================
  // mask
  // =========================================================================
  
  describe('mask', () => {
    it('should mask middle of string', () => {
      expect(mask('1234567890')).toBe('12******90');
    });

    it('should handle short strings', () => {
      expect(mask('abc')).toBe('***');
    });

    it('should respect visibleChars parameter', () => {
      expect(mask('1234567890', 3)).toBe('123****890');
    });

    it('should handle empty string', () => {
      expect(mask('')).toBe('');
    });
  });

  // =========================================================================
  // maskEmail
  // =========================================================================
  
  describe('maskEmail', () => {
    it('should mask email preserving structure', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j******e@e*****e.com');
    });

    it('should handle short local part', () => {
      expect(maskEmail('ab@test.com')).toBe('**@t**t.com');
    });

    it('should preserve TLD', () => {
      const result = maskEmail('user@domain.co.uk');
      expect(result).toContain('.uk');
    });

    it('should handle invalid email', () => {
      const result = maskEmail('notanemail');
      expect(result).toContain('*');
    });
  });

  // =========================================================================
  // maskIp
  // =========================================================================
  
  describe('maskIp', () => {
    it('should mask IPv4 middle octets', () => {
      expect(maskIp('192.168.1.100')).toBe('192.***.***. 100');
    });

    it('should preserve first and last octets', () => {
      const result = maskIp('10.0.0.1');
      expect(result).toMatch(/^10\..*\.1$/);
    });

    it('should handle non-IP strings', () => {
      const result = maskIp('not-an-ip');
      expect(result).toContain('*');
    });
  });

  // =========================================================================
  // safeError
  // =========================================================================
  
  describe('safeError', () => {
    it('should extract error name', () => {
      const error = new TypeError('test error');
      const result = safeError(error);
      expect(result.name).toBe('TypeError');
    });

    it('should redact PII in error message', () => {
      const error = new Error('Failed for user@example.com');
      const result = safeError(error);
      expect(result.message).toBe('Failed for [EMAIL_REDACTED]');
    });

    it('should redact PII in stack trace', () => {
      const error = new Error('Error with IP 192.168.1.1');
      const result = safeError(error);
      expect(result.stack).not.toContain('192.168.1.1');
    });

    it('should handle non-Error values', () => {
      const result = safeError('string error');
      expect(result.name).toBe('UnknownError');
      expect(result.message).toBe('string error');
    });

    it('should handle error with code', () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      const result = safeError(error);
      expect(result.code).toBe('ENOENT');
    });
  });

  // =========================================================================
  // createSafeLogger
  // =========================================================================
  
  describe('createSafeLogger', () => {
    it('should create logger with all methods', () => {
      const logger = createSafeLogger();
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should accept custom config', () => {
      const logger = createSafeLogger({
        service: 'test-service',
        redactFields: ['customField'],
      });
      expect(logger).toBeDefined();
    });

    // Note: Testing actual output would require mocking process.stdout
    // These tests verify the logger is created correctly
  });
});
