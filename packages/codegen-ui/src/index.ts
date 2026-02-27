/**
 * @isl-lang/codegen-ui
 * 
 * UI code generation from ISL blueprints.
 * Generates safe, accessible Next.js landing pages.
 * 
 * @module @isl-lang/codegen-ui
 */

export { generateLandingPage } from './generator.js';
export { checkBlueprintSafety, toGateFindings } from './safety-checker.js';
export type {
  UIGeneratorOptions,
  GeneratedFile,
  UIGenerationResult,
  UIGenerationError,
  UIGenerationWarning,
  SafetyCheckResult,
  SafetyCheck,
  ResolvedToken,
} from './types.js';
