// ============================================================================
// ISL Standard Library - IDs Test Suite
// ============================================================================

import { describe, test, expect } from 'vitest';
import {
  // Validation
  isValidUUID,
  isValidUUIDv7,
  isValidUUIDAny,
  isValidCompactUUID,
  isValidULID,
  isValidKSUID,
  isValidNanoID,
  isValidShortId,
  isValidHumanCode,
  isValidObjectId,
  isValidSnowflakeId,
  isValidEAN13,
  isValidUPCA,
  isValidISBN13,
  isValidISBN10,
  isValidDOI,
  isValidORCID,
  isValidStripeCustomerId,
  isValidStripePaymentIntentId,
  isValidStripeSubscriptionId,
  isValidARN,
  isValidGitHubRepo,
  isValidK8sName,
  isValidAPIKey,
  
  // Generation
  generateUUID,
  generateULID,
  generateShortId,
  generateHumanCode,
  
  // UUID utilities
  uuidToCompact,
  compactToUUID,
  uuidToBytes,
  bytesToUUID,
  
  // ULID utilities
  ulidToTimestamp,
  ulidToDate,
  
  // Snowflake utilities
  snowflakeToTimestamp,
  snowflakeToDate,
  
  // Types
  ID_PATTERNS,
} from '../implementations/typescript/ids';

// ============================================================================
// UUID VALIDATION
// ============================================================================

describe('UUID Validation', () => {
  test('isValidUUID accepts valid UUID v4', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    expect(isValidUUID('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true);
  });

  test('isValidUUID rejects non-v4 UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-11d4-a716-446655440000')).toBe(false); // v1
    expect(isValidUUID('550e8400-e29b-31d4-a716-446655440000')).toBe(false); // v3
    expect(isValidUUID('550e8400-e29b-51d4-a716-446655440000')).toBe(false); // v5
  });

  test('isValidUUIDv7 accepts valid UUID v7', () => {
    expect(isValidUUIDv7('018e5e3c-7a98-7000-8000-000000000000')).toBe(true);
  });

  test('isValidUUIDAny accepts any valid UUID', () => {
    expect(isValidUUIDAny('550e8400-e29b-11d4-a716-446655440000')).toBe(true);
    expect(isValidUUIDAny('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  test('isValidCompactUUID accepts UUIDs without dashes', () => {
    expect(isValidCompactUUID('550e8400e29b41d4a716446655440000')).toBe(true);
    expect(isValidCompactUUID('F47AC10B58CC4372A5670E02B2C3D479')).toBe(true);
  });

  test('isValidCompactUUID rejects invalid formats', () => {
    expect(isValidCompactUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    expect(isValidCompactUUID('550e8400e29b41d4a716446655440')).toBe(false); // Too short
  });
});

// ============================================================================
// ULID VALIDATION
// ============================================================================

describe('ULID Validation', () => {
  test('isValidULID accepts valid ULIDs', () => {
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(true);
    expect(isValidULID('01BX5ZZKBKACTAV9WEVGEMMVRZ')).toBe(true);
    expect(isValidULID('01arZ3NDeKtSV4RRFFq69g5FAV')).toBe(true); // Mixed case
  });

  test('isValidULID rejects invalid ULIDs', () => {
    expect(isValidULID('')).toBe(false);
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FA')).toBe(false); // Too short
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAVV')).toBe(false); // Too long
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAI')).toBe(false); // Invalid char I
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAL')).toBe(false); // Invalid char L
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAO')).toBe(false); // Invalid char O
    expect(isValidULID('01ARZ3NDEKTSV4RRFFQ69G5FAU')).toBe(false); // Invalid char U
  });
});

// ============================================================================
// OTHER ID FORMATS
// ============================================================================

describe('Other ID Format Validation', () => {
  test('isValidKSUID accepts valid KSUIDs', () => {
    expect(isValidKSUID('0ujsswThIGTUYm2K8FjOOfXtY1K')).toBe(true);
  });

  test('isValidNanoID accepts valid NanoIDs', () => {
    expect(isValidNanoID('V1StGXR8_Z5jdHi6B-myT')).toBe(true);
  });

  test('isValidShortId accepts valid short IDs', () => {
    expect(isValidShortId('xY7_abc2XX')).toBe(true);
    expect(isValidShortId('abcd1234')).toBe(true);
  });

  test('isValidHumanCode accepts valid human codes', () => {
    expect(isValidHumanCode('ABC123')).toBe(true);
    expect(isValidHumanCode('XYZ789')).toBe(true);
  });

  test('isValidHumanCode rejects codes with ambiguous characters', () => {
    expect(isValidHumanCode('ABC1O0')).toBe(false); // O and 0 are ambiguous
    expect(isValidHumanCode('ABCIL1')).toBe(false); // I, L, 1 are ambiguous
  });

  test('isValidObjectId accepts valid MongoDB ObjectIds', () => {
    expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    expect(isValidObjectId('507F1F77BCF86CD799439011')).toBe(true);
  });

  test('isValidSnowflakeId accepts valid Snowflake IDs', () => {
    expect(isValidSnowflakeId('175928847299117063')).toBe(true);
    expect(isValidSnowflakeId('1234567890123456789')).toBe(true);
  });
});

// ============================================================================
// BARCODE VALIDATION
// ============================================================================

describe('Barcode Validation', () => {
  test('isValidEAN13 accepts valid EAN-13', () => {
    expect(isValidEAN13('4006381333931')).toBe(true);
    expect(isValidEAN13('5901234123457')).toBe(true);
  });

  test('isValidEAN13 rejects invalid EAN-13', () => {
    expect(isValidEAN13('4006381333932')).toBe(false); // Bad checksum
    expect(isValidEAN13('123456789012')).toBe(false); // Too short
  });

  test('isValidUPCA accepts valid UPC-A', () => {
    expect(isValidUPCA('012345678905')).toBe(true);
    expect(isValidUPCA('036000291452')).toBe(true);
  });

  test('isValidISBN13 accepts valid ISBN-13', () => {
    expect(isValidISBN13('9780306406157')).toBe(true);
  });

  test('isValidISBN10 accepts valid ISBN-10', () => {
    expect(isValidISBN10('0306406152')).toBe(true);
    expect(isValidISBN10('155860832X')).toBe(true); // X checksum
  });

  test('isValidISBN10 rejects invalid ISBN-10', () => {
    expect(isValidISBN10('0306406153')).toBe(false); // Bad checksum
  });
});

// ============================================================================
// RESEARCH IDs
// ============================================================================

describe('Research ID Validation', () => {
  test('isValidDOI accepts valid DOIs', () => {
    expect(isValidDOI('10.1000/xyz123')).toBe(true);
    expect(isValidDOI('10.1038/nphys1170')).toBe(true);
    expect(isValidDOI('10.1002/0470841559.ch1')).toBe(true);
  });

  test('isValidORCID accepts valid ORCIDs', () => {
    expect(isValidORCID('0000-0002-1825-0097')).toBe(true);
  });

  test('isValidORCID rejects invalid ORCIDs', () => {
    expect(isValidORCID('0000-0002-1825-0098')).toBe(false); // Bad checksum
  });
});

// ============================================================================
// SERVICE IDs
// ============================================================================

describe('Service ID Validation', () => {
  test('isValidStripeCustomerId accepts valid IDs', () => {
    expect(isValidStripeCustomerId('cus_NffrFeUfNV2Hib')).toBe(true);
  });

  test('isValidStripePaymentIntentId accepts valid IDs', () => {
    expect(isValidStripePaymentIntentId('pi_3N2S9aJNcmPzJOYp1cJfg2Lh')).toBe(true);
  });

  test('isValidStripeSubscriptionId accepts valid IDs', () => {
    expect(isValidStripeSubscriptionId('sub_1N2S9aJNcmPzJO')).toBe(true);
  });

  test('isValidARN accepts valid AWS ARNs', () => {
    expect(isValidARN('arn:aws:s3:::my-bucket')).toBe(true);
    expect(isValidARN('arn:aws:lambda:us-east-1:123456789012:function:my-function')).toBe(true);
  });

  test('isValidGitHubRepo accepts valid repo identifiers', () => {
    expect(isValidGitHubRepo('octocat/Hello-World')).toBe(true);
    expect(isValidGitHubRepo('my-org/my-repo')).toBe(true);
  });

  test('isValidK8sName accepts valid names', () => {
    expect(isValidK8sName('my-deployment')).toBe(true);
    expect(isValidK8sName('frontend-v2')).toBe(true);
    expect(isValidK8sName('a')).toBe(true);
  });

  test('isValidK8sName rejects invalid names', () => {
    expect(isValidK8sName('-invalid')).toBe(false);
    expect(isValidK8sName('Invalid')).toBe(false); // Uppercase
    expect(isValidK8sName('a'.repeat(64))).toBe(false); // Too long
  });

  test('isValidAPIKey accepts valid API keys', () => {
    expect(isValidAPIKey('sk_live_' + 'a'.repeat(32))).toBe(true);
    expect(isValidAPIKey('pk_test_' + 'a'.repeat(32))).toBe(true);
  });
});

// ============================================================================
// UUID GENERATION
// ============================================================================

describe('UUID Generation', () => {
  test('generateUUID generates valid UUID v4', () => {
    const uuid = generateUUID();
    expect(isValidUUID(uuid)).toBe(true);
  });

  test('generateUUID generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateUUID());
    }
    expect(ids.size).toBe(1000);
  });
});

// ============================================================================
// ULID GENERATION
// ============================================================================

describe('ULID Generation', () => {
  test('generateULID generates valid ULID', () => {
    const ulid = generateULID();
    expect(isValidULID(ulid)).toBe(true);
  });

  test('generateULID is monotonically increasing', () => {
    const ulids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ulids.push(generateULID());
    }
    for (let i = 1; i < ulids.length; i++) {
      expect(ulids[i] >= ulids[i - 1]).toBe(true);
    }
  });
});

// ============================================================================
// SHORT ID GENERATION
// ============================================================================

describe('Short ID Generation', () => {
  test('generateShortId generates valid short IDs', () => {
    const id = generateShortId();
    expect(isValidShortId(id)).toBe(true);
    expect(id.length).toBe(10);
  });

  test('generateShortId respects length parameter', () => {
    expect(generateShortId(8).length).toBe(8);
    expect(generateShortId(12).length).toBe(12);
  });

  test('generateShortId throws for invalid length', () => {
    expect(() => generateShortId(7)).toThrow();
    expect(() => generateShortId(13)).toThrow();
  });

  test('generateHumanCode generates valid codes', () => {
    const code = generateHumanCode();
    expect(isValidHumanCode(code)).toBe(true);
    expect(code.length).toBe(6);
  });
});

// ============================================================================
// UUID UTILITIES
// ============================================================================

describe('UUID Utilities', () => {
  test('uuidToCompact removes dashes', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000' as any;
    expect(uuidToCompact(uuid)).toBe('550e8400e29b41d4a716446655440000');
  });

  test('compactToUUID adds dashes', () => {
    const compact = '550e8400e29b41d4a716446655440000' as any;
    expect(compactToUUID(compact)).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  test('uuid to bytes and back', () => {
    const uuid = generateUUID();
    const bytes = uuidToBytes(uuid);
    expect(bytes.length).toBe(16);
    expect(bytesToUUID(bytes)).toBe(uuid.toLowerCase());
  });
});

// ============================================================================
// ULID UTILITIES
// ============================================================================

describe('ULID Utilities', () => {
  test('ulidToTimestamp extracts timestamp', () => {
    const ulid = generateULID();
    const ts = ulidToTimestamp(ulid);
    const now = Date.now();
    expect(Math.abs(ts - now)).toBeLessThan(1000);
  });

  test('ulidToDate extracts date', () => {
    const ulid = generateULID();
    const date = ulidToDate(ulid);
    const now = new Date();
    expect(Math.abs(date.getTime() - now.getTime())).toBeLessThan(1000);
  });
});

// ============================================================================
// SNOWFLAKE UTILITIES
// ============================================================================

describe('Snowflake Utilities', () => {
  test('snowflakeToTimestamp extracts timestamp', () => {
    // Discord epoch: 2015-01-01
    const snowflake = '175928847299117063' as any;
    const ts = snowflakeToTimestamp(snowflake);
    expect(ts).toBeGreaterThan(1420070400000); // After Discord epoch
  });

  test('snowflakeToDate extracts date', () => {
    const snowflake = '175928847299117063' as any;
    const date = snowflakeToDate(snowflake);
    expect(date.getFullYear()).toBeGreaterThanOrEqual(2015);
  });
});
