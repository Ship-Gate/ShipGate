# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runExecutionProof, RuntimeProbe, InvocationRecord, ShapeCheckResult, RuntimeEvidenceReport, EffectStubSummary, ExecutionProofOptions
# dependencies: fs/promises, path, os

domain ExecutionProof {
  version: "1.0.0"

  type RuntimeProbe = String
  type InvocationRecord = String
  type ShapeCheckResult = String
  type RuntimeEvidenceReport = String
  type EffectStubSummary = String
  type ExecutionProofOptions = String

  invariants exports_present {
    - true
  }
}
