# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildTemporalTrace, evaluateAlways, evaluateEventually, evaluateNever, evaluateWithin, evaluateAlwaysFor, evaluateEventuallyWithin, evaluateUntil, evaluateLeadsTo, eventOccurred, eventCountAtLeast, stateEquals, stateSatisfies, and, or, not, StateSnapshot, TemporalTrace, StatePredicate, TemporalEvaluationResult, TemporalEvaluationOptions
# dependencies: 

domain TraceModel {
  version: "1.0.0"

  type StateSnapshot = String
  type TemporalTrace = String
  type StatePredicate = String
  type TemporalEvaluationResult = String
  type TemporalEvaluationOptions = String

  invariants exports_present {
    - true
  }
}
