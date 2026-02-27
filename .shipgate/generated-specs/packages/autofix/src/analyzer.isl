# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFailure, parseVerificationResult, FailureType, VerificationFailure, SourceLocation, FailureContext, AnalysisResult, RootCause, RootCauseType, FixStrategy, CodeSegment, FailureAnalyzer
# dependencies: 

domain Analyzer {
  version: "1.0.0"

  type FailureType = String
  type VerificationFailure = String
  type SourceLocation = String
  type FailureContext = String
  type AnalysisResult = String
  type RootCause = String
  type RootCauseType = String
  type FixStrategy = String
  type CodeSegment = String
  type FailureAnalyzer = String

  invariants exports_present {
    - true
  }
}
