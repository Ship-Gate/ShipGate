# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SMTCheckResult, SMTVerifyOptions, PreconditionCheck, PostconditionCheck, RefinementCheck, SMTCheckKind, SMTVerificationResult, SMTBatchResult, SolveResult, SolverEvidence, VerificationWithEvidence, ProofBundleEntry
# dependencies: 

domain Types {
  version: "1.0.0"

  type SMTCheckResult = String
  type SMTVerifyOptions = String
  type PreconditionCheck = String
  type PostconditionCheck = String
  type RefinementCheck = String
  type SMTCheckKind = String
  type SMTVerificationResult = String
  type SMTBatchResult = String
  type SolveResult = String
  type SolverEvidence = String
  type VerificationWithEvidence = String
  type ProofBundleEntry = String

  invariants exports_present {
    - true
  }
}
