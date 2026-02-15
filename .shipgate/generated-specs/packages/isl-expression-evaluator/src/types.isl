# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: triStateToBoolean, triStateAnd, triStateOr, triStateNot, triStateImplies, isUnknown, wrapValue, TriState, MaybeUnknown, Value, ProvenanceSource, Provenance, EvaluationResult, Diagnostic, ExpressionAdapter, DefaultAdapter, EvaluationContext, EvaluationError
# dependencies: 

domain Types {
  version: "1.0.0"

  type TriState = String
  type MaybeUnknown = String
  type Value = String
  type ProvenanceSource = String
  type Provenance = String
  type EvaluationResult = String
  type Diagnostic = String
  type ExpressionAdapter = String
  type DefaultAdapter = String
  type EvaluationContext = String
  type EvaluationError = String

  invariants exports_present {
    - true
  }
}
