/**
 * ISL Compiler
 * 
 * Compilation targets for ISL: TypeScript types, tests, scaffolds.
 */

export * from './typescript/index.js';
export * from './tests/index.js';
export * from './imports.js';

import type { DomainDeclaration } from '@isl-lang/isl-core';
import { generateTypes, type GeneratedTypes, type TypeGeneratorOptions } from './typescript/index.js';
import { generateTests, type GeneratedTests, type TestGeneratorOptions } from './tests/index.js';
import { resolveImports, getAvailableLibraries, getLibraryInfo } from './imports.js';

export interface CompileOptions {
  types?: TypeGeneratorOptions;
  tests?: TestGeneratorOptions;
}

export interface CompileResult {
  types: GeneratedTypes;
  tests: GeneratedTests;
}

/**
 * Compile an ISL domain to TypeScript types and tests
 */
export function compile(domain: DomainDeclaration, options?: CompileOptions): CompileResult {
  return {
    types: generateTypes(domain, options?.types),
    tests: generateTests(domain, options?.tests),
  };
}

/**
 * Pre-process ISL source to resolve imports before parsing
 */
export function preprocessSource(source: string): { 
  source: string; 
  imports: string[];
  errors: string[];
} {
  const result = resolveImports(source);
  return {
    source: result.mergedSource,
    imports: result.imports.map(i => i.name),
    errors: result.errors,
  };
}

/**
 * List available standard libraries
 */
export { getAvailableLibraries, getLibraryInfo };
