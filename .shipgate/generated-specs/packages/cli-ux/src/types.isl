# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_RENDER_OPTIONS, ClauseStatus, ImpactLevel, ClauseCategory, Recommendation, ClauseResult, CategoryScore, CategoryBreakdown, VerificationResult, RenderOptions, JsonOutput, GroupedFailures, ReproCommand
# dependencies: 

domain Types {
  version: "1.0.0"

  type ClauseStatus = String
  type ImpactLevel = String
  type ClauseCategory = String
  type Recommendation = String
  type ClauseResult = String
  type CategoryScore = String
  type CategoryBreakdown = String
  type VerificationResult = String
  type RenderOptions = String
  type JsonOutput = String
  type GroupedFailures = String
  type ReproCommand = String

  invariants exports_present {
    - true
  }
}
