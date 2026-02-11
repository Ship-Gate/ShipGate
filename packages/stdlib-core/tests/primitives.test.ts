// ============================================================================
// ISL Standard Library - Primitives Test Suite
// ============================================================================

import { describe, test, expect } from 'vitest';
import {
  // Validation
  isValidEmail,
  isValidPhone,
  isValidURL,
  isValidSecureURL,
  isValidUUID,
  isValidULID,
  isValidShortId,
  isValidSlug,
  isValidUsername,
  isValidJWT,
  isValidIPv4,
  isValidIPv6,
  isValidIPAddress,
  isValidHexColor,
  isValidSemVer,
  isValidCountryCode,
  isValidLanguageCode,
  isValidCreditCard,
  isValidSHA256,
  isValidBase64,
  isValidPercentage,
  luhnCheck,
  
  // Parsing
  parseEmail,
  parsePhone,
  parseURL,
  parseUUID,
  parseULID,
  parseMoney,
  
  // Money
  createMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  formatMoney,
  
  // Types
  CURRENCIES,
  PATTERNS,
} from '../implementations/typescript/primitives';

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

describe('Email Validation', () => {
  test('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user.name@example.com')).toBe(true);
    expect(isValidEmail('user+tag@example.com')).toBe(true);
    expect(isValidEmail('user@subdomain.example.com')).toBe(true);
    expect(isValidEmail('user123@example.co.uk')).toBe(true);
  });

  test('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@')).toBe(false);
    expect(isValidEmail('@missing.com')).toBe(false);
    expect(isValidEmail('spaces in@email.com')).toBe(false);
    expect(isValidEmail('double@@at.com')).toBe(false);
  });

  test('rejects emails exceeding max length', () => {
    const longLocal = 'a'.repeat(65);
    const longDomain = 'b'.repeat(64) + '.com';
    expect(isValidEmail(`${longLocal}@example.com`)).toBe(false);
    expect(isValidEmail(`user@${longDomain}`)).toBe(false);
  });
});

// ============================================================================
// PHONE VALIDATION
// ============================================================================

describe('Phone Validation (E.164)', () => {
  test('accepts valid E.164 phones', () => {
    expect(isValidPhone('+14155551234')).toBe(true);
    expect(isValidPhone('+442071234567')).toBe(true);
    expect(isValidPhone('+8613812345678')).toBe(true);
    expect(isValidPhone('+12025551234')).toBe(true);
  });

  test('rejects invalid phones', () => {
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('14155551234')).toBe(false); // Missing +
    expect(isValidPhone('+1')).toBe(false); // Too short
    expect(isValidPhone('+0123456789')).toBe(false); // Starts with 0
    expect(isValidPhone('+1234567890123456789')).toBe(false); // Too long
    expect(isValidPhone('+1 415 555 1234')).toBe(false); // Has spaces
  });
});

// ============================================================================
// URL VALIDATION
// ============================================================================

describe('URL Validation', () => {
  test('accepts valid URLs', () => {
    expect(isValidURL('https://example.com')).toBe(true);
    expect(isValidURL('http://example.com')).toBe(true);
    expect(isValidURL('https://www.example.com')).toBe(true);
    expect(isValidURL('https://example.com/path')).toBe(true);
    expect(isValidURL('https://example.com/path?query=1')).toBe(true);
    expect(isValidURL('https://sub.domain.example.com')).toBe(true);
  });

  test('rejects invalid URLs', () => {
    expect(isValidURL('')).toBe(false);
    expect(isValidURL('not-a-url')).toBe(false);
    expect(isValidURL('ftp://example.com')).toBe(false);
    expect(isValidURL('//example.com')).toBe(false);
  });

  test('accepts only HTTPS for SecureURL', () => {
    expect(isValidSecureURL('https://example.com')).toBe(true);
    expect(isValidSecureURL('http://example.com')).toBe(false);
  });
});

// ============================================================================
// UUID VALIDATION
// ============================================================================

describe('UUID Validation', () => {
  test('accepts valid UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('6ba7b810-9dad-41d2-80b4-00c04fd430c8')).toBe(true);
    expect(isValidUUID('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true); // Uppercase
  });

  test('rejects invalid UUIDs', () => {
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // v1
    expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false); // No dashes
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false); // Too short
  });
});

// ============================================================================
// ULID VALIDATION
// ============================================================================

describe('ULID Validation', () => {
  test('accepts valid ULIDs', () => {
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(true);
    expect(isValidULID('01BX5ZZKBKACTAV9WEVGEMMVRZ')).toBe(true);
  });

  test('rejects invalid ULIDs', () => {
    expect(isValidULID('')).toBe(false);
    expect(isValidULID('not-a-ulid')).toBe(false);
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FA')).toBe(false); // Too short
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAVV')).toBe(false); // Too long
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAI')).toBe(false); // Invalid char (I)
  });
});

// ============================================================================
// IP ADDRESS VALIDATION
// ============================================================================

describe('IP Address Validation', () => {
  test('accepts valid IPv4 addresses', () => {
    expect(isValidIPv4('192.168.1.1')).toBe(true);
    expect(isValidIPv4('10.0.0.1')).toBe(true);
    expect(isValidIPv4('255.255.255.255')).toBe(true);
    expect(isValidIPv4('0.0.0.0')).toBe(true);
  });

  test('rejects invalid IPv4 addresses', () => {
    expect(isValidIPv4('256.1.1.1')).toBe(false);
    expect(isValidIPv4('192.168.1')).toBe(false);
    expect(isValidIPv4('192.168.1.1.1')).toBe(false);
    expect(isValidIPv4('abc.def.ghi.jkl')).toBe(false);
  });

  test('accepts valid IPv6 addresses', () => {
    expect(isValidIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    expect(isValidIPv6('::1')).toBe(true);
  });

  test('isValidIPAddress accepts both IPv4 and IPv6', () => {
    expect(isValidIPAddress('192.168.1.1')).toBe(true);
    expect(isValidIPAddress('::1')).toBe(true);
    expect(isValidIPAddress('invalid')).toBe(false);
  });
});

// ============================================================================
// CREDIT CARD VALIDATION (LUHN)
// ============================================================================

describe('Credit Card Validation', () => {
  test('luhnCheck validates credit card numbers', () => {
    // Valid test numbers
    expect(luhnCheck('4111111111111111')).toBe(true); // Visa
    expect(luhnCheck('5500000000000004')).toBe(true); // Mastercard
    expect(luhnCheck('340000000000009')).toBe(true);  // Amex
    expect(luhnCheck('6011000000000004')).toBe(true); // Discover
  });

  test('luhnCheck rejects invalid numbers', () => {
    expect(luhnCheck('4111111111111112')).toBe(false); // Invalid checksum
    expect(luhnCheck('1234567890123456')).toBe(false);
    expect(luhnCheck('0000000000000000')).toBe(true);  // Valid Luhn but may not be real
  });

  test('isValidCreditCard validates format and checksum', () => {
    expect(isValidCreditCard('4111111111111111')).toBe(true);
    expect(isValidCreditCard('4111-1111-1111-1111')).toBe(false); // Has dashes
    expect(isValidCreditCard('340000000000009')).toBe(true); // 15 digits (Amex, valid Luhn)
  });
});

// ============================================================================
// MONEY OPERATIONS
// ============================================================================

describe('Money Operations', () => {
  test('createMoney rounds to 2 decimal places', () => {
    const money = createMoney(10.999, 'USD');
    expect(money.amount).toBe(11);
    
    const money2 = createMoney(10.994, 'USD');
    expect(money2.amount).toBe(10.99);
  });

  test('addMoney adds same currency', () => {
    const a = createMoney(10.50, 'USD');
    const b = createMoney(5.25, 'USD');
    const result = addMoney(a, b);
    expect(result.amount).toBe(15.75);
    expect(result.currency).toBe('USD');
  });

  test('addMoney throws on different currencies', () => {
    const usd = createMoney(10, 'USD');
    const eur = createMoney(10, 'EUR');
    expect(() => addMoney(usd, eur)).toThrow();
  });

  test('subtractMoney returns SignedMoney', () => {
    const a = createMoney(5, 'USD');
    const b = createMoney(10, 'USD');
    const result = subtractMoney(a, b);
    expect(result.amount).toBe(-5);
  });

  test('multiplyMoney multiplies by factor', () => {
    const money = createMoney(10, 'USD');
    const result = multiplyMoney(money, 1.5);
    expect(result.amount).toBe(15);
  });

  test('formatMoney formats for display', () => {
    const money = createMoney(1234.56, 'USD');
    const formatted = formatMoney(money);
    expect(formatted).toContain('1,234.56');
    expect(formatted).toContain('$');
  });
});

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

describe('Parsing Functions', () => {
  test('parseEmail returns Ok for valid email', () => {
    const result = parseEmail('user@example.com');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('user@example.com');
    }
  });

  test('parseEmail returns Err for invalid email', () => {
    const result = parseEmail('invalid');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });

  test('parsePhone returns Ok for valid phone', () => {
    const result = parsePhone('+14155551234');
    expect(result.ok).toBe(true);
  });

  test('parseUUID returns Ok for valid UUID', () => {
    const result = parseUUID('550e8400-e29b-41d4-a716-446655440000');
    expect(result.ok).toBe(true);
  });

  test('parseMoney returns Ok for valid money', () => {
    const result = parseMoney(10.50, 'USD');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.amount).toBe(10.50);
      expect(result.value.currency).toBe('USD');
    }
  });

  test('parseMoney returns Err for invalid currency', () => {
    const result = parseMoney(10, 'INVALID');
    expect(result.ok).toBe(false);
  });
});

// ============================================================================
// MISCELLANEOUS VALIDATIONS
// ============================================================================

describe('Miscellaneous Validations', () => {
  test('isValidSlug accepts valid slugs', () => {
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('post123')).toBe(true);
    expect(isValidSlug('my-awesome-post')).toBe(true);
  });

  test('isValidSlug rejects invalid slugs', () => {
    expect(isValidSlug('Hello-World')).toBe(false); // Uppercase
    expect(isValidSlug('hello_world')).toBe(false); // Underscore
    expect(isValidSlug('-hello')).toBe(false); // Starts with dash
  });

  test('isValidUsername accepts valid usernames', () => {
    expect(isValidUsername('john_doe')).toBe(true);
    expect(isValidUsername('user123')).toBe(true);
    expect(isValidUsername('JohnDoe')).toBe(true);
  });

  test('isValidUsername rejects invalid usernames', () => {
    expect(isValidUsername('ab')).toBe(false); // Too short
    expect(isValidUsername('123user')).toBe(false); // Starts with number
    expect(isValidUsername('a'.repeat(31))).toBe(false); // Too long
  });

  test('isValidHexColor accepts valid colors', () => {
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#FF0000')).toBe(true);
  });

  test('isValidSemVer accepts valid versions', () => {
    expect(isValidSemVer('1.0.0')).toBe(true);
    expect(isValidSemVer('1.2.3-alpha.1')).toBe(true);
    expect(isValidSemVer('1.2.3+build.123')).toBe(true);
    expect(isValidSemVer('1.2.3-beta+build')).toBe(true);
  });

  test('isValidCountryCode accepts valid codes', () => {
    expect(isValidCountryCode('US')).toBe(true);
    expect(isValidCountryCode('GB')).toBe(true);
    expect(isValidCountryCode('DE')).toBe(true);
  });

  test('isValidCountryCode rejects invalid codes', () => {
    expect(isValidCountryCode('USA')).toBe(false);
    expect(isValidCountryCode('us')).toBe(false); // Lowercase
    expect(isValidCountryCode('U')).toBe(false);
  });

  test('isValidPercentage validates 0-100 range', () => {
    expect(isValidPercentage(0)).toBe(true);
    expect(isValidPercentage(50)).toBe(true);
    expect(isValidPercentage(100)).toBe(true);
    expect(isValidPercentage(-1)).toBe(false);
    expect(isValidPercentage(101)).toBe(false);
  });

  test('isValidSHA256 accepts valid hashes', () => {
    expect(isValidSHA256('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe(true);
  });

  test('isValidBase64 accepts valid strings', () => {
    expect(isValidBase64('SGVsbG8gV29ybGQ=')).toBe(true);
    expect(isValidBase64('dGVzdA==')).toBe(true);
  });

  test('isValidJWT accepts valid tokens', () => {
    expect(isValidJWT('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')).toBe(true);
  });
});

// ============================================================================
// SHORT ID VALIDATION
// ============================================================================

describe('Short ID Validation', () => {
  test('isValidShortId accepts valid IDs', () => {
    expect(isValidShortId('xY7_abc2XX')).toBe(true);
    expect(isValidShortId('abcd1234')).toBe(true);
    expect(isValidShortId('ABCD_efgh-12')).toBe(true);
  });

  test('isValidShortId rejects invalid IDs', () => {
    expect(isValidShortId('short')).toBe(false); // Too short (< 8)
    expect(isValidShortId('tooLongShortId123')).toBe(false); // Too long (> 12)
    expect(isValidShortId('has spaces')).toBe(false);
    expect(isValidShortId('special!@#')).toBe(false);
  });
});
