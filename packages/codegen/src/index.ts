/**
 * @isl-lang/codegen - ISL Code Generators
 *
 * Umbrella package that re-exports all ISL code generators.
 * Each generator is exported under its own namespace to avoid conflicts.
 *
 * @example
 * ```ts
 * // Import everything
 * import * as codegen from '@isl-lang/codegen';
 * codegen.python.generate(ast, options);
 *
 * // Or import specific generators for tree-shaking
 * import { python, openapi } from '@isl-lang/codegen';
 * python.generate(ast, options);
 * ```
 */

// Re-export generators as namespaces to avoid naming conflicts
import * as pythonGenerator from '@isl-lang/codegen-python';
import * as openapiGenerator from '@isl-lang/codegen-openapi';
import * as graphqlGenerator from '@isl-lang/codegen-graphql';
import * as typesGenerator from '@isl-lang/codegen-types';
import * as rustGenerator from '@isl-lang/codegen-rust';
import * as goGenerator from '@isl-lang/codegen-go';
import * as validatorsGenerator from '@isl-lang/codegen-validators';
import * as testsGenerator from '@isl-lang/codegen-tests';
import * as mocksGenerator from '@isl-lang/codegen-mocks';
import * as docsGenerator from '@isl-lang/codegen-docs';

// Export as namespaces
export const python = pythonGenerator;
export const openapi = openapiGenerator;
export const graphql = graphqlGenerator;
export const types = typesGenerator;
export const rust = rustGenerator;
export const go = goGenerator;
export const validators = validatorsGenerator;
export const tests = testsGenerator;
export const mocks = mocksGenerator;
export const docs = docsGenerator;

// Also export types that are commonly shared (from types package)
export type { GeneratorOptions, GeneratedFile } from '@isl-lang/codegen-types';
