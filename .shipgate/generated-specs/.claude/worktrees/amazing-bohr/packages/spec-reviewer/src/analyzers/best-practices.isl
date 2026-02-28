# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: analyzeBestPractices, BestPracticeIssue, BestPracticesResult
# dependencies: 

domain BestPractices {
  version: "1.0.0"

  type BestPracticeIssue = String
  type BestPracticesResult = String

  invariants exports_present {
    - true
  }
}
