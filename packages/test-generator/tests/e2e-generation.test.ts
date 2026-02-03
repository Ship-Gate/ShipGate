// ============================================================================
// E2E Test Generation Tests
// ============================================================================
//
// These tests verify that:
// 1. Test generation produces runnable code
// 2. Generated tests are deterministic (seed-based)
// 3. Boundary values are computed correctly
// 4. Cross-field constraints are handled
// 5. Expected outcomes are computed from postconditions
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from '@isl-lang/parser';
import { generateWithSynthesis } from '../src/generator';
import {
  synthesizeInputs,
  generateSeed,
  extractCrossFieldConstraints,
  type CrossFieldConstraint,
} from '../src/data-synthesizer';
import { synthesizeExpectedOutcome } from '../src/expected-outcome';
import type * as AST from '@isl-lang/parser';

// ============================================================================
// FIXTURE LOADING
// ============================================================================

const FIXTURES_DIR = join(__dirname, '../fixtures');

interface LoadedFixture {
  name: string;
  path: string;
  source: string;
  domain: AST.Domain;
}

function loadFixture(filename: string): LoadedFixture {
  const path = join(FIXTURES_DIR, filename);
  if (!existsSync(path)) {
    throw new Error(`Fixture not found: ${path}`);
  }
  const source = readFileSync(path, 'utf-8');
  const parseResult = parse(source, filename);
  if (!parseResult.success || !parseResult.ast) {
    throw new Error(`Parse error in ${filename}: ${parseResult.errors?.map(e => e.message).join(', ')}`);
  }
  return {
    name: filename.replace('.isl', ''),
    path,
    source,
    domain: parseResult.ast,
  };
}

const E2E_FIXTURES = [
  'e2e-numeric.isl',
  'e2e-string.isl',
  'e2e-collection.isl',
  'e2e-cross-field.isl',
  'e2e-expected-outcomes.isl',
];

// ============================================================================
// E2E GENERATION TESTS
// ============================================================================

describe('E2E Test Generation', () => {
  const fixtures: LoadedFixture[] = [];

  beforeAll(() => {
    for (const file of E2E_FIXTURES) {
      try {
        fixtures.push(loadFixture(file));
      } catch (err) {
        console.warn(`Could not load fixture ${file}:`, err);
      }
    }
  });

  describe('Fixture Loading', () => {
    it('should load all 5 E2E fixtures', () => {
      expect(fixtures.length).toBe(5);
    });

    it('should parse all fixtures without errors', () => {
      for (const fixture of fixtures) {
        expect(fixture.domain).toBeDefined();
        expect(fixture.domain.kind).toBe('Domain');
        expect(fixture.domain.behaviors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Numeric Constraints (e2e-numeric)', () => {
    let fixture: LoadedFixture;

    beforeAll(() => {
      fixture = fixtures.find(f => f.name === 'e2e-numeric')!;
    });

    it('should generate boundary values for numeric fields', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateOrder');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, {
        seed: 12345,
        includeBoundary: true,
      });

      // Should have boundary tests
      const boundaryInputs = inputs.filter(i => i.category === 'boundary');
      expect(boundaryInputs.length).toBeGreaterThan(0);

      // Should have boundary values for amount (min: 0.01, max: 10000.00)
      const amountBoundaries = boundaryInputs.filter(i => i.name.includes('amount'));
      expect(amountBoundaries.some(i => i.values.amount === 0.01)).toBe(true); // at_min
      expect(amountBoundaries.some(i => i.values.amount === 10000.00)).toBe(true); // at_max

      // Should have boundary values for quantity (min: 1, max: 100)
      const quantityBoundaries = boundaryInputs.filter(i => i.name.includes('quantity'));
      expect(quantityBoundaries.some(i => i.values.quantity === 1)).toBe(true); // at_min
      expect(quantityBoundaries.some(i => i.values.quantity === 100)).toBe(true); // at_max
    });

    it('should generate deterministic values with same seed', () => {
      const behavior = fixture.domain.behaviors[0]!;
      const seed = 42;

      const inputs1 = synthesizeInputs(behavior, fixture.domain, { seed });
      const inputs2 = synthesizeInputs(behavior, fixture.domain, { seed });

      expect(inputs1.length).toBe(inputs2.length);
      for (let i = 0; i < inputs1.length; i++) {
        expect(inputs1[i]!.values).toEqual(inputs2[i]!.values);
      }
    });

    it('should record seed in data trace', () => {
      const behavior = fixture.domain.behaviors[0]!;
      const seed = 12345;

      const inputs = synthesizeInputs(behavior, fixture.domain, { seed });

      for (const input of inputs) {
        expect(input.dataTrace.seed).toBe(seed);
      }
    });
  });

  describe('String Constraints (e2e-string)', () => {
    let fixture: LoadedFixture;

    beforeAll(() => {
      fixture = fixtures.find(f => f.name === 'e2e-string')!;
    });

    it('should generate valid email format', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateProfile');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, { seed: 12345 });

      const validInputs = inputs.filter(i => i.category === 'valid');
      expect(validInputs.length).toBeGreaterThan(0);

      for (const input of validInputs) {
        const email = input.values.email as string;
        expect(email).toMatch(/@/);
        expect(email.length).toBeLessThanOrEqual(254);
      }
    });

    it('should generate boundary string lengths', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateProfile');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, {
        seed: 12345,
        includeBoundary: true,
      });

      const boundaryInputs = inputs.filter(i => i.category === 'boundary');
      
      // Should have username length boundaries (min: 3, max: 30)
      const usernameBoundaries = boundaryInputs.filter(i => i.name.includes('username'));
      expect(usernameBoundaries.length).toBeGreaterThan(0);
    });

    it('should generate invalid inputs for negative testing', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateProfile');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, {
        seed: 12345,
        includeInvalid: true,
      });

      const invalidInputs = inputs.filter(i => i.category === 'invalid');
      expect(invalidInputs.length).toBeGreaterThan(0);

      // Should have invalid email format
      const invalidEmails = invalidInputs.filter(i => i.name.includes('email') && i.name.includes('invalid'));
      expect(invalidEmails.length).toBeGreaterThan(0);
    });
  });

  describe('Collection Constraints (e2e-collection)', () => {
    let fixture: LoadedFixture;

    beforeAll(() => {
      fixture = fixtures.find(f => f.name === 'e2e-collection')!;
    });

    it('should generate array inputs for list fields', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateProduct');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, { seed: 12345 });

      const validInputs = inputs.filter(i => i.category === 'valid');
      expect(validInputs.length).toBeGreaterThan(0);

      for (const input of validInputs) {
        expect(Array.isArray(input.values.tags)).toBe(true);
        expect(Array.isArray(input.values.related_products)).toBe(true);
      }
    });

    it('should generate array boundary values', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'AddToCart');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, {
        seed: 12345,
        includeBoundary: true,
      });

      // Should have some inputs that test array boundaries
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Field Constraints (e2e-cross-field)', () => {
    let fixture: LoadedFixture;

    beforeAll(() => {
      fixture = fixtures.find(f => f.name === 'e2e-cross-field')!;
    });

    it('should extract cross-field constraints from preconditions', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreatePriceFilter');
      expect(behavior).toBeDefined();

      const constraints = extractCrossFieldConstraints(behavior!);
      
      // Should find: input.max_price >= input.min_price
      expect(constraints.length).toBeGreaterThan(0);
    });

    it('should generate valid inputs respecting cross-field constraints', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreatePriceFilter');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, { seed: 12345 });

      const validInputs = inputs.filter(i => i.category === 'valid');
      expect(validInputs.length).toBeGreaterThan(0);

      // All valid inputs should have max_price >= min_price
      for (const input of validInputs) {
        const minPrice = input.values.min_price as number;
        const maxPrice = input.values.max_price as number;
        expect(maxPrice).toBeGreaterThanOrEqual(minPrice);
      }
    });

    it('should generate cross-field violation tests', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreatePriceFilter');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, {
        seed: 12345,
        includePreconditionViolations: true,
      });

      const violations = inputs.filter(i => 
        i.category === 'precondition_violation' && 
        i.name.includes('cross_field')
      );
      
      // Should have violation tests for cross-field constraints
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Expected Outcomes (e2e-expected-outcomes)', () => {
    let fixture: LoadedFixture;

    beforeAll(() => {
      fixture = fixtures.find(f => f.name === 'e2e-expected-outcomes')!;
    });

    it('should compute expected values from postconditions', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateInvoice');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, { seed: 12345 });
      const validInput = inputs.find(i => i.category === 'valid');
      expect(validInput).toBeDefined();

      const outcome = synthesizeExpectedOutcome(behavior!, validInput!, fixture.domain);

      expect(outcome.shouldSucceed).toBe(true);
      expect(outcome.assertions.length).toBeGreaterThan(0);
      
      // Should have computed expectations from postconditions like:
      // Invoice.lookup(result.id).subtotal == input.subtotal
      expect(outcome.computedExpectations.length).toBeGreaterThan(0);
    });

    it('should include input values in computed expectations', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateInvoice');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, { seed: 12345 });
      const validInput = inputs.find(i => i.category === 'valid');
      expect(validInput).toBeDefined();

      const outcome = synthesizeExpectedOutcome(behavior!, validInput!, fixture.domain);

      // Should have computed expectation for subtotal matching input.subtotal
      const subtotalExpectation = outcome.computedExpectations.find(e => 
        e.path.includes('subtotal')
      );
      
      if (subtotalExpectation) {
        expect(subtotalExpectation.value).toBe(validInput!.values.subtotal);
      }
    });

    it('should generate error assertions for failure cases', () => {
      const behavior = fixture.domain.behaviors.find(b => b.name.name === 'CreateInvoice');
      expect(behavior).toBeDefined();

      const inputs = synthesizeInputs(behavior!, fixture.domain, {
        seed: 12345,
        includeInvalid: true,
      });

      const invalidInput = inputs.find(i => i.category === 'invalid');
      expect(invalidInput).toBeDefined();

      const outcome = synthesizeExpectedOutcome(behavior!, invalidInput!, fixture.domain);

      expect(outcome.shouldSucceed).toBe(false);
      expect(outcome.assertions.some(a => a.code.includes('success').toBe(false))).toBe(true);
    });
  });

  describe('Full Generation Pipeline', () => {
    it('should generate complete test files for all fixtures', () => {
      for (const fixture of fixtures) {
        const result = generateWithSynthesis(fixture.domain, {
          framework: 'vitest',
          useSynthesis: true,
          baseSeed: 12345,
          includeBoundary: true,
          includeNegativeTests: true,
          includePreconditionViolations: true,
        });

        expect(result.success).toBe(true);
        expect(result.files.length).toBeGreaterThan(0);

        // Should have test files for each behavior
        for (const behavior of fixture.domain.behaviors) {
          const testFile = result.files.find(f => 
            f.path.includes(`${behavior.name.name}.test.ts`)
          );
          expect(testFile).toBeDefined();
          expect(testFile!.content).toContain('describe');
          expect(testFile!.content).toContain('it(');
          expect(testFile!.content).toContain('expect');
        }
      }
    });

    it('should include data trace comments in generated tests', () => {
      const fixture = fixtures[0]!;
      const result = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
        baseSeed: 12345,
      });

      const testFile = result.files.find(f => f.type === 'test');
      expect(testFile).toBeDefined();
      expect(testFile!.content).toContain('@dataTrace');
      expect(testFile!.content).toContain('Seed:');
    });

    it('should generate valid TypeScript syntax', () => {
      const fixture = fixtures[0]!;
      const result = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
      });

      for (const file of result.files.filter(f => f.type === 'test')) {
        // Basic syntax checks
        expect(file.content).not.toContain('undefined undefined');
        expect(file.content).not.toContain('NaN');
        
        // Should have balanced braces
        const openBraces = (file.content.match(/{/g) || []).length;
        const closeBraces = (file.content.match(/}/g) || []).length;
        expect(openBraces).toBe(closeBraces);
      }
    });

    it('should track coverage statistics', () => {
      const fixture = fixtures[0]!;
      const result = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.stats.totalBehaviors).toBe(fixture.domain.behaviors.length);
      expect(result.metadata.stats.totalAssertions).toBeGreaterThan(0);
      expect(result.metadata.stats.supportedAssertions).toBeGreaterThan(0);
    });
  });

  describe('Deterministic Generation', () => {
    it('should produce identical output with same seed', () => {
      const fixture = fixtures[0]!;
      const seed = 99999;

      const result1 = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
        baseSeed: seed,
      });

      const result2 = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
        baseSeed: seed,
      });

      expect(result1.files.length).toBe(result2.files.length);
      
      for (let i = 0; i < result1.files.length; i++) {
        const file1 = result1.files[i]!;
        const file2 = result2.files[i]!;
        expect(file1.path).toBe(file2.path);
        // Content should be identical except for timestamps
        const content1 = file1.content.replace(/Generated: .+/g, 'Generated: [timestamp]');
        const content2 = file2.content.replace(/Generated: .+/g, 'Generated: [timestamp]');
        expect(content1).toBe(content2);
      }
    });

    it('should produce different output with different seeds', () => {
      const fixture = fixtures[0]!;

      const result1 = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
        baseSeed: 11111,
      });

      const result2 = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
        baseSeed: 22222,
      });

      const testFile1 = result1.files.find(f => f.type === 'test')!;
      const testFile2 = result2.files.find(f => f.type === 'test')!;

      // Some values should differ
      expect(testFile1.content).not.toBe(testFile2.content);
    });
  });
});

// ============================================================================
// SNAPSHOT TESTS FOR GENERATOR OUTPUT
// ============================================================================

describe('Generator Output Snapshots', () => {
  const fixtures: LoadedFixture[] = [];

  beforeAll(() => {
    for (const file of E2E_FIXTURES) {
      try {
        fixtures.push(loadFixture(file));
      } catch (err) {
        console.warn(`Could not load fixture ${file}:`, err);
      }
    }
  });

  for (const fixtureName of E2E_FIXTURES) {
    it(`should generate stable output for ${fixtureName}`, () => {
      const fixture = fixtures.find(f => f.path.includes(fixtureName));
      if (!fixture) {
        console.warn(`Fixture ${fixtureName} not loaded, skipping snapshot test`);
        return;
      }

      const result = generateWithSynthesis(fixture.domain, {
        framework: 'vitest',
        useSynthesis: true,
        baseSeed: 12345, // Fixed seed for reproducibility
      });

      // Get first test file for snapshot
      const testFile = result.files.find(f => f.type === 'test');
      expect(testFile).toBeDefined();

      // Replace timestamps with placeholder for stable snapshots
      const normalizedContent = testFile!.content
        .replace(/Generated: .+/g, 'Generated: [TIMESTAMP]')
        .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]');

      expect(normalizedContent).toMatchSnapshot();
    });
  }
});
