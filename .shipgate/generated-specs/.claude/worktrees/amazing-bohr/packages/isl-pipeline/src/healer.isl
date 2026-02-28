# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getFrameworkAdapter, healUntilShip, __isl_intents, FIX_CATALOG, hasIntentExport, GateVerdict, Violation, GateResult, HealOptions, HealIteration, HealResult, Patch, PatchRecord, FixRecipe, FixContext, FrameworkAdapter, ISLHealer
# dependencies: @isl-lang/proof, @/lib/rate-limit, @/lib/audit, zod

domain Healer {
  version: "1.0.0"

  type GateVerdict = String
  type Violation = String
  type GateResult = String
  type HealOptions = String
  type HealIteration = String
  type HealResult = String
  type Patch = String
  type PatchRecord = String
  type FixRecipe = String
  type FixContext = String
  type FrameworkAdapter = String
  type ISLHealer = String

  invariants exports_present {
    - true
  }
}
