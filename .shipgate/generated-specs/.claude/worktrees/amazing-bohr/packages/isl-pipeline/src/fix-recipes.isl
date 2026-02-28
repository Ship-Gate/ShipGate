# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateFixPreview, generateAllFixPreviews, applyFixRecipe, FIX_RECIPE_CATALOG, FixRecipe, FixPatch, FixRecipeContext, ValidationResult, FixPreview, PatchPreview, rateLimitRecipe, auditRecipe, noPiiLoggingRecipe, inputValidationRecipe, encryptionRecipe
# dependencies: @/lib/rate-limit, @/lib/audit, zod, @/lib/logger, @/lib/encryption, bcrypt

domain FixRecipes {
  version: "1.0.0"

  type FixRecipe = String
  type FixPatch = String
  type FixRecipeContext = String
  type ValidationResult = String
  type FixPreview = String
  type PatchPreview = String

  invariants exports_present {
    - true
  }
}
