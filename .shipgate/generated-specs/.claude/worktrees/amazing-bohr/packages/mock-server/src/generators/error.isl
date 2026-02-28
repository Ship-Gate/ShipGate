# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ErrorGeneratorOptions, ErrorDefinition, ErrorResponse, ErrorGenerator
# dependencies: 

domain Error {
  version: "1.0.0"

  type ErrorGeneratorOptions = String
  type ErrorDefinition = String
  type ErrorResponse = String
  type ErrorGenerator = String

  invariants exports_present {
    - true
  }
}
