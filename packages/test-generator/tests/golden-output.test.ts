// ============================================================================
// Golden Output Tests
// Verifies stable outputs for 3 sample domains
// ============================================================================

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@isl-lang/parser';
import { generateTests } from '../src/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample domains for golden tests
const GOLDEN_SAMPLE_DOMAINS = [
  {
    name: 'tiny-crud',
    path: join(__dirname, '../../../samples/isl/tiny-crud/domain.isl'),
  },
  {
    name: 'auth-roles',
    path: join(__dirname, '../../../samples/isl/auth-roles/domain.isl'),
  },
  {
    name: 'payments-idempotency',
    path: join(__dirname, '../../../samples/isl/payments-idempotency/domain.isl'),
  },
];

const GOLDEN_DIR = join(__dirname, '../golden');

// ============================================================================
// GOLDEN TESTS
// ============================================================================

describe('Golden Output Tests', () => {
  // Ensure golden directory exists
  beforeAll(() => {
    mkdirSync(GOLDEN_DIR, { recursive: true });
  });

  for (const sample of GOLDEN_SAMPLE_DOMAINS) {
    describe(`Domain: ${sample.name}`, () => {
      let parsedDomain: ReturnType<typeof parse>['ast'];

      beforeAll(() => {
        if (!existsSync(sample.path)) {
          console.warn(`Sample domain not found: ${sample.path}`);
          return;
        }

        const source = readFileSync(sample.path, 'utf-8');
        const parsed = parse(source, sample.path);

        if (!parsed.success || !parsed.ast) {
          throw new Error(
            `Failed to parse ${sample.name}: ${parsed.errors?.map(e => e.message).join(', ')}`
          );
        }

        parsedDomain = parsed.ast;
      });

      it('should produce stable output matching golden file', () => {
        if (!parsedDomain) {
          console.warn(`Skipping - domain not parsed: ${sample.name}`);
          return;
        }

        // Generate tests with fixed seed for reproducibility
        const result = generateTests(parsedDomain, {
          framework: 'vitest',
          outputDir: '.',
          includeHelpers: true,
          emitMetadata: false, // Don't include timestamps in golden
        });

        expect(result.success).toBe(true);

        // Normalize content (remove timestamps, etc.)
        const normalizedFiles = result.files.map(file => ({
          path: file.path,
          content: normalizeContent(file.content),
        }));

        // Sort files for stable comparison
        normalizedFiles.sort((a, b) => a.path.localeCompare(b.path));

        // Generate golden file path
        const goldenPath = join(GOLDEN_DIR, `${sample.name}.golden.json`);

        if (!existsSync(goldenPath)) {
          // Create golden file if it doesn't exist
          writeFileSync(
            goldenPath,
            JSON.stringify(normalizedFiles, null, 2),
            'utf-8'
          );
          console.log(`Created golden file: ${goldenPath}`);
          return;
        }

        // Compare with golden file
        const goldenContent = readFileSync(goldenPath, 'utf-8');
        const goldenFiles = JSON.parse(goldenContent) as Array<{ path: string; content: string }>;

        expect(normalizedFiles.length).toBe(goldenFiles.length);

        for (let i = 0; i < normalizedFiles.length; i++) {
          const generated = normalizedFiles[i]!;
          const golden = goldenFiles[i];

          if (!golden) {
            throw new Error(`Golden file missing entry for ${generated.path}`);
          }

          expect(generated.path).toBe(golden.path);

          if (generated.content !== golden.content) {
            // Show diff for debugging
            const diff = generateDiff(golden.content, generated.content);
            throw new Error(
              `Golden mismatch for ${generated.path}:\n${diff}\n\n` +
              `If this change is intentional, update the golden file:\n` +
              `  ${goldenPath}`
            );
          }
        }
      });

      it('should produce identical output on multiple runs', () => {
        if (!parsedDomain) return;

        const result1 = generateTests(parsedDomain, {
          framework: 'vitest',
          outputDir: '.',
        });

        const result2 = generateTests(parsedDomain, {
          framework: 'vitest',
          outputDir: '.',
        });

        expect(result1.files.length).toBe(result2.files.length);

        // Normalize and compare
        const files1 = result1.files
          .map(f => ({ path: f.path, content: normalizeContent(f.content) }))
          .sort((a, b) => a.path.localeCompare(b.path));

        const files2 = result2.files
          .map(f => ({ path: f.path, content: normalizeContent(f.content) }))
          .sort((a, b) => a.path.localeCompare(b.path));

        for (let i = 0; i < files1.length; i++) {
          expect(files1[i]!.path).toBe(files2[i]!.path);
          expect(files1[i]!.content).toBe(files2[i]!.content);
        }
      });
    });
  }
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize content for comparison (remove timestamps, etc.)
 */
function normalizeContent(content: string): string {
  return content
    .replace(/Generated: .+/g, 'Generated: [TIMESTAMP]')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]')
    .replace(/seed=\d+/g, 'seed=[SEED]')
    .replace(/@dataTrace seed=\d+/g, '@dataTrace seed=[SEED]')
    .trim();
}

/**
 * Generate a simple diff for error messages
 */
function generateDiff(expected: string, actual: string): string {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  const diff: string[] = [];

  for (let i = 0; i < Math.min(maxLen, 20); i++) {
    const expectedLine = expectedLines[i] ?? '<EOF>';
    const actualLine = actualLines[i] ?? '<EOF>';

    if (expectedLine !== actualLine) {
      diff.push(`Line ${i + 1}:`);
      diff.push(`  expected: ${JSON.stringify(expectedLine)}`);
      diff.push(`  actual:   ${JSON.stringify(actualLine)}`);
    }
  }

  if (maxLen > 20) {
    diff.push('  ... (truncated)');
  }

  return diff.join('\n');
}
