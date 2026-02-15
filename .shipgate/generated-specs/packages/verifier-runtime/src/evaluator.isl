# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isUnknown, toTriState, triStateAnd, triStateOr, triStateNot, triStateImplies, success, unknown, failure, evaluateExpression, TriState, EvaluationResult, ExpressionAdapter, DefaultAdapter, EvaluatorOptions
# dependencies: 

domain Evaluator {
  version: "1.0.0"

  type TriState = String
  type EvaluationResult = String
  type ExpressionAdapter = String
  type DefaultAdapter = String
  type EvaluatorOptions = String

  invariants exports_present {
    - true
  }
}
