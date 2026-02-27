# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Postcondition, getPostconditions, POSTCONDITIONS_METADATA, PostconditionFn, PostconditionMetadata, PostconditionError
# dependencies: 

domain Postcondition {
  version: "1.0.0"

  type PostconditionFn = String
  type PostconditionMetadata = String
  type PostconditionError = String

  invariants exports_present {
    - true
  }
}
