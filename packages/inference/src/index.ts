/**
 * ISL Spec Inference
 *
 * Infer ISL specifications from existing TypeScript/Python code.
 */

export { infer, type InferOptions, type InferResult } from './analyzer.js';
export { parseTypeScript, type TypeScriptParseResult } from './parsers/typescript.js';
export { parsePython, type PythonParseResult } from './parsers/python.js';
export {
  extractTypes,
  extractFunctions,
  extractValidations,
  extractFromTests,
} from './extractors/index.js';
export {
  generateEntities,
  generateBehaviors,
  inferInvariants,
} from './generators/index.js';
export { enhanceWithAI, type EnhancerOptions } from './ai/enhancer.js';
