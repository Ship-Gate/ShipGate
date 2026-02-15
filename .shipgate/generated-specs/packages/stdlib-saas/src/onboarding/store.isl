# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: OnboardingStore, InMemoryOnboardingStore
# dependencies: 

domain Store {
  version: "1.0.0"

  type OnboardingStore = String
  type InMemoryOnboardingStore = String

  invariants exports_present {
    - true
  }
}
