/**
 * @isl-lang/verified-build - Tests
 */

import { describe, it, expect } from 'vitest';
import { verifyBuild, quickVerify, checkFile } from '../src/index.js';

describe('@isl-lang/verified-build', () => {
  const projectRoot = process.cwd();

  describe('verifyBuild', () => {
    it('should return SHIP for clean code', async () => {
      const result = await verifyBuild({
        files: [
          {
            path: 'src/clean.ts',
            content: `
              export function add(a: number, b: number): number {
                return a + b;
              }
            `,
          },
        ],
        projectRoot,
        writeEvidence: false,
      });

      expect(result.verdict).toBe('SHIP');
      expect(result.score).toBeGreaterThanOrEqual(80); // Clean code should score high
      expect(result.summary).toContain('SHIP');
    });

    it('should return NO_SHIP for auth bypass pattern', async () => {
      const result = await verifyBuild({
        files: [
          {
            path: 'src/auth.ts',
            content: `
              const config = {
                auth: false,
                skipAuth: true,
              };
            `,
          },
        ],
        projectRoot,
        writeEvidence: false,
        policyPacks: ['auth'],
      });

      expect(result.verdict).toBe('NO_SHIP');
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.summary).toContain('NO_SHIP');
    });

    it('should detect PII in logs', async () => {
      const result = await verifyBuild({
        files: [
          {
            path: 'src/api/users.ts',
            content: `
              function getUser(id: string) {
                console.log('User email:', user.email);
                return user;
              }
            `,
          },
        ],
        projectRoot,
        writeEvidence: false,
        policyPacks: ['pii'],
      });

      expect(result.verdict).toBe('NO_SHIP');
      expect(result.violations.some(v => v.ruleId.includes('pii'))).toBe(true);
    });

    it('should have deterministic fingerprint', async () => {
      const content = 'const x = 1;';
      
      const result1 = await verifyBuild({
        files: [{ path: 'test.ts', content }],
        projectRoot,
        writeEvidence: false,
      });
      
      const result2 = await verifyBuild({
        files: [{ path: 'test.ts', content }],
        projectRoot,
        writeEvidence: false,
      });

      expect(result1.fingerprint).toBe(result2.fingerprint);
    });

    it('should include fix suggestions in reasons', async () => {
      const result = await verifyBuild({
        files: [
          {
            path: 'src/config.ts',
            content: `const api_key = "sk_live_abc123def456ghi789jkl012";`,
          },
        ],
        projectRoot,
        writeEvidence: false,
        policyPacks: ['auth'],
      });

      // Should have violations for hardcoded credentials
      expect(result.verdict).toBe('NO_SHIP');
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('quickVerify', () => {
    it('should return quick verdict', async () => {
      const result = await quickVerify({
        files: [{ path: 'test.ts', content: 'const x = 1;' }],
        projectRoot,
      });

      expect(result.verdict).toBe('SHIP');
      expect(result.score).toBe(100);
      expect(result.blockerCount).toBe(0);
    });

    it('should count blockers', async () => {
      const result = await quickVerify({
        files: [
          {
            path: 'src/login.ts',
            content: `
              // Auth bypass
              const auth = false;
              const skipAuth = true;
            `,
          },
        ],
        projectRoot,
        policyPacks: ['auth'],
      });

      expect(result.verdict).toBe('NO_SHIP');
      expect(result.blockerCount).toBeGreaterThan(0);
    });
  });

  describe('checkFile', () => {
    it('should check a single file', async () => {
      const result = await checkFile(
        'src/math.ts',
        `
          // Pure utility function - no security concerns
          export function add(a: number, b: number): number {
            return a + b;
          }
        `,
        projectRoot
      );

      // Should be allowed (no auth/pii/rate-limit issues)
      expect(result.allowed).toBe(true);
    });

    it('should detect violations in single file', async () => {
      const result = await checkFile(
        'src/auth/login.ts',
        `
          // No rate limiting on auth endpoint
          app.post('/login', async (req, res) => {
            console.log('Login attempt:', req.body.email);
          });
        `,
        projectRoot
      );

      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});
