# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PipelineVerdict, TriState, ClauseStatus, PipelineStage, StageStatus, StageResult, FailureCategory, StageError, RecoveryAction, TestFramework, TestCaseResult, TestSuiteResult, TestRunnerOutput, TraceEventKind, TraceEvent, ExecutionTrace, TraceCollectorOutput, SourceLocation, ClauseEvidence, PostconditionEvaluatorOutput, InvariantScope, InvariantEvidence, InvariantCheckerOutput, SMTResult, SMTCheckResult, SMTCheckerOutput, SMTSolverEvidence, SMTResolutionResult, SMTResolutionOutput, PipelineConfig, PipelineResult, CIOutput, EvaluationTableRow, EvaluationTable, ClauseResult, UnknownReason, EvidenceRef, VerificationResult, PipelineEvent, PipelineEventHandler, PipelineHooks
# dependencies: 

domain Types {
  version: "1.0.0"

  type PipelineVerdict = String
  type TriState = String
  type ClauseStatus = String
  type PipelineStage = String
  type StageStatus = String
  type StageResult = String
  type FailureCategory = String
  type StageError = String
  type RecoveryAction = String
  type TestFramework = String
  type TestCaseResult = String
  type TestSuiteResult = String
  type TestRunnerOutput = String
  type TraceEventKind = String
  type TraceEvent = String
  type ExecutionTrace = String
  type TraceCollectorOutput = String
  type SourceLocation = String
  type ClauseEvidence = String
  type PostconditionEvaluatorOutput = String
  type InvariantScope = String
  type InvariantEvidence = String
  type InvariantCheckerOutput = String
  type SMTResult = String
  type SMTCheckResult = String
  type SMTCheckerOutput = String
  type SMTSolverEvidence = String
  type SMTResolutionResult = String
  type SMTResolutionOutput = String
  type PipelineConfig = String
  type PipelineResult = String
  type CIOutput = String
  type EvaluationTableRow = String
  type EvaluationTable = String
  type ClauseResult = String
  type UnknownReason = String
  type EvidenceRef = String
  type VerificationResult = String
  type PipelineEvent = String
  type PipelineEventHandler = String
  type PipelineHooks = String

  invariants exports_present {
    - true
  }
}
