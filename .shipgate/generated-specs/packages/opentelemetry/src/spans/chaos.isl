# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: withChaosSpan, createChaosSpan, ChaosUtils, ChaosSpanConfig, ChaosResult, ChaosSpan, ChaosSpanBuilder
# dependencies: @opentelemetry/api

domain Chaos {
  version: "1.0.0"

  type ChaosSpanConfig = String
  type ChaosResult = String
  type ChaosSpan = String
  type ChaosSpanBuilder = String

  invariants exports_present {
    - true
  }
}
