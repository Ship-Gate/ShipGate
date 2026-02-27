# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createStripeBillingService, createStripeBillingServiceFromEnv, StripeBillingProvider
# dependencies: stripe

domain Stripe {
  version: "1.0.0"

  type StripeBillingProvider = String

  invariants exports_present {
    - true
  }
}
