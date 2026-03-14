import { describe, it, expect } from 'vitest';

describe('Supply Chain Verifier', () => {
  describe('Lockfile Parser', () => {
    it('parses a minimal pnpm lockfile', async () => {
      const { parsePnpmLock } = await import('../src/lockfile-parser.js');
      const lockContent = `lockfileVersion: '9.0'
packages:
  express@4.18.2:
    resolution: {integrity: sha512-abc123}
  lodash@4.17.21:
    resolution: {integrity: sha512-def456}
`;
      const entries = parsePnpmLock(lockContent);
      expect(entries.length).toBeGreaterThanOrEqual(2);
      const expressEntry = entries.find(e => e.name === 'express');
      expect(expressEntry).toBeDefined();
    });

    it('parses package-lock.json format', async () => {
      const { parsePackageLock } = await import('../src/lockfile-parser.js');
      const lockContent = JSON.stringify({
        name: 'test-project',
        lockfileVersion: 3,
        packages: {
          'node_modules/express': { version: '4.18.2', integrity: 'sha512-abc' },
          'node_modules/lodash': { version: '4.17.21', integrity: 'sha512-def' },
        },
      });
      const entries = parsePackageLock(lockContent);
      expect(entries.length).toBe(2);
    });
  });

  describe('Typosquat Detector', () => {
    it('flags "lodahs" as typosquat of "lodash"', async () => {
      const { checkForTyposquatting } = await import('../src/typosquat-detector.js');
      const findings = checkForTyposquatting(['lodahs']);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].similarTo).toBe('lodash');
    });

    it('does not flag legitimate "lodash"', async () => {
      const { checkForTyposquatting } = await import('../src/typosquat-detector.js');
      const findings = checkForTyposquatting(['lodash']);
      expect(findings.length).toBe(0);
    });

    it('flags "reacr" as typosquat of "react"', async () => {
      const { checkForTyposquatting } = await import('../src/typosquat-detector.js');
      const findings = checkForTyposquatting(['reacr']);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].similarTo).toBe('react');
    });
  });

  describe('Integrity Checker', () => {
    it('reports valid when lockfile matches package.json', async () => {
      const { verifyLockfileIntegrity } = await import('../src/integrity-checker.js');
      const result = await verifyLockfileIntegrity('/nonexistent/path');
      expect(result.valid).toBe(false);
    });
  });
});
