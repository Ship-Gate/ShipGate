# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDefaultRegistry, BUILTIN_RECIPES, FixRecipeRegistryImpl
# dependencies: crypto, @/lib/captcha

domain RecipeRegistry {
  version: "1.0.0"

  type FixRecipeRegistryImpl = String

  invariants exports_present {
    - true
  }
}
