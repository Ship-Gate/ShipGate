# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: shrinkWithPreconditions, deltaDebugWithPreconditions, shrinkLoginInput, PreconditionChecker, TestFunction, PreconditionShrinkConfig, TracedShrinkResult, TracedShrinkStep
# dependencies: 

domain PreconditionShrinker {
  version: "1.0.0"

  type PreconditionChecker = String
  type TestFunction = String
  type PreconditionShrinkConfig = String
  type TracedShrinkResult = String
  type TracedShrinkStep = String

  invariants exports_present {
    - true
  }
}
