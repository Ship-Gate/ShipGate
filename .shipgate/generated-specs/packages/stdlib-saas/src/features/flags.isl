# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FeatureFlagStore, InMemoryFeatureFlagStore, FeatureFlagService
# dependencies: 

domain Flags {
  version: "1.0.0"

  type FeatureFlagStore = String
  type InMemoryFeatureFlagStore = String
  type FeatureFlagService = String

  invariants exports_present {
    - true
  }
}
