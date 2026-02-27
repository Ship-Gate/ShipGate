# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPaddleBillingService, createPaddleBillingServiceFromEnv, PaddleBillingProvider
# dependencies: node:crypto

domain Paddle {
  version: "1.0.0"

  type PaddleBillingProvider = String

  invariants exports_present {
    - true
  }
}
