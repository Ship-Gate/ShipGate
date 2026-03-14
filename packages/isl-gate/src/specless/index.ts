/**
 * Shadow Spec — Specless ISL Inference
 *
 * Re-exports the heuristic shadow spec generator (default) and
 * the optional AI-powered shadow spec generator (requires API key).
 *
 * Side-effect imports below auto-register all built-in specless check
 * adapters when this module is loaded.
 *
 * @module @isl-lang/gate/specless
 */

// Auto-register built-in specless check adapters
import './hallucination-adapter.js';
import './security-adapter.js';
import './firewall-adapter.js';
import './mock-detector-adapter.js';
import './fake-success-adapter.js';
import './phantom-deps-adapter.js';
import './auth-drift-adapter.js';
import './taint-adapter.js';
import './supply-chain-adapter.js';
import './semgrep-adapter.js';

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
