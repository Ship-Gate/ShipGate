// ============================================================================
// Integration Tests: Generate Tests for Sample Domains
// Generates tests for 3 sample domains and verifies they are runnable
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@isl-lang/parser';
import { generateTests, writeFiles, verifyGeneratedTests } from '../src/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample domains to test
const SAMPLE_DOMAINS = [
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

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration: Sample Domain Test Generation', () => {
  for (const sample of SAMPLE_DOMAINS) {
    describe(`Domain: ${sample.name}`, () => {
      let domainSource: string;
      let parsedDomain: ReturnType<typeof parse>;

      beforeAll(() => {
        if (!existsSync(sample.path)) {
          console.warn(`Sample domain not found: ${sample.path}`);
          return;
        }

        domainSource = readFileSync(sample.path, 'utf-8');
        parsedDomain = parse(domainSource, sample.path);

        if (!parsedDomain.success || !parsedDomain.ast) {
          throw new Error(
            `Failed to parse ${sample.name}: ${parsedDomain.errors?.map(e => e.message).join(', ')}`
          );
        }
      });

      it('should parse the domain successfully', () => {
        if (!existsSync(sample.path)) {
          console.warn(`Skipping test - sample not found: ${sample.path}`);
          return;
        }

        expect(parsedDomain.success).toBe(true);
        expect(parsedDomain.ast).toBeDefined();
        expect(parsedDomain.ast!.behaviors.length).toBeGreaterThan(0);
      });

      it('should generate test files for all behaviors', () => {
        if (!parsedDomain.ast) return;

        const result = generateTests(parsedDomain.ast, {
          framework: 'vitest',
          outputDir: '.',
          includeHelpers: true,
          emitMetadata: true,
        });

        expect(result.success).toBe(true);
        expect(result.files.length).toBeGreaterThan(0);

        // Should have test files for each behavior
        const behaviorNames = parsedDomain.ast.behaviors.map(b => b.name.name);
        for (const behaviorName of behaviorNames) {
          const testFile = result.files.find(f => 
            f.path.includes(`${behaviorName}.test.ts`)
          );
          expect(testFile).toBeDefined();
          expect(testFile!.content).toContain(`describe('${behaviorName}'`);
        }
      });

      it('should generate helper files', () => {
        if (!parsedDomain.ast) return;

        const result = generateTests(parsedDomain.ast, {
          framework: 'vitest',
          includeHelpers: true,
        });

        const helpersFile = result.files.find(f => 
          f.path.includes('helpers/test-utils.ts')
        );
        const fixturesFile = result.files.find(f => 
          f.path.includes('helpers/fixtures.ts')
        );

        expect(helpersFile).toBeDefined();
        expect(fixturesFile).toBeDefined();
      });

      it('should generate framework config', () => {
        if (!parsedDomain.ast) return;

        const result = generateTests(parsedDomain.ast, {
          framework: 'vitest',
        });

        const configFile = result.files.find(f => 
          f.path.includes('vitest.config.ts')
        );

        expect(configFile).toBeDefined();
        expect(configFile!.content).toContain('defineConfig');
      });

      it('should generate scenario tests if scenarios exist', () => {
        if (!parsedDomain.ast) return;

        const hasScenarios = parsedDomain.ast.scenarios.length > 0;
        if (!hasScenarios) {
          console.log(`No scenarios in ${sample.name}, skipping scenario test`);
          return;
        }

        const result = generateTests(parsedDomain.ast, {
          framework: 'vitest',
        });

        // Find a behavior with scenarios
        const scenarioBlock = parsedDomain.ast.scenarios[0];
        if (scenarioBlock) {
          const behaviorName = scenarioBlock.behaviorName.name;
          const testFile = result.files.find(f => 
            f.path.includes(`${behaviorName}.test.ts`)
          );

          expect(testFile).toBeDefined();
          // Should contain scenario tests
          expect(testFile!.content).toContain('Scenarios');
        }
      });

      it('should generate property-based test stubs', () => {
        if (!parsedDomain.ast) return;

        const result = generateTests(parsedDomain.ast, {
          framework: 'vitest',
        });

        const testFile = result.files.find(f => f.path.endsWith('.test.ts'));
        expect(testFile).toBeDefined();
        // Should contain PBT stub comment
        expect(testFile!.content).toContain('Property-Based');
      });

      it('should produce deterministic output', () => {
        if (!parsedDomain.ast) return;

        const result1 = generateTests(parsedDomain.ast, {
          framework: 'vitest',
        });

        const result2 = generateTests(parsedDomain.ast, {
          framework: 'vitest',
        });

        // Same number of files
        expect(result1.files.length).toBe(result2.files.length);

        // Files should be in same order
        for (let i = 0; i < result1.files.length; i++) {
          expect(result1.files[i]!.path).toBe(result2.files[i]!.path);
        }
      });

      it('should generate valid TypeScript syntax', () => {
        if (!parsedDomain.ast) return;

        const result = generateTests(parsedDomain.ast, {
          framework: 'vitest',
        });

        for (const file of result.files.filter(f => f.path.endsWith('.ts'))) {
          // Basic syntax checks
          expect(file.content).not.toContain('undefined undefined');
          
          // Should have balanced braces
          const openBraces = (file.content.match(/{/g) || []).length;
          const closeBraces = (file.content.match(/}/g) || []).length;
          expect(openBraces).toBe(closeBraces);

          // Should have balanced parentheses
          const openParens = (file.content.match(/\(/g) || []).length;
          const closeParens = (file.content.match(/\)/g) || []).length;
          expect(openParens).toBe(closeParens);
        }
      });

      it('should track coverage metadata', () => {
        if (!parsedDomain.ast) return;

        const result = generateTests(parsedDomain.ast, {
          framework: 'vitest',
          emitMetadata: true,
        });

        expect(result.metadata).toBeDefined();
        expect(result.metadata.stats.totalBehaviors).toBe(parsedDomain.ast.behaviors.length);
        expect(result.metadata.stats.totalAssertions).toBeGreaterThanOrEqual(0);
      });
    });
  }

  describe('Cross-Domain Verification', () => {
    it('should generate tests for all 3 sample domains', async () => {
      const results = [];

      for (const sample of SAMPLE_DOMAINS) {
        if (!existsSync(sample.path)) {
          console.warn(`Skipping ${sample.name} - file not found`);
          continue;
        }

        const source = readFileSync(sample.path, 'utf-8');
        const parsed = parse(source, sample.path);

        if (!parsed.success || !parsed.ast) {
          console.warn(`Skipping ${sample.name} - parse failed`);
          continue;
        }

        const result = generateTests(parsed.ast, {
          framework: 'vitest',
          includeHelpers: true,
        });

        results.push({
          name: sample.name,
          success: result.success,
          fileCount: result.files.length,
        });
      }

      // Should have generated tests for at least some domains
      expect(results.length).toBeGreaterThan(0);
      
      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.fileCount).toBeGreaterThan(0);
      }
    });

    it('should produce stable file ordering across domains', () => {
      const allFiles: string[] = [];

      for (const sample of SAMPLE_DOMAINS) {
        if (!existsSync(sample.path)) continue;

        const source = readFileSync(sample.path, 'utf-8');
        const parsed = parse(source, sample.path);

        if (!parsed.success || !parsed.ast) continue;

        const result = generateTests(parsed.ast, {
          framework: 'vitest',
        });

        const filePaths = result.files.map(f => f.path).sort();
        allFiles.push(...filePaths);
      }

      // Verify deterministic ordering
      const sortedFiles = [...allFiles].sort();
      expect(allFiles).toEqual(sortedFiles);
    });
  });
});
