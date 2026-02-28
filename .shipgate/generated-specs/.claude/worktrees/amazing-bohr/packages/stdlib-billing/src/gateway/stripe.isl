# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: StripeAdapterConfig, StripeGatewayAdapter
# dependencies: 

domain Stripe {
  version: "1.0.0"

  type StripeAdapterConfig = String
  type StripeGatewayAdapter = String

  invariants exports_present {
    - true
  }
}
