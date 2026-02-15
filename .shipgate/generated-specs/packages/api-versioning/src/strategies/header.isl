# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: extractVersionFromHeader, buildVersionedHeaders, buildVersionedAcceptHeader, headerStrategy, HeaderStrategyOptions
# dependencies: 

domain Header {
  version: "1.0.0"

  type HeaderStrategyOptions = String

  invariants exports_present {
    - true
  }
}
