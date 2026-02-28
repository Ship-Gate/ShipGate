# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: calculateVerdictV2, calculateVerdict, calculateBundleId, calculateSpecHash, createStdlibVersion, calculateStdlibManifestHash, signManifest, verifyManifestSignature, ProofVerdict, BuildResult, TestResult, TestFileResult, ManifestGateResult, ManifestViolation, RulepackVersion, StdlibVersion, ImportResolution, ImportGraph, TraceRef, ClauseVerifyResult, VerifyResults, TestsSummary, EvaluatorDecisionEntry, UnknownReasonCode, EvaluatorDecisionTrace, SMTTranscriptEntry, SMTSolverTranscript, RunMetadata, IterationRecord, PatchRecord, DomainTestDeclaration, VerificationEvaluationResult, ChaosTestResult, ChaosConfig, ChaosScenarioResult, ChaosInjectionResult, ChaosAssertionResult, PostconditionVerificationResult, ProofBundleManifest, VerdictOptions
# dependencies: crypto

domain Manifest {
  version: "1.0.0"

  type ProofVerdict = String
  type BuildResult = String
  type TestResult = String
  type TestFileResult = String
  type ManifestGateResult = String
  type ManifestViolation = String
  type RulepackVersion = String
  type StdlibVersion = String
  type ImportResolution = String
  type ImportGraph = String
  type TraceRef = String
  type ClauseVerifyResult = String
  type VerifyResults = String
  type TestsSummary = String
  type EvaluatorDecisionEntry = String
  type UnknownReasonCode = String
  type EvaluatorDecisionTrace = String
  type SMTTranscriptEntry = String
  type SMTSolverTranscript = String
  type RunMetadata = String
  type IterationRecord = String
  type PatchRecord = String
  type DomainTestDeclaration = String
  type VerificationEvaluationResult = String
  type ChaosTestResult = String
  type ChaosConfig = String
  type ChaosScenarioResult = String
  type ChaosInjectionResult = String
  type ChaosAssertionResult = String
  type PostconditionVerificationResult = String
  type ProofBundleManifest = String
  type VerdictOptions = String

  invariants exports_present {
    - true
  }
}
