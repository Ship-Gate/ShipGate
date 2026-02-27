# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CatalogOptions, CatalogStats, ErrorCatalog, ValidationResult, ValidationIssue
# dependencies: 

domain Catalog {
  version: "1.0.0"

  type CatalogOptions = String
  type CatalogStats = String
  type ErrorCatalog = String
  type ValidationResult = String
  type ValidationIssue = String

  invariants exports_present {
    - true
  }
}
