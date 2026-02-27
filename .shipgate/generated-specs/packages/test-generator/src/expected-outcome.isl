# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: synthesizeExpectedOutcome, ComputedAssertion, ExpectedOutcomeResult, ComputedExpectation, compilePostconditionExpression, compileToAssertion, compileBinaryToAssertion, compileQuantifierToAssertion, compileTemporalAssertion, compileSecurityAssertion, compileLifecycleAssertion, compileNegativeAssertion, durationToMs, expressionToDescription, inferResultTypeAssertions, computeExpectedFromPostconditions, extractExpectationFromPredicate, formatExpectedValue
# dependencies: 

domain ExpectedOutcome {
  version: "1.0.0"

  type ComputedAssertion = String
  type ExpectedOutcomeResult = String
  type ComputedExpectation = String

  invariants exports_present {
    - true
  }
}
