# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: classifyChange, classifyAllChanges, getCategoryLabel, getBreakingLevelLabel, getBreakingLevelColor, ChangeCategory, ClassifiedChange, ChangeClassification, ClassificationSummary
# dependencies: 

domain Classifier {
  version: "1.0.0"

  type ChangeCategory = String
  type ClassifiedChange = String
  type ChangeClassification = String
  type ClassificationSummary = String

  invariants exports_present {
    - true
  }
}
