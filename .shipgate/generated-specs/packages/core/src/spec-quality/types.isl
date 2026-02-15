# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_WEIGHTS, QualityDimension, DimensionScore, QualitySuggestion, SpecQualityReport, DimensionChecker, DimensionCheckResult, SpecQualityOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type QualityDimension = String
  type DimensionScore = String
  type QualitySuggestion = String
  type SpecQualityReport = String
  type DimensionChecker = String
  type DimensionCheckResult = String
  type SpecQualityOptions = String

  invariants exports_present {
    - true
  }
}
