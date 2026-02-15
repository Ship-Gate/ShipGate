# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ChangeType, ChangeSeverity, FieldChange, ClauseChange, ErrorChange, EntityDiff, InputDiff, OutputDiff, BehaviorDiff, TypeDiff, DiffSummary, DomainDiff, DiffOptions
# dependencies: 

domain DiffTypes {
  version: "1.0.0"

  type ChangeType = String
  type ChangeSeverity = String
  type FieldChange = String
  type ClauseChange = String
  type ErrorChange = String
  type EntityDiff = String
  type InputDiff = String
  type OutputDiff = String
  type BehaviorDiff = String
  type TypeDiff = String
  type DiffSummary = String
  type DomainDiff = String
  type DiffOptions = String

  invariants exports_present {
    - true
  }
}
