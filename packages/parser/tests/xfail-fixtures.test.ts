/**
 * Parser Fixture Tests with XFAIL Support
 * 
 * Uses the xfail harness to handle expected failures deterministically.
 * 
 * SKIP: Fixtures not run at all (known parser blockers)
 * XFAIL: Fixtures run but expected to fail (known issues)
 * 
 * CI treats:
 * - Unexpected failures as failures
 * - XFAIL-fixed tests as failures (forces cleanup)
 */

import { describe, it, expect, afterAll } from 'vitest';
import { parse, parseFile } from '../src/index.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { 
  createXFailHarness, 
  type XFailHarness 
} from '../../../test-fixtures/xfail-harness.js';

// Path to test fixtures (relative to package root)
const FIXTURES_ROOT = join(__dirname, '../../../test-fixtures');

// Helper to load fixture
function loadFixture(relativePath: string): string {
  const fullPath = join(FIXTURES_ROOT, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Fixture not found: ${fullPath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

// Helper to collect all .isl files in a directory
function collectFixtures(dir: string, base = ''): string[] {
  const fixtures: string[] = [];
  const fullDir = join(FIXTURES_ROOT, dir);
  
  if (!existsSync(fullDir)) return fixtures;
  
  const entries = readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      fixtures.push(...collectFixtures(`${dir}/${entry.name}`, relativePath));
    } else if (entry.name.endsWith('.isl')) {
      fixtures.push(relativePath);
    }
  }
  return fixtures;
}

describe('Parser XFAIL Fixture Tests', () => {
  // Verify fixtures exist before running tests
  const fixturesExist = existsSync(FIXTURES_ROOT);
  
  if (!fixturesExist) {
    it.skip('Fixtures directory not found', () => {});
    return;
  }
  
  const harness = createXFailHarness('parser');
  
  describe('Valid Fixtures', () => {
    const validFixtures = collectFixtures('valid');
    
    for (const fixture of validFixtures) {
      harness.runFixtureTest(fixture, () => {
        const source = loadFixture(fixture);
        const result = parse(source, fixture);
        
        expect(result.success).toBe(true);
        expect(result.errors.filter(e => e.severity === 'error')).toHaveLength(0);
        expect(result.domain).toBeDefined();
      });
    }
  });

  describe('Invalid Syntax Fixtures', () => {
    const syntaxErrorFixtures = collectFixtures('invalid/syntax-errors');
    
    for (const fixture of syntaxErrorFixtures) {
      harness.runFixtureTest(fixture, () => {
        const source = loadFixture(fixture);
        const result = parse(source, fixture);
        
        // Syntax error fixtures should fail to parse
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    }
  });

  describe('Edge Case Fixtures', () => {
    const edgeCaseFixtures = collectFixtures('edge-cases');
    
    for (const fixture of edgeCaseFixtures) {
      harness.runFixtureTest(fixture, () => {
        const source = loadFixture(fixture);
        const result = parse(source, fixture);
        
        // Edge cases should at least not crash
        // They may succeed or fail with errors, but shouldn't throw
        expect(result).toBeDefined();
        
        // If it claims success, it should have a domain
        if (result.success) {
          expect(result.domain).toBeDefined();
        }
      });
    }
  });

  // Summary and CI enforcement
  describe('XFAIL Summary', () => {
    it('should print xfail summary', () => {
      harness.printSummary();
    });
    
    it('should have no xfail-fixed tests (CI enforcement)', () => {
      harness.assertNoXFailFixed();
    });
  });
});

describe('Parser XFAIL - Specific Tests', () => {
  const harness = createXFailHarness('parser');
  
  // Test specific fixtures with detailed assertions
  describe('valid/minimal.isl', () => {
    harness.runFixtureTest('valid/minimal.isl', () => {
      const source = loadFixture('valid/minimal.isl');
      const result = parse(source, 'minimal.isl');
      
      expect(result.success).toBe(true);
      expect(result.domain?.name.name).toBe('Minimal');
      expect(result.domain?.version.value).toBe('1.0.0');
    });
  });
  
  describe('invalid/syntax-errors/missing-braces.isl', () => {
    harness.runFixtureTest('invalid/syntax-errors/missing-braces.isl', () => {
      const source = loadFixture('invalid/syntax-errors/missing-braces.isl');
      const result = parse(source, 'missing-braces.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('invalid/syntax-errors/unterminated-string.isl', () => {
    harness.runFixtureTest('invalid/syntax-errors/unterminated-string.isl', () => {
      const source = loadFixture('invalid/syntax-errors/unterminated-string.isl');
      const result = parse(source, 'unterminated-string.isl');
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => 
        e.message.toLowerCase().includes('unterminated') || 
        e.message.toLowerCase().includes('string')
      )).toBe(true);
    });
  });

  // Summary
  afterAll(() => {
    harness.printSummary();
  });
});
