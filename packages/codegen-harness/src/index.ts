/**
 * @isl-lang/codegen-harness
 *
 * Golden output + compile-check harness for ISL code generators.
 * Ensures codegen changes always produce stable, valid output.
 */

export type { CodeGenerator, GeneratedFile, GoldenComparisonResult } from './types.js';
export {
  ALL_GENERATORS,
  getGenerator,
  typescriptGenerator,
  rustGenerator,
  goGenerator,
  openapiGenerator,
} from './generators.js';
