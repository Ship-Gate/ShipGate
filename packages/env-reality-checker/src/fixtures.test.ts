/**
 * Fixture-based tests for env reality checker
 * Tests real-world scenarios with minimal false positives
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extractFromEnvFiles } from './extractors/definitions.js';
import { extractUsages } from './extractors/usages.js';
import { analyzeEnvReality } from './analyzer.js';

describe('Fixture Tests - Common Patterns', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures');

  describe('Common false positive patterns', () => {
    it('should not flag NODE_ENV as unused (common system var)', () => {
      const definitions = [
        {
          name: 'NODE_ENV',
          file: '.env.example',
          line: 1,
          source: 'env-file' as const,
          required: false,
          defaultValue: 'development',
          sensitive: false,
        },
      ];

      const usages: Array<{
        name: string;
        file: string;
        line: number;
        source: 'process.env' | 'Deno.env.get' | 'import.meta.env' | 'Bun.env' | 'config';
        hasDefault: boolean;
        defaultValue?: string;
        context?: string;
      }> = [];

      const result = analyzeEnvReality(definitions, usages);

      // NODE_ENV is a common system var, should not be flagged
      const nodeEnvClaim = result.claims.find(c => c.variable === 'NODE_ENV');
      expect(nodeEnvClaim).toBeUndefined();
    });

    it('should handle process.env with default values', () => {
      const code = `
const port = process.env.PORT || '3000';
const apiKey = process.env.API_KEY || '';
      `;

      const tempFile = path.join(__dirname, 'temp-test.ts');
      fs.writeFileSync(tempFile, code);

      try {
        const usages = extractUsages(path.dirname(tempFile), [path.basename(tempFile)]);

        expect(usages).toHaveLength(2);
        expect(usages.find(u => u.name === 'PORT')?.hasDefault).toBe(true);
        expect(usages.find(u => u.name === 'PORT')?.defaultValue).toBe('3000');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should handle bracket notation correctly', () => {
      const code = `
const key1 = process.env['API_KEY'];
const key2 = process.env["SECRET_KEY"];
      `;

      const tempFile = path.join(__dirname, 'temp-test.ts');
      fs.writeFileSync(tempFile, code);

      try {
        const usages = extractUsages(path.dirname(tempFile), [path.basename(tempFile)]);

        expect(usages).toHaveLength(2);
        expect(usages.find(u => u.name === 'API_KEY')).toBeDefined();
        expect(usages.find(u => u.name === 'SECRET_KEY')).toBeDefined();
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('Real-world scenarios', () => {
    it('should detect missing required env var', () => {
      const definitions: typeof definitions = [];

      const usages = [
        {
          name: 'DATABASE_URL',
          file: 'src/db.ts',
          line: 10,
          source: 'process.env' as const,
          hasDefault: false,
        },
      ];

      const result = analyzeEnvReality(definitions, usages);

      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].type).toBe('used-but-undefined');
      expect(result.claims[0].severity).toBe('error');
      expect(result.claims[0].remediation).toContain('add-to-env-file');
    });

    it('should detect unused env var (non-system)', () => {
      const definitions = [
        {
          name: 'UNUSED_FEATURE_FLAG',
          file: '.env.example',
          line: 5,
          source: 'env-file' as const,
          required: false,
          sensitive: false,
        },
      ];

      const usages: Array<{
        name: string;
        file: string;
        line: number;
        source: 'process.env' | 'Deno.env.get' | 'import.meta.env' | 'Bun.env' | 'config';
        hasDefault: boolean;
        defaultValue?: string;
        context?: string;
      }> = [];

      const result = analyzeEnvReality(definitions, usages);

      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].type).toBe('defined-but-unused');
      expect(result.claims[0].severity).toBe('warning');
    });

    it('should handle zod schema extraction', async () => {
      const zodCode = `
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_KEY: z.string().optional(),
});
      `;

      const tempFile = path.join(__dirname, 'temp-schema.ts');
      fs.writeFileSync(tempFile, zodCode);

      try {
        const { extractFromZodSchemas } = await import('./extractors/definitions.js');
        const definitions = extractFromZodSchemas(path.dirname(tempFile), [path.basename(tempFile)]);

        // Note: Zod extraction is complex and may need refinement
        // This test verifies the function runs without errors

        expect(definitions.length).toBeGreaterThan(0);
        expect(definitions.find(d => d.name === 'PORT')).toBeDefined();
        expect(definitions.find(d => d.name === 'PORT')?.typeHint).toBe('number');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle empty .env files', () => {
      const tempDir = __dirname;
      const envFile = path.join(tempDir, '.env.empty');
      fs.writeFileSync(envFile, '');

      try {
        const definitions = extractFromEnvFiles(tempDir, ['.env.empty']);
        expect(definitions).toHaveLength(0);
      } finally {
        fs.unlinkSync(envFile);
      }
    });

    it('should handle comments in .env files', () => {
      const envContent = `
# This is a comment
PORT=3000
# Another comment
DATABASE_URL=postgres://localhost/test
      `.trim();

      const tempFile = path.join(__dirname, '.env.test');
      fs.writeFileSync(tempFile, envContent);

      try {
        const definitions = extractFromEnvFiles(path.dirname(tempFile), [path.basename(tempFile)]);

        expect(definitions).toHaveLength(2);
        expect(definitions.find(d => d.name === 'PORT')).toBeDefined();
        expect(definitions.find(d => d.name === 'DATABASE_URL')).toBeDefined();
      } finally {
        fs.unlinkSync(tempFile);
      }
    });

    it('should handle multiline env values (quoted)', () => {
      const envContent = `MULTILINE_KEY="line1\\nline2"`;
      const tempFile = path.join(__dirname, '.env.test');
      fs.writeFileSync(tempFile, envContent);

      try {
        const definitions = extractFromEnvFiles(path.dirname(tempFile), [path.basename(tempFile)]);

        expect(definitions).toHaveLength(1);
        expect(definitions[0].name).toBe('MULTILINE_KEY');
        expect(definitions[0].defaultValue).toContain('line1');
      } finally {
        fs.unlinkSync(tempFile);
      }
    });
  });
});
