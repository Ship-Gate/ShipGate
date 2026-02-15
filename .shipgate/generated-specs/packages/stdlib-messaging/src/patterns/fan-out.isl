# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: FanOutFilters, FanOutTransforms, FanOutPattern, FanOutBuilder
# dependencies: 

domain FanOut {
  version: "1.0.0"

  type FanOutPattern = String
  type FanOutBuilder = String

  invariants exports_present {
    - true
  }
}
