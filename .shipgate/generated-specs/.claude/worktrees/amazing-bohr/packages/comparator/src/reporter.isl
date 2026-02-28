# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateRecommendations, generateOverallRecommendation, generateTextReport, generateMarkdownReport, generateJSONReport, generateReport, ImplementationInfo, ComparisonResult, Recommendation, ReportOptions
# dependencies: 

domain Reporter {
  version: "1.0.0"

  type ImplementationInfo = String
  type ComparisonResult = String
  type Recommendation = String
  type ReportOptions = String

  invariants exports_present {
    - true
  }
}
