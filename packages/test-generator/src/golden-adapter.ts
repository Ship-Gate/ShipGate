// ============================================================================
// Golden Testing Harness Adapter
// ============================================================================
//
// Adapter to integrate test-generator with @isl-lang/codegen-harness
// for deterministic golden file testing.
// ============================================================================

import type { Domain } from '@isl-lang/parser';
import { generate } from './generator';
import type { TestFramework } from './types';

// Types compatible with codegen-harness
export interface CodeGenerator {
  readonly name: string;
  readonly extension: string;
  generate(domain: Domain): GeneratedFile[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

/**
 * Create a CodeGenerator adapter for test-generator
 * 
 * This adapter makes test-generator compatible with the golden testing harness
 * by implementing the CodeGenerator interface.
 */
export function createTestGeneratorAdapter(
  framework: TestFramework = 'vitest'
): CodeGenerator {
  return {
    name: `test-${framework}`,
    extension: '.test.ts',
    generate(domain: Domain): GeneratedFile[] {
      const result = generate(domain, {
        framework,
        outputDir: '.', // Will be adjusted by harness
        includeHelpers: true,
        emitMetadata: false, // Don't emit metadata for golden tests
      });

      if (!result.success) {
        // Return empty array on error (harness will handle)
        return [];
      }

      // Filter out config files and metadata - only return test files
      return result.files
        .filter((file: { type: string }) => file.type === 'test' || file.type === 'helper' || file.type === 'fixture')
        .map((file: { path: string; content: string }) => ({
          path: file.path,
          content: file.content,
        }));
    },
  };
}

/**
 * Vitest test generator for golden testing
 */
export const vitestGenerator: CodeGenerator = createTestGeneratorAdapter('vitest');

/**
 * Jest test generator for golden testing
 */
export const jestGenerator: CodeGenerator = createTestGeneratorAdapter('jest');
