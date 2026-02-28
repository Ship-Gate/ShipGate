# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createWeakeningGuard, containsWeakening, validatePatchSafe, WEAKENING_PATTERNS, WeakeningGuardOptions, WeakeningGuard, WeakeningError
# dependencies: 

domain WeakeningGuard {
  version: "1.0.0"

  type WeakeningGuardOptions = String
  type WeakeningGuard = String
  type WeakeningError = String

  invariants exports_present {
    - true
  }
}
