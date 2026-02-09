/**
 * Shadow Spec — Specless ISL Inference
 *
 * Re-exports the heuristic shadow spec generator (default) and
 * the optional AI-powered shadow spec generator (requires API key).
 *
 * @module @isl-lang/gate/specless
 */

export {
  // Main entry (heuristic — default)
  generateShadowSpec,

  // Source parser
  parseSource,

  // Recognizer registry
  recognizers,
} from './shadow-spec.js';

export type {
  // Types
  ShadowSpec,
  PatternMatch,
  PatternRecognizer,
  SourceAST,
  FunctionInfo,
  ImportInfo,
  RouteHandlerInfo,
} from './shadow-spec.js';

// ── AI-powered shadow spec generator (opt-in) ──────────────────────────
export {
  generateShadowSpecAI,
  resolveConfig as resolveAIConfig,
  estimateConfidence,
  cleanISLOutput,
  validateISL,
  callLLM,
  generateWithRetry,
  shouldSkipFile,
  isRateLimited,
  resetVerifyCounter,
  resetRateLimiter,
  DEFAULT_RATE_LIMITS,
} from './shadow-spec-ai.js';

export type {
  AIProvider,
  AISpecGeneratorConfig,
  AISpecContext,
  RateLimitConfig,
} from './shadow-spec-ai.js';
