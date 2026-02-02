/**
 * ISL Pipeline
 * 
 * Complete flow: NL → ISL → Code → Gate → Proof
 * 
 * Includes self-healing: keeps iterating until code passes the gate.
 * 
 * @module @isl-lang/pipeline
 */

export {
  ISLPipeline,
  createPipeline,
  runPipeline,
} from './pipeline.js';

export type {
  PipelineInput,
  PipelineOptions,
  PipelineResult,
} from './pipeline.js';

// Self-healing pipeline (legacy)
export {
  SelfHealingPipeline,
  selfHeal,
} from './self-healing.js';

export type {
  HealingResult,
  HealingIteration,
  HealingOptions,
} from './self-healing.js';

// Robust healer with contract enforcement
export {
  ISLHealer,
  healUntilShip,
  FIX_CATALOG,
  getFrameworkAdapter,
} from './healer.js';

export type {
  HealResult,
  HealIteration,
  HealOptions,
  GateResult,
  GateVerdict,
  Violation,
  Patch,
  FixRecipe,
  FrameworkAdapter,
} from './healer.js';

// Semantic healer (production-grade)
export {
  SemanticHealer,
  healSemantically,
} from './semantic-healer.js';

export type {
  SemanticHealResult,
  SemanticHealIteration,
  SemanticHealOptions,
} from './semantic-healer.js';

// Semantic rules
export {
  SEMANTIC_RULES,
  runSemanticRules,
  checkProofCompleteness,
} from './semantic-rules.js';

export type {
  SemanticViolation,
  SemanticRule,
  ProofCompletenessResult,
} from './semantic-rules.js';

// Fingerprint and stuck detection
export {
  stableFingerprint,
  computeViolationFingerprint,
  normalizeMessage,
  normalizeSpan,
  FingerprintTracker,
  fingerprintsEqual,
  hasViolationsChanged,
  violationsDiffSummary,
} from './fingerprint.js';

export type {
  ViolationLike,
  FingerprintOptions,
  StuckDetectionConfig,
  AbortReason,
  AbortCondition,
} from './fingerprint.js';

// Production code templates
export {
  generateNextJSRoute,
  generateTests,
} from './code-templates.js';

export type {
  TemplateContext,
} from './code-templates.js';

// Re-export from dependencies for convenience
export { createTranslator, type ISLAST, type RepoContext, type TranslationResult } from '@isl-lang/translator';
export { createGenerator, type GenerationResult, type ProofLink, type FileDiff } from '@isl-lang/generator';
export { createProofBundle, formatProofBundle, type ProofBundle } from '@isl-lang/proof';
