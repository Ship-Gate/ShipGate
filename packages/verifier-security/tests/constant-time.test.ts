import { describe, it, expect } from 'vitest';
import {
  SECURITY_RULES,
  APPROVED_CONSTANT_TIME_HELPERS,
  runSecurityRules,
} from '../src/static-rules.js';

// Get the constant-time comparison rule
const constantTimeRule = SECURITY_RULES.find(r => r.id === 'security/constant-time-compare');
const earlyReturnRule = SECURITY_RULES.find(r => r.id === 'security/no-early-return-on-hash-mismatch');

describe('security/constant-time-compare rule', () => {
  if (!constantTimeRule) {
    throw new Error('Constant time rule not found');
  }

  describe('FAIL cases - should detect violations', () => {
    it('detects direct === comparison of password hashes', () => {
      const code = `
        async function verifyPassword(inputPassword: string, storedHash: string) {
          const inputHash = await hash(inputPassword);
          if (inputHash === storedHash) {
            return true;
          }
          return false;
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleId).toBe('security/constant-time-compare');
      expect(violations[0].severity).toBe('critical');
      expect(violations[0].message).toContain('TIMING ATTACK');
    });

    it('detects !== comparison of password variables', () => {
      const code = `
        function checkPassword(password: string, expected: string) {
          if (password !== expected) {
            throw new Error('Invalid password');
          }
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/check.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].message).toContain('TIMING ATTACK');
    });

    it('detects == comparison of hash values', () => {
      const code = `
        async function verifyHash(providedHash: string, storedHash: string) {
          // Using loose equality is even worse
          return providedHash == storedHash;
        }
      `;

      const violations = constantTimeRule.check(code, 'utils/hash.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].severity).toBe('critical');
    });

    it('detects Buffer.equals for password hash comparison', () => {
      const code = `
        function compareHashes(inputHash: Buffer, storedHash: Buffer) {
          // Buffer.equals is NOT constant-time!
          return inputHash.equals(storedHash);
        }
      `;

      const violations = constantTimeRule.check(code, 'crypto/compare.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].message).toContain('Buffer.equals()');
      expect(violations[0].message).toContain('NOT constant-time');
    });

    it('detects String.startsWith for password comparison', () => {
      const code = `
        function checkPasswordPrefix(password: string, prefix: string) {
          return password.startsWith(prefix);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/prefix.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].message).toContain('startsWith');
      expect(violations[0].message).toContain('timing information');
    });

    it('detects String.includes for secret comparison', () => {
      const code = `
        function validateApiKey(apiKey: string, validKeys: string) {
          return validKeys.includes(apiKey);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/apikey.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].message).toContain('includes');
    });

    it('detects comparison in context with hash operations', () => {
      const code = `
        import crypto from 'crypto';

        function verifyToken(token: string, expected: string) {
          const hash = crypto.createHash('sha256').update(token).digest('hex');
          // This comparison is vulnerable
          return hash === expected;
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/token.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].severity).toBe('critical');
    });

    it('detects comparison of HMAC signatures', () => {
      const code = `
        function verifySignature(signature: string, expectedSignature: string) {
          // HMAC signature comparison must be constant-time
          if (signature === expectedSignature) {
            return true;
          }
          return false;
        }
      `;

      const violations = constantTimeRule.check(code, 'webhook/verify.ts');

      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('PASS cases - should NOT detect violations', () => {
    it('allows crypto.timingSafeEqual', () => {
      const code = `
        import { timingSafeEqual } from 'crypto';

        function verifyPassword(inputHash: Buffer, storedHash: Buffer) {
          if (inputHash.length !== storedHash.length) {
            return false;
          }
          return timingSafeEqual(inputHash, storedHash);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBe(0);
    });

    it('allows bcrypt.compare', () => {
      const code = `
        import bcrypt from 'bcrypt';

        async function verifyPassword(password: string, hash: string) {
          return await bcrypt.compare(password, hash);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBe(0);
    });

    it('allows bcrypt.compareSync', () => {
      const code = `
        import bcrypt from 'bcrypt';

        function verifyPasswordSync(password: string, storedHash: string) {
          return bcrypt.compareSync(password, storedHash);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBe(0);
    });

    it('allows argon2.verify', () => {
      const code = `
        import argon2 from 'argon2';

        async function verifyPassword(password: string, hash: string) {
          return await argon2.verify(hash, password);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBe(0);
    });

    it('allows custom safeCompare helper', () => {
      const code = `
        import { safeCompare } from './crypto-utils';

        function verifyHash(inputHash: string, storedHash: string) {
          return safeCompare(inputHash, storedHash);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBe(0);
    });

    it('allows constantTimeCompare helper', () => {
      const code = `
        import { constantTimeCompare } from '@company/crypto';

        function verifyToken(token: string, expected: string) {
          return constantTimeCompare(token, expected);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBe(0);
    });

    it('skips test files', () => {
      const code = `
        function verifyPassword(password: string, expected: string) {
          // This would normally be flagged, but test files are skipped
          return password === expected;
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.test.ts');

      expect(violations.length).toBe(0);
    });

    it('skips mock files', () => {
      const code = `
        function mockVerifyPassword(password: string, expected: string) {
          return password === expected;
        }
      `;

      const violations = constantTimeRule.check(code, '__mocks__/auth.ts');

      expect(violations.length).toBe(0);
    });

    it('allows non-password equality comparisons', () => {
      const code = `
        function compareUsernames(username1: string, username2: string) {
          return username1 === username2;
        }

        function checkStatus(status: string) {
          return status === 'active';
        }
      `;

      const violations = constantTimeRule.check(code, 'users/compare.ts');

      expect(violations.length).toBe(0);
    });

    it('allows comparison of non-secret numeric values', () => {
      const code = `
        function compareIds(id1: number, id2: number) {
          return id1 === id2;
        }
      `;

      const violations = constantTimeRule.check(code, 'utils/compare.ts');

      expect(violations.length).toBe(0);
    });
  });

  describe('custom configuration', () => {
    it('respects custom approved helpers', () => {
      const code = `
        import { myCustomCompare } from './my-crypto';

        function verifyPassword(password: string, hash: string) {
          return myCustomCompare(password, hash);
        }
      `;

      const violations = constantTimeRule.check(code, 'auth/verify.ts', {
        approvedHelpers: ['myCustomCompare'],
      });

      // Note: The current implementation may not fully support custom helpers
      // Check if the config option works or document limitation
      expect(violations.length).toBe(0);
    });

    it('respects custom skip patterns', () => {
      const code = `
        function verifyPassword(password: string, expected: string) {
          return password === expected;
        }
      `;

      const violations = constantTimeRule.check(code, 'fixtures/auth.ts', {
        skipPatterns: ['fixtures/'],
      });

      expect(violations.length).toBe(0);
    });
  });
});

describe('security/no-early-return-on-hash-mismatch rule', () => {
  if (!earlyReturnRule) {
    throw new Error('Early return rule not found');
  }

  describe('FAIL cases', () => {
    it('detects early return on hash mismatch', () => {
      const code = `
        function verifyHash(inputHash: string, storedHash: string) {
          if (inputHash !== storedHash) return false;
          return true;
        }
      `;

      const violations = earlyReturnRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].message).toContain('TIMING ORACLE');
    });

    it('detects early throw on hash mismatch', () => {
      const code = `
        function checkHash(userHash: string, expected: string) {
          if (userHash !== expected) throw new Error('Invalid');
          return true;
        }
      `;

      const violations = earlyReturnRule.check(code, 'auth/check.ts');

      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('PASS cases', () => {
    it('allows proper constant-time comparison', () => {
      const code = `
        import { timingSafeEqual } from 'crypto';

        function verifyHash(inputHash: Buffer, storedHash: Buffer) {
          const isValid = timingSafeEqual(inputHash, storedHash);
          // Single branch after comparison
          if (!isValid) {
            return false;
          }
          return true;
        }
      `;

      const violations = earlyReturnRule.check(code, 'auth/verify.ts');

      expect(violations.length).toBe(0);
    });
  });
});

describe('runSecurityRules function', () => {
  it('runs all rules on all files', () => {
    const codeMap = new Map([
      [
        'file1.ts',
        `
          function verify(password: string, hash: string) {
            return password === hash;
          }
        `,
      ],
      [
        'file2.ts',
        `
          function check(inputHash: string, storedHash: string) {
            if (inputHash !== storedHash) return false;
            return true;
          }
        `,
      ],
    ]);

    const violations = runSecurityRules(codeMap);

    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('APPROVED_CONSTANT_TIME_HELPERS', () => {
  it('includes crypto.timingSafeEqual', () => {
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('timingSafeEqual');
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('crypto.timingSafeEqual');
  });

  it('includes bcrypt helpers', () => {
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('bcrypt.compare');
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('bcrypt.compareSync');
  });

  it('includes argon2.verify', () => {
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('argon2.verify');
  });

  it('includes common safe compare helpers', () => {
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('safeCompare');
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('constantTimeCompare');
    expect(APPROVED_CONSTANT_TIME_HELPERS).toContain('secureCompare');
  });
});
