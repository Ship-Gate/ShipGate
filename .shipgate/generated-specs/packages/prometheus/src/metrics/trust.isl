# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TrustMetrics
# dependencies: prom-client

domain Trust {
  version: "1.0.0"

  type TrustMetrics = String

  invariants exports_present {
    - true
  }
}
