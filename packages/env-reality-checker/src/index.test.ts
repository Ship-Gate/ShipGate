/**
 * Tests for env-reality-checker
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { checkEnvReality, formatReport } from './index.js';
import { extractFromEnvFiles } from './extractors/definitions.js';
import { extractUsages } from './extractors/usages.js';
import { analyzeEnvReality } from './analyzer.js';

describe('env-reality-checker', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-reality-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('extractFromEnvFiles', () => {
    it('should extract env vars from .env.example', () => {
      const envContent = `
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://localhost:5432/test
JWT_SECRET=secret-key-here
      `.trim();

      const envFile = path.join(tempDir, '.env.example');
      fs.writeFileSync(envFile, envContent);

      const definitions = extractFromEnvFiles(tempDir, ['.env.example']);

      expect(definitions).toHaveLength(4);
      expect(definitions.find(d => d.name === 'PORT')).toBeDefined();
      expect(definitions.find(d => d.name === 'NODE_ENV')?.defaultValue).toBe('development');
      expect(definitions.find(d => d.name === 'JWT_SECRET')?.sensitive).toBe(true);
    });

    it('should handle empty values', () => {
      const envContent = `API_KEY=`;
      const envFile = path.join(tempDir, '.env.example');
      fs.writeFileSync(envFile, envContent);

      const definitions = extractFromEnvFiles(tempDir, ['.env.example']);

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe('API_KEY');
      expect(definitions[0].required).toBe(true);
      expect(definitions[0].defaultValue).toBeUndefined();
    });
  });

  describe('extractUsages', () => {
    it('should extract process.env usage', () => {
      const code = `
const port = process.env.PORT || '3000';
const dbUrl = process.env.DATABASE_URL;
      `.trim();

      const codeFile = path.join(tempDir, 'config.ts');
      fs.writeFileSync(codeFile, code);

      const usages = extractUsages(tempDir, ['config.ts']);

      expect(usages).toHaveLength(2);
      expect(usages.find(u => u.name === 'PORT')?.hasDefault).toBe(true);
      expect(usages.find(u => u.name === 'DATABASE_URL')?.hasDefault).toBe(false);
    });

    it('should extract process.env bracket notation', () => {
      const code = `const key = process.env['API_KEY'];`;
      const codeFile = path.join(tempDir, 'config.ts');
      fs.writeFileSync(codeFile, code);

      const usages = extractUsages(tempDir, ['config.ts']);

      expect(usages).toHaveLength(1);
      expect(usages[0].name).toBe('API_KEY');
    });

    it('should extract Deno.env.get usage', () => {
      const code = `const token = Deno.env.get('GITHUB_TOKEN');`;
      const codeFile = path.join(tempDir, 'config.ts');
      fs.writeFileSync(codeFile, code);

      const usages = extractUsages(tempDir, ['config.ts']);

      expect(usages).toHaveLength(1);
      expect(usages[0].name).toBe('GITHUB_TOKEN');
      expect(usages[0].source).toBe('Deno.env.get');
    });
  });

  describe('analyzeEnvReality', () => {
    it('should detect used-but-undefined vars', () => {
      const definitions = [
        {
          name: 'PORT',
          file: '.env.example',
          line: 1,
          source: 'env-file' as const,
          required: false,
          defaultValue: '3000',
          sensitive: false,
        },
      ];

      const usages = [
        {
          name: 'PORT',
          file: 'config.ts',
          line: 1,
          source: 'process.env' as const,
          hasDefault: false,
        },
        {
          name: 'MISSING_VAR',
          file: 'config.ts',
          line: 2,
          source: 'process.env' as const,
          hasDefault: false,
        },
      ];

      const result = analyzeEnvReality(definitions, usages);

      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].type).toBe('used-but-undefined');
      expect(result.claims[0].variable).toBe('MISSING_VAR');
    });

    it('should detect defined-but-unused vars', () => {
      const definitions = [
        {
          name: 'UNUSED_VAR',
          file: '.env.example',
          line: 1,
          source: 'env-file' as const,
          required: false,
          sensitive: false,
        },
      ];

      const usages: typeof definitions = [];

      const result = analyzeEnvReality(definitions, usages);

      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].type).toBe('defined-but-unused');
      expect(result.claims[0].variable).toBe('UNUSED_VAR');
    });

    it('should detect renamed drift', () => {
      const definitions = [
        {
          name: 'DATABASE_URL',
          file: '.env.example',
          line: 1,
          source: 'env-file' as const,
          required: false,
          sensitive: false,
        },
      ];

      const usages = [
        {
          name: 'DB_URL', // Similar but different
          file: 'config.ts',
          line: 1,
          source: 'process.env' as const,
          hasDefault: false,
        },
      ];

      const result = analyzeEnvReality(definitions, usages);

      // Should detect both used-but-undefined and potentially renamed drift
      expect(result.claims.length).toBeGreaterThan(0);
    });
  });

  describe('formatReport', () => {
    it('should format report correctly', () => {
      const result = {
        definitions: [],
        usages: [],
        claims: [
          {
            id: '1',
            type: 'used-but-undefined' as const,
            variable: 'MISSING_VAR',
            severity: 'error' as const,
            message: 'Test message',
            usage: {
              name: 'MISSING_VAR',
              file: 'config.ts',
              line: 1,
              source: 'process.env' as const,
              hasDefault: false,
            },
            remediation: ['add-to-schema'],
          },
        ],
        summary: {
          totalDefinitions: 0,
          totalUsages: 1,
          totalClaims: 1,
          usedButUndefined: 1,
          definedButUnused: 0,
          renamedDrift: 0,
          typeMismatches: 0,
        },
      };

      const report = formatReport(result);

      expect(report).toContain('ENVIRONMENT VARIABLE REALITY CHECK REPORT');
      expect(report).toContain('MISSING_VAR');
      expect(report).toContain('ERRORS');
    });
  });

  describe('integration', () => {
    it('should work end-to-end', async () => {
      // Create .env.example
      const envContent = `PORT=3000\nDATABASE_URL=postgres://localhost/test`;
      fs.writeFileSync(path.join(tempDir, '.env.example'), envContent);

      // Create code file
      const codeContent = `
const port = process.env.PORT || '3000';
const db = process.env.DATABASE_URL;
const missing = process.env.MISSING_VAR;
      `.trim();
      fs.writeFileSync(path.join(tempDir, 'config.ts'), codeContent);

      const result = await checkEnvReality({
        projectRoot: tempDir,
        sourcePatterns: ['**/*.ts'],
        envFilePatterns: ['.env.example'],
      });

      expect(result.summary.totalDefinitions).toBeGreaterThan(0);
      expect(result.summary.totalUsages).toBeGreaterThan(0);
      expect(result.claims.some(c => c.variable === 'MISSING_VAR')).toBe(true);
    });
  });
});
