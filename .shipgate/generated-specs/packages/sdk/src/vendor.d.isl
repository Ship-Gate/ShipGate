# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: scoreSpec, DimensionScore, QualitySuggestion, SpecQualityReport, SpecQualityOptions
# dependencies: 

domain VendorD {
  version: "1.0.0"

  type DimensionScore = String
  type QualitySuggestion = String
  type SpecQualityReport = String
  type SpecQualityOptions = String

  invariants exports_present {
    - true
  }
}
