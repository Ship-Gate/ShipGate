# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RetentionPolicy, PurgeResult, PurgeCategoryError
# dependencies: 

domain Types {
  version: "1.0.0"

  type RetentionPolicy = String
  type PurgeResult = String
  type PurgeCategoryError = String

  invariants exports_present {
    - true
  }
}
