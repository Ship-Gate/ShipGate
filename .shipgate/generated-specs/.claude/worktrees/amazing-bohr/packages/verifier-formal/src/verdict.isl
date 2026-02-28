# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createProvedVerdict, createDisprovedVerdict, createUnknownVerdict, createTimeoutReason, createComplexityReason, createUnsupportedFeatureReason, createQuantifierInstantiationReason, createNonlinearArithmeticReason, createTheoryIncompleteReason, createSolverErrorReason, createResourceExhaustedReason, formatVerdict, formatUnknownReason, aggregateVerdicts, Verdict, ProvedVerdict, DisprovedVerdict, UnknownVerdict, CounterexampleData, UnknownReason, TimeoutReason, ComplexityReason, UnsupportedFeatureReason, ResourceExhaustedReason, SolverErrorReason, QuantifierInstantiationReason, NonlinearArithmeticReason, TheoryIncompleteReason, ComplexityMetric, ComplexityAnalysis
# dependencies: 

domain Verdict {
  version: "1.0.0"

  type Verdict = String
  type ProvedVerdict = String
  type DisprovedVerdict = String
  type UnknownVerdict = String
  type CounterexampleData = String
  type UnknownReason = String
  type TimeoutReason = String
  type ComplexityReason = String
  type UnsupportedFeatureReason = String
  type ResourceExhaustedReason = String
  type SolverErrorReason = String
  type QuantifierInstantiationReason = String
  type NonlinearArithmeticReason = String
  type TheoryIncompleteReason = String
  type ComplexityMetric = String
  type ComplexityAnalysis = String

  invariants exports_present {
    - true
  }
}
