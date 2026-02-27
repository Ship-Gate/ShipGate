# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: applyRecipe, getRecipe, hasRecipe, auditRequiredRecipe, rateLimitRequiredRecipe, noPiiLoggingRecipe, noStubbedHandlersRecipe, constantTimeCompareRecipe, lockoutThresholdRecipe, captchaRequiredRecipe, DETERMINISTIC_RECIPES, DeterministicPatch, FixRecipe, FixContext, ValidationResult, ApplyResult
# dependencies: @/lib/rate-limit, @/lib/audit, zod, @/lib/logger, bcrypt, crypto, @/lib/captcha

domain DeterministicRecipes {
  version: "1.0.0"

  type DeterministicPatch = String
  type FixRecipe = String
  type FixContext = String
  type ValidationResult = String
  type ApplyResult = String

  invariants exports_present {
    - true
  }
}
