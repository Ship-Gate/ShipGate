# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTieredPolicy, createStandardTieredPolicy, TieredPolicyImpl, TierFactory
# dependencies: 

domain Tiered {
  version: "1.0.0"

  type TieredPolicyImpl = String
  type TierFactory = String

  invariants exports_present {
    - true
  }
}
