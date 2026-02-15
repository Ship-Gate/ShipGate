# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: triAnd, triOr, triNot, triImplies, ok, fail, unknown, unknownLegacy, fromBool, fromKind, EvalKind, UnknownReasonCode, UnknownReason, BlameSpan, EvalResult, EvalContext, EvalAdapter, DefaultEvalAdapter
# dependencies: 

domain Types {
  version: "1.0.0"

  type EvalKind = String
  type UnknownReasonCode = String
  type UnknownReason = String
  type BlameSpan = String
  type EvalResult = String
  type EvalContext = String
  type EvalAdapter = String
  type DefaultEvalAdapter = String

  invariants exports_present {
    - true
  }
}
