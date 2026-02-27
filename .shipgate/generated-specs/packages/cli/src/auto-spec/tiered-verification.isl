# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: classifyTier, isRelaxedTier, DEFAULT_TIER_CONFIG, VerificationTier, TierConfig
# dependencies: fs/promises

domain TieredVerification {
  version: "1.0.0"

  type VerificationTier = String
  type TierConfig = String

  invariants exports_present {
    - true
  }
}
