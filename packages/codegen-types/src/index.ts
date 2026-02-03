/**
 * @isl-lang/codegen-types
 *
 * TypeScript/Python type and validator generator from ISL.
 * Transforms ISL domain definitions into type-safe code with validation.
 *
 * @example
 * ```typescript
 * import { generate, generateDeterministicTypeScript } from '@isl-lang/codegen-types';
 *
 * // Standard generation
 * const result = generate(domain, { language: 'typescript', validation: true });
 *
 * // Deterministic generation (recommended for CI/CD)
 * const types = generateDeterministicTypeScript(domain, {
 *   sourcePath: 'domain/auth.isl',
 * });
 * ```
 */

// Standard generators
export { generate, CodeGenerator } from './generator.js';
export { generateTypeScript, TypeScriptGenerator } from './typescript.js';
export { generatePython, PythonGenerator } from './python.js';
export { generateZodValidation, ZodGenerator } from './validation.js';
export { generateSerdes, SerdesGenerator } from './serdes.js';

// Deterministic generator (recommended)
export {
  generateDeterministicTypeScript,
  DeterministicTypeScriptGenerator,
} from './deterministic-generator.js';

export type {
  GeneratorOptions,
  GeneratedFile,
  GeneratedOutput,
  Language,
  ValidationFramework,
} from './generator.js';

export type { DeterministicGeneratorOptions } from './deterministic-generator.js';
