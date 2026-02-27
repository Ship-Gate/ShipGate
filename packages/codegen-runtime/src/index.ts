/**
 * @isl-lang/codegen-runtime
 * 
 * Generate self-verifying TypeScript code from ISL specifications.
 * The generated code includes runtime checks for:
 * - Preconditions (validated before execution)
 * - Postconditions (validated after execution)
 * - Invariants (validated before and after)
 */

export { generate, generateBehavior } from './generator.js';
export { compileExpression, compileAssertions } from './expression-compiler.js';
export { generateRuntimeHelpers } from './helpers.js';

export type {
  GenerateOptions,
  GeneratedFile,
  InstrumentationMode,
  RuntimeConfig,
} from './types.js';
