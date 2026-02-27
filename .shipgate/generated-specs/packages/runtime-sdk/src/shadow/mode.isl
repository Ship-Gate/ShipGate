# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: shadowMode, shadowModeWithMetrics, ShadowOptions, ShadowDifference, ShadowResult, ShadowExecutor, ShadowStats
# dependencies: 

domain Mode {
  version: "1.0.0"

  type ShadowOptions = String
  type ShadowDifference = String
  type ShadowResult = String
  type ShadowExecutor = String
  type ShadowStats = String

  invariants exports_present {
    - true
  }
}
