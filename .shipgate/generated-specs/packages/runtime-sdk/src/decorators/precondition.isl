# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Precondition, getPreconditions, PRECONDITIONS_METADATA, PreconditionFn, PreconditionMetadata, PreconditionError
# dependencies: 

domain Precondition {
  version: "1.0.0"

  type PreconditionFn = String
  type PreconditionMetadata = String
  type PreconditionError = String

  invariants exports_present {
    - true
  }
}
