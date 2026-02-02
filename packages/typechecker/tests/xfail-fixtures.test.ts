/**
 * Typechecker Fixture Tests with XFAIL Support
 * 
 * Uses the xfail harness to handle expected failures deterministically.
 * 
 * SKIP: Fixtures not run at all (parser cannot parse them)
 * XFAIL: Fixtures run but expected to fail (known typechecker issues)
 * 
 * CI treats:
 * - Unexpected failures as failures
 * - XFAIL-fixed tests as failures (forces cleanup)
 */

import { describe, it, expect, afterAll } from 'vitest';
import { check } from '../src/index.js';
import { parse } from '@isl-lang/parser';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
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

// Helper to parse and check a fixture
function parseAndCheck(source: string, filename: string) {
  const parseResult = parse(source, filename);
  if (!parseResult.success || !parseResult.domain) {
    throw new Error(
      `Parse failed for ${filename}: ${parseResult.errors.map(e => e.message).join(', ')}`
    );
  }
  return check(parseResult.domain);
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

// Helper to get errors only (no warnings)
function getErrors(result: ReturnType<typeof check>) {
  return result.diagnostics.filter(d => d.severity === 'error');
}

describe('Typechecker XFAIL Fixture Tests', () => {
  // Verify fixtures exist before running tests
  const fixturesExist = existsSync(FIXTURES_ROOT);
  
  if (!fixturesExist) {
    it.skip('Fixtures directory not found', () => {});
    return;
  }
  
  const harness = createXFailHarness('typechecker');
  
  describe('Valid Fixtures (should typecheck without errors)', () => {
    const validFixtures = collectFixtures('valid');
    
    for (const fixture of validFixtures) {
      harness.runFixtureTest(fixture, () => {
        const source = loadFixture(fixture);
        const result = parseAndCheck(source, fixture);
        
        expect(result.success).toBe(true);
        expect(getErrors(result)).toHaveLength(0);
      });
    }
  });

  describe('Type Error Fixtures (should have type errors)', () => {
    const typeErrorFixtures = collectFixtures('invalid/type-errors');
    
    for (const fixture of typeErrorFixtures) {
      harness.runFixtureTest(fixture, () => {
        const source = loadFixture(fixture);
        
        // First try to parse - some may fail at parse stage
        const parseResult = parse(source, fixture);
        if (!parseResult.success || !parseResult.domain) {
          // If it doesn't parse, that's also a "failure" for type-error fixtures
          // which is expected behavior
          return;
        }
        
        const result = check(parseResult.domain);
        
        // Type error fixtures should have errors
        expect(getErrors(result).length).toBeGreaterThan(0);
      });
    }
  });

  describe('Semantic Error Fixtures', () => {
    const semanticErrorFixtures = collectFixtures('invalid/semantic-errors');
    
    for (const fixture of semanticErrorFixtures) {
      harness.runFixtureTest(fixture, () => {
        const source = loadFixture(fixture);
        
        const parseResult = parse(source, fixture);
        if (!parseResult.success || !parseResult.domain) {
          return; // Parse failure is acceptable for error fixtures
        }
        
        const result = check(parseResult.domain);
        
        // Semantic error fixtures should have errors or warnings
        expect(result.diagnostics.length).toBeGreaterThan(0);
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

describe('Typechecker XFAIL - Specific Tests', () => {
  const harness = createXFailHarness('typechecker');
  
  // Test specific fixtures with detailed assertions
  describe('valid/minimal.isl', () => {
    harness.runFixtureTest('valid/minimal.isl', () => {
      const source = loadFixture('valid/minimal.isl');
      const result = parseAndCheck(source, 'minimal.isl');
      
      expect(result.success).toBe(true);
      expect(getErrors(result)).toHaveLength(0);
      
      // Should have the entity in symbol table
      const itemSymbol = result.symbolTable.lookup('Item');
      expect(itemSymbol).toBeDefined();
    });
  });

  describe('invalid/type-errors/undefined-type.isl', () => {
    harness.runFixtureTest('invalid/type-errors/undefined-type.isl', () => {
      const source = loadFixture('invalid/type-errors/undefined-type.isl');
      const parseResult = parse(source, 'undefined-type.isl');
      
      if (!parseResult.domain) {
        // Parse failure is acceptable
        return;
      }
      
      const result = check(parseResult.domain);
      const errors = getErrors(result);
      
      // Type error fixture should have errors (any type errors)
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('invalid/type-errors/duplicate-declaration.isl', () => {
    harness.runFixtureTest('invalid/type-errors/duplicate-declaration.isl', () => {
      const source = loadFixture('invalid/type-errors/duplicate-declaration.isl');
      const parseResult = parse(source, 'duplicate-declaration.isl');
      
      if (!parseResult.domain) {
        return;
      }
      
      const result = check(parseResult.domain);
      const errors = getErrors(result);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => 
        e.message.toLowerCase().includes('duplicate') ||
        e.message.toLowerCase().includes('already')
      )).toBe(true);
    });
  });

  // Summary
  afterAll(() => {
    harness.printSummary();
  });
});
