/**
 * ISL Spec Inference
 *
 * Infer ISL specifications from existing TypeScript/Python code.
 *
 * PRIMARY API: The 3-tier pipeline (pipeline/)
 *   Tier 1: Static signature extraction via TS compiler API
 *   Tier 2: Semantic rule inference (heuristics)
 *   Tier 3: AI-assisted spec completion (only when needed)
 *
 * LEGACY API: The original analyzer/extractors/generators (still exported)
 */

// ── Primary: 3-Tier Pipeline ─────────────────────────────────────────────────
export {
  runPipeline,
  extractStaticIR,
  inferSemanticRules,
  completeWithAI,
  type PipelineOptions,
  type Tier1Options,
  type Tier2Options,
  type Tier3Options,
  type TypedIntentIR,
  type IRSymbol,
  type IRFunction,
  type IRMethod,
  type IRInterface,
  type IRTypeAlias,
  type IREnum,
  type IRClass,
  type IRParameter,
  type IRTypeRef,
  type IRProperty,
  type IRThrownError,
  type IRGuardClause,
  type IRSideEffect,
  type IRJSDoc,
  type IRRuntimeHint,
  type IRDocEntry,
  type IRSourceLocation,
  type IRProvenance,
  type InferredRule,
  type InferenceGap,
  type Tier2Result,
  type AICompletedRule,
  type Tier3Result,
  type PipelineResult,
  type PipelineDiagnostic,
} from './pipeline/index.js';

// ── Legacy API (backward-compatible) ─────────────────────────────────────────
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
