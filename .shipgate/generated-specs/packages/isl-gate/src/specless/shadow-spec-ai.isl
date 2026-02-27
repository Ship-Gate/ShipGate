# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: shouldSkipFile, isRateLimited, resetVerifyCounter, resetRateLimiter, resolveConfig, callLLM, cleanISLOutput, validateISL, estimateConfidence, generateWithRetry, generateShadowSpecAI, DEFAULT_RATE_LIMITS, AIProvider, AISpecGeneratorConfig, AISpecContext, RateLimitConfig
# dependencies: @isl-lang/parser

domain ShadowSpecAi {
  version: "1.0.0"

  type AIProvider = String
  type AISpecGeneratorConfig = String
  type AISpecContext = String
  type RateLimitConfig = String

  invariants exports_present {
    - true
  }
}
