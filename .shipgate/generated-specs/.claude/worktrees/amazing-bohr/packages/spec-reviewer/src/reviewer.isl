# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: review, ReviewOptions, ReviewCategory, ReviewResult, CategoryResult, Issue, Suggestion, SourceLocation, SpecReviewer
# dependencies: 

domain Reviewer {
  version: "1.0.0"

  type ReviewOptions = String
  type ReviewCategory = String
  type ReviewResult = String
  type CategoryResult = String
  type Issue = String
  type Suggestion = String
  type SourceLocation = String
  type SpecReviewer = String

  invariants exports_present {
    - true
  }
}
