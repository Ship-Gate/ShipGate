# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: calculateCoverage, compareCoverage, analyzeCoverageGaps, formatCoverage, formatCoverageTable, TestCaseResult, TestCategory, CoverageMetrics, CategoryCoverage, CoverageResult, DivergentTest, CoverageComparison, CoverageOptions, CoverageGap
# dependencies: 

domain Coverage {
  version: "1.0.0"

  type TestCaseResult = String
  type TestCategory = String
  type CoverageMetrics = String
  type CategoryCoverage = String
  type CoverageResult = String
  type DivergentTest = String
  type CoverageComparison = String
  type CoverageOptions = String
  type CoverageGap = String

  invariants exports_present {
    - true
  }
}
