# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: stripe, PRICE_IDS, PriceTier
# dependencies: stripe

domain Stripe {
  version: "1.0.0"

  type PriceTier = String

  invariants exports_present {
    - true
  }
}
