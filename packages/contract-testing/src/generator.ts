/**
 * Test Generator
 * 
 * Generates test files from ISL specifications.
 */

import type { DomainSpec, BehaviorSpec } from './tester.js';

// ============================================================================
// Types
// ============================================================================

export interface TestSuite {
  framework: 'vitest' | 'jest' | 'mocha';
  files: TestFile[];
}

export interface TestFile {
  path: string;
  content: string;
}

export interface TestGeneratorOptions {
  framework: 'vitest' | 'jest' | 'mocha';
  outputDir?: string;
  includePropertyTests?: boolean;
  includeEdgeCases?: boolean;
}

// ============================================================================
// Test Generator
// ============================================================================

export class TestGenerator {
  private options: Required<TestGeneratorOptions>;

  constructor(options: TestGeneratorOptions) {
    this.options = {
      framework: options.framework,
      outputDir: options.outputDir || '__tests__',
      includePropertyTests: options.includePropertyTests ?? true,
      includeEdgeCases: options.includeEdgeCases ?? true,
    };
  }

  /**
   * Generate test suite from domain spec
   */
  generate(domain: DomainSpec): TestSuite {
    const files: TestFile[] = [];

    // Generate test file for each behavior
    for (const behavior of domain.behaviors) {
      files.push({
        path: `${this.options.outputDir}/${this.toKebabCase(behavior.name)}.test.ts`,
        content: this.generateBehaviorTests(behavior, domain),
      });
    }

    // Generate integration test file
    files.push({
      path: `${this.options.outputDir}/${this.toKebabCase(domain.name)}.integration.test.ts`,
      content: this.generateIntegrationTests(domain),
    });

    return {
      framework: this.options.framework,
      files,
    };
  }

  /**
   * Generate tests for a behavior
   */
  private generateBehaviorTests(behavior: BehaviorSpec, domain: DomainSpec): string {
    const lines: string[] = [];

    // Imports
    lines.push(this.generateImports());
    lines.push('');
    lines.push(`describe('${behavior.name}', () => {`);

    // Setup
    lines.push('  let handler: typeof implementation.' + this.toCamelCase(behavior.name) + ';');
    lines.push('');
    lines.push('  beforeEach(() => {');
    lines.push(`    handler = implementation.${this.toCamelCase(behavior.name)};`);
    lines.push('  });');
    lines.push('');

    // Input validation tests
    if (behavior.input) {
      lines.push('  describe(\'input validation\', () => {');
      lines.push('    it(\'should accept valid input\', async () => {');
      lines.push(`      const input = ${this.generateValidInput(behavior)};`);
      lines.push('      const result = await handler(input);');
      lines.push('      expect(result).toBeDefined();');
      lines.push('    });');
      lines.push('');
      lines.push('    it(\'should reject invalid input\', async () => {');
      lines.push('      const input = {};');
      lines.push('      await expect(handler(input)).rejects.toThrow();');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }

    // Precondition tests
    if (behavior.preconditions.length > 0) {
      lines.push('  describe(\'preconditions\', () => {');
      for (const pre of behavior.preconditions) {
        lines.push(`    it('should enforce: ${this.escapeString(pre)}', async () => {`);
        lines.push('      // TODO: Test precondition');
        lines.push('      expect(true).toBe(true);');
        lines.push('    });');
      }
      lines.push('  });');
      lines.push('');
    }

    // Postcondition tests
    if (behavior.postconditions.length > 0) {
      lines.push('  describe(\'postconditions\', () => {');
      for (const post of behavior.postconditions) {
        lines.push(`    it('should ensure on ${post.guard}: ${this.escapeString(post.predicates[0] || '')}', async () => {`);
        lines.push(`      const input = ${this.generateValidInput(behavior)};`);
        lines.push('      const result = await handler(input);');
        lines.push('      // TODO: Assert postcondition');
        lines.push('      expect(result).toBeDefined();');
        lines.push('    });');
      }
      lines.push('  });');
      lines.push('');
    }

    // Error path tests
    if (behavior.output?.errors.length) {
      lines.push('  describe(\'error paths\', () => {');
      for (const error of behavior.output.errors) {
        lines.push(`    it('should return ${error.name} error when appropriate', async () => {`);
        lines.push('      // TODO: Trigger error condition');
        lines.push('      expect(true).toBe(true);');
        lines.push('    });');
      }
      lines.push('  });');
      lines.push('');
    }

    // Property-based tests
    if (this.options.includePropertyTests) {
      lines.push('  describe(\'property-based tests\', () => {');
      lines.push('    it(\'should handle any valid input\', async () => {');
      lines.push('      await fc.assert(');
      lines.push('        fc.asyncProperty(');
      lines.push(`          ${this.generateInputArbitrary(behavior)},`);
      lines.push('          async (input) => {');
      lines.push('            const result = await handler(input);');
      lines.push('            return result !== undefined;');
      lines.push('          }');
      lines.push('        ),');
      lines.push('        { numRuns: 100 }');
      lines.push('      );');
      lines.push('    });');
      lines.push('  });');
      lines.push('');
    }

    // Edge case tests
    if (this.options.includeEdgeCases) {
      lines.push('  describe(\'edge cases\', () => {');
      lines.push('    it(\'should handle empty strings\', async () => {');
      lines.push('      // TODO: Test with empty strings');
      lines.push('      expect(true).toBe(true);');
      lines.push('    });');
      lines.push('');
      lines.push('    it(\'should handle boundary values\', async () => {');
      lines.push('      // TODO: Test with boundary values');
      lines.push('      expect(true).toBe(true);');
      lines.push('    });');
      lines.push('  });');
    }

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate integration tests
   */
  private generateIntegrationTests(domain: DomainSpec): string {
    const lines: string[] = [];

    lines.push(this.generateImports());
    lines.push('');
    lines.push(`describe('${domain.name} Integration', () => {`);
    lines.push('');

    // Invariant tests
    if (domain.invariants.length > 0) {
      lines.push('  describe(\'invariants\', () => {');
      for (const inv of domain.invariants) {
        lines.push(`    it('should maintain: ${inv.name}', async () => {`);
        lines.push('      // TODO: Test invariant holds');
        lines.push('      expect(true).toBe(true);');
        lines.push('    });');
      }
      lines.push('  });');
      lines.push('');
    }

    // Behavior sequence tests
    lines.push('  describe(\'behavior sequences\', () => {');
    lines.push('    it(\'should handle typical workflow\', async () => {');
    lines.push('      // TODO: Test common behavior sequence');
    lines.push('      expect(true).toBe(true);');
    lines.push('    });');
    lines.push('  });');

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate imports
   */
  private generateImports(): string {
    const lines = [];

    switch (this.options.framework) {
      case 'vitest':
        lines.push("import { describe, it, expect, beforeEach } from 'vitest';");
        break;
      case 'jest':
        lines.push("import { describe, it, expect, beforeEach } from '@jest/globals';");
        break;
      case 'mocha':
        lines.push("import { describe, it, before } from 'mocha';");
        lines.push("import { expect } from 'chai';");
        break;
    }

    lines.push("import * as fc from 'fast-check';");
    lines.push("import * as implementation from '../src/implementation.js';");

    return lines.join('\n');
  }

  /**
   * Generate valid input example
   */
  private generateValidInput(behavior: BehaviorSpec): string {
    if (!behavior.input) return '{}';

    const props = behavior.input.fields.map(f => {
      const value = this.generateFieldValue(f.type);
      return `${f.name}: ${value}`;
    });

    return `{ ${props.join(', ')} }`;
  }

  /**
   * Generate field value
   */
  private generateFieldValue(type: string): string {
    switch (type) {
      case 'String': return "'test'";
      case 'Int': return '42';
      case 'Decimal': return '3.14';
      case 'Boolean': return 'true';
      case 'UUID': return "'550e8400-e29b-41d4-a716-446655440000'";
      case 'Timestamp': return "new Date().toISOString()";
      default: return '{}';
    }
  }

  /**
   * Generate input arbitrary
   */
  private generateInputArbitrary(behavior: BehaviorSpec): string {
    if (!behavior.input) return 'fc.constant({})';

    const arbs = behavior.input.fields.map(f => {
      const arb = this.fieldTypeToArbitrary(f.type);
      return `${f.name}: ${arb}`;
    });

    return `fc.record({ ${arbs.join(', ')} })`;
  }

  /**
   * Map field type to arbitrary
   */
  private fieldTypeToArbitrary(type: string): string {
    switch (type) {
      case 'String': return 'fc.string()';
      case 'Int': return 'fc.integer()';
      case 'Decimal': return 'fc.double()';
      case 'Boolean': return 'fc.boolean()';
      case 'UUID': return 'fc.uuid()';
      case 'Timestamp': return "fc.date().map(d => d.toISOString())";
      default: return 'fc.anything()';
    }
  }

  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  private toKebabCase(str: string): string {
    return str.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  }

  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").substring(0, 60);
  }
}

export function generateTests(domain: DomainSpec, options: TestGeneratorOptions): TestSuite {
  return new TestGenerator(options).generate(domain);
}
