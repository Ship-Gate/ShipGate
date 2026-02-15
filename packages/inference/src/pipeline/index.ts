/**
 * 3-Tier Inference Pipeline
 *
 * Tier 1: Static signature extraction (always works)
 * Tier 2: Semantic rule inference (best-effort heuristics)
 * Tier 3: AI-assisted spec completion (only when needed)
 */

export { runPipeline, type PipelineOptions } from './pipeline.js';
export { extractStaticIR, type Tier1Options } from './tier1-static.js';
export { inferSemanticRules, type Tier2Options } from './tier2-semantic.js';
export { completeWithAI, type Tier3Options } from './tier3-ai.js';

export type {
  TypedIntentIR,
  IRSymbol,
  IRFunction,
  IRMethod,
  IRInterface,
  IRTypeAlias,
  IREnum,
  IRClass,
  IRParameter,
  IRTypeRef,
  IRProperty,
  IRThrownError,
  IRGuardClause,
  IRSideEffect,
  IRJSDoc,
  IRRuntimeHint,
  IRDocEntry,
  IRSourceLocation,
  IRProvenance,
  IRBaseSymbol,
  InferredRule,
  InferenceGap,
  Tier2Result,
  AICompletedRule,
  Tier3Result,
  PipelineResult,
  PipelineDiagnostic,
} from './ir.js';
