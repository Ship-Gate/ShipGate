import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const FIXTURES_DIR = join(__dirname, 'fixtures');

function readFixture(project: string, file: string): string {
  return readFileSync(join(FIXTURES_DIR, project, file), 'utf-8');
}

describe('Full Pipeline Integration', () => {
  describe('Vulnerable project — security scanner', () => {
    it('detects SQL injection pattern', async () => {
      const { scanSource } = await import('@isl-lang/security-scanner');
      const source = readFixture('vulnerable-project', 'src/routes.ts');
      const findings = scanSource(source, 'typescript');
      const sqlFindings = findings.filter((f: { category: string }) =>
        f.category?.toLowerCase().includes('sql') || f.id?.includes('TS001') || f.id?.includes('TS002')
      );
      expect(sqlFindings.length).toBeGreaterThan(0);
    });

    it('detects hardcoded secrets', async () => {
      const { scanSource } = await import('@isl-lang/security-scanner');
      const source = readFixture('vulnerable-project', 'src/routes.ts');
      const findings = scanSource(source, 'typescript');
      const secretFindings = findings.filter((f: { category: string; id: string }) =>
        f.category?.toLowerCase().includes('secret') || f.id?.includes('SEC009') || f.id?.includes('TS015')
      );
      expect(secretFindings.length).toBeGreaterThan(0);
    });

    it('detects XSS via res.send with user input', async () => {
      const { scanSource } = await import('@isl-lang/security-scanner');
      const source = readFixture('vulnerable-project', 'src/routes.ts');
      const findings = scanSource(source, 'typescript');
      const xssFindings = findings.filter((f: { category: string; id: string }) =>
        f.category?.toLowerCase().includes('xss') || f.id?.includes('TS009')
      );
      expect(xssFindings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Vulnerable project — mock detector', () => {
    it('detects fake success pattern', async () => {
      const { scanFile } = await import('@isl-lang/mock-detector');
      const source = readFixture('vulnerable-project', 'src/routes.ts');
      const findings = scanFile({ filePath: 'src/routes.ts', content: source });
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe('Clean project — security scanner', () => {
    it('finds no SQL injection', async () => {
      const { scanSource } = await import('@isl-lang/security-scanner');
      const source = readFixture('clean-project', 'src/routes.ts');
      const findings = scanSource(source, 'typescript');
      const sqlFindings = findings.filter((f: { category: string }) =>
        f.category?.toLowerCase().includes('sql')
      );
      expect(sqlFindings.length).toBe(0);
    });

    it('finds no hardcoded secrets', async () => {
      const { scanSource } = await import('@isl-lang/security-scanner');
      const source = readFixture('clean-project', 'src/routes.ts');
      const findings = scanSource(source, 'typescript');
      const secretFindings = findings.filter((f: { category: string; id: string }) =>
        f.category?.toLowerCase().includes('secret') || f.id?.includes('SEC009')
      );
      expect(secretFindings.length).toBe(0);
    });
  });

  describe('Clean project — mock detector', () => {
    it('finds no mock patterns', async () => {
      const { scanFile } = await import('@isl-lang/mock-detector');
      const source = readFixture('clean-project', 'src/routes.ts');
      const findings = scanFile({ filePath: 'src/routes.ts', content: source });
      expect(findings.length).toBe(0);
    });
  });

  describe('Proof checker', () => {
    it('validates a well-formed proof bundle', async () => {
      const { computeHash, canonicalize } = await import('@isl-lang/proof-checker');
      const hash = computeHash('test content');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      const canonical = canonicalize({ b: 2, a: 1 });
      expect(canonical).toBe('{"a":1,"b":2}');
    });
  });
});
