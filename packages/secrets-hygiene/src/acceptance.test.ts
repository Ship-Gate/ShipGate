/**
 * Acceptance Test: Secrets Hygiene
 * 
 * Verifies that secrets cannot leak into CLI output or proof bundles.
 * 
 * ACCEPTANCE CRITERIA:
 * - A spec/impl that prints secrets cannot leak them into proof bundle or console output.
 */

import { describe, it, expect } from 'vitest';
import { SecretsMasker, createMasker } from './masker.js';
import { safeJSONStringify } from './integration.js';
import { EnvFilter, createEnvFilter } from './env-filter.js';

describe('Acceptance Test: Secrets Hygiene', () => {
  describe('Masking Layer', () => {
    it('should mask API keys in output', () => {
      const masker = createMasker();
      const output = 'API_KEY=sk_live_1234567890abcdef';
      const masked = masker.mask(output);
      
      expect(masked).toContain('***');
      expect(masked).not.toContain('sk_live_1234567890abcdef');
    });

    it('should mask passwords in output', () => {
      const masker = createMasker();
      const output = 'password=mySecretPassword123';
      const masked = masker.mask(output);
      
      expect(masked).toContain('***');
      expect(masked).not.toContain('mySecretPassword123');
    });

    it('should mask JWT tokens in output', () => {
      const masker = createMasker();
      const output = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjg';
      const masked = masker.mask(output);
      
      expect(masked).toContain('***');
      expect(masked).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should mask Stripe keys', () => {
      const masker = createMasker();
      const output = 'sk_live_1234567890abcdef1234567890abcdef';
      const masked = masker.mask(output);
      
      expect(masked).toContain('***');
      expect(masked).not.toContain('sk_live_');
    });

    it('should mask GitHub tokens', () => {
      const masker = createMasker();
      const output = 'ghp_1234567890abcdef1234567890abcdef12345678';
      const masked = masker.mask(output);
      
      expect(masked).toContain('***');
      expect(masked).not.toContain('ghp_');
    });
  });

  describe('Environment Variable Allowlist', () => {
    it('should allow only whitelisted env vars', () => {
      const filter = createEnvFilter({
        allowedEnvVars: ['PATH', 'HOME'],
      });
      
      const env = {
        PATH: '/usr/bin',
        HOME: '/home/user',
        SECRET_KEY: 'secret123',
        API_KEY: 'key123',
      };
      
      const filtered = filter.filter(env);
      expect(filtered.PATH).toBe('/usr/bin');
      expect(filtered.HOME).toBe('/home/user');
      expect(filtered.SECRET_KEY).toBeUndefined();
      expect(filtered.API_KEY).toBeUndefined();
    });

    it('should mask disallowed env vars when maskDisallowed is true', () => {
      const filter = createEnvFilter({
        allowedEnvVars: ['PATH'],
        maskDisallowed: true,
      });
      
      const env = {
        PATH: '/usr/bin',
        SECRET_KEY: 'secret123',
      };
      
      const filtered = filter.filter(env);
      expect(filtered.PATH).toBe('/usr/bin');
      expect(filtered.SECRET_KEY).toBe('***');
    });
  });

  describe('CLI Output Masking', () => {
    it('should mask secrets in JSON output', () => {
      const data = {
        user: 'alice',
        password: 'secret123',
        apiKey: 'sk_live_1234567890',
        token: 'bearer_token_here',
      };
      
      const json = safeJSONStringify(data, undefined, 2);
      
      expect(json).toContain('***');
      expect(json).not.toContain('secret123');
      expect(json).not.toContain('sk_live_1234567890');
      expect(json).not.toContain('bearer_token_here');
      expect(json).toContain('alice'); // Non-secret data should remain
    });

    it('should mask secrets in deep object structures', () => {
      const masker = createMasker();
      const obj = {
        user: 'alice',
        credentials: {
          password: 'secret123',
          apiKey: 'sk_live_1234567890',
        },
        nested: {
          deep: {
            token: 'bearer_token_here',
          },
        },
      };
      
      const masked = masker.maskObject(obj);
      
      expect(masked).toEqual({
        user: 'alice',
        credentials: {
          password: '***',
          apiKey: '***',
        },
        nested: {
          deep: {
            token: '***',
          },
        },
      });
    });
  });

  describe('Proof Bundle Masking', () => {
    it('should mask secrets in proof bundle JSON', () => {
      const proofData = {
        bundleId: 'abc123',
        gateResult: {
          verdict: 'SHIP',
          score: 95,
          violations: [],
        },
        testResult: {
          framework: 'jest',
          results: [
            {
              name: 'test1',
              output: 'API_KEY=sk_live_1234567890',
            },
          ],
        },
      };
      
      const json = safeJSONStringify(proofData, undefined, 2);
      
      expect(json).toContain('***');
      expect(json).not.toContain('sk_live_1234567890');
      expect(json).toContain('test1'); // Non-secret data should remain
    });
  });

  describe('Verifier Output Masking', () => {
    it('should mask secrets in verifier results', () => {
      const verifierResult = {
        verdict: 'PROVEN',
        score: 100,
        evidence: [
          {
            clauseId: 'clause1',
            status: 'proven',
            trace: {
              events: [
                {
                  type: 'log',
                  message: 'API_KEY=sk_live_1234567890',
                },
              ],
            },
          },
        ],
      };
      
      const json = safeJSONStringify(verifierResult, undefined, 2);
      
      expect(json).toContain('***');
      expect(json).not.toContain('sk_live_1234567890');
    });
  });

  describe('Common Secret Patterns', () => {
    const testCases = [
      { name: 'API keys', value: 'sk_live_1234567890abcdef' },
      { name: 'Passwords', value: 'mySecretPassword123' },
      { name: 'JWT tokens', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjg' },
      { name: 'GitHub tokens', value: 'ghp_1234567890abcdef1234567890abcdef12345678' },
      { name: 'GitLab tokens', value: 'glpat-1234567890abcdef1234567890abcdef' },
      { name: 'AWS keys', value: 'AKIAIOSFODNN7EXAMPLE' },
    ];

    testCases.forEach(({ name, value }) => {
      it(`should mask ${name}`, () => {
        const masker = createMasker();
        const output = `${name}=${value}`;
        const masked = masker.mask(output);
        
        expect(masked).toContain('***');
        expect(masked).not.toContain(value);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const masker = createMasker();
      expect(masker.mask('')).toBe('');
    });

    it('should handle text with no secrets', () => {
      const masker = createMasker();
      const text = 'This is just normal text with no secrets';
      const masked = masker.mask(text);
      expect(masked).toBe(text);
    });

    it('should handle null and undefined in objects', () => {
      const masker = createMasker();
      const obj = {
        password: 'secret123',
        nullValue: null,
        undefinedValue: undefined,
      };
      const masked = masker.maskObject(obj);
      expect(masked).toEqual({
        password: '***',
        nullValue: null,
        undefinedValue: undefined,
      });
    });

    it('should handle arrays', () => {
      const masker = createMasker();
      const arr = [
        { password: 'secret1' },
        { password: 'secret2' },
      ];
      const masked = masker.maskObject(arr);
      expect(masked).toEqual([
        { password: '***' },
        { password: '***' },
      ]);
    });
  });
});
