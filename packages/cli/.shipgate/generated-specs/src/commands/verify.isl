# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verify, verifyWithDiscovery, printVerifyResult, getVerifyExitCode, unifiedVerify, getUnifiedExitCode, printUnifiedVerifyResult, VerifyOptions, VerifyResult, TemporalVerifyResult, PBTVerifyResultType, SMTVerifyResult, SMTCheckItem, EvidenceScore, CategoryEvidence, VerificationMode, FailOnLevel, UnifiedVerdict, FileVerifyStatus, FileVerifyMode, SpecSource, OutputFormat, UnifiedVerifyOptions, VerificationTier, FileVerifyResultEntry, ProofEvidence, ProofBundle, SpecCoverageReport, ProofGap, UnifiedVerifyResult
# dependencies: fs/promises, fs, path, glob, chalk, ora, @isl-lang/parser, @isl-lang/isl-verify, @isl-lang/import-resolver, picomatch, @isl-lang/observability, @isl-lang/secrets-hygiene

domain Verify {
  version: "1.0.0"

  type VerifyOptions = String
  type VerifyResult = String
  type TemporalVerifyResult = String
  type PBTVerifyResultType = String
  type SMTVerifyResult = String
  type SMTCheckItem = String
  type EvidenceScore = String
  type CategoryEvidence = String
  type VerificationMode = String
  type FailOnLevel = String
  type UnifiedVerdict = String
  type FileVerifyStatus = String
  type FileVerifyMode = String
  type SpecSource = String
  type OutputFormat = String
  type UnifiedVerifyOptions = String
  type VerificationTier = String
  type FileVerifyResultEntry = String
  type ProofEvidence = String
  type ProofBundle = String
  type SpecCoverageReport = String
  type ProofGap = String
  type UnifiedVerifyResult = String

  invariants exports_present {
    - true
  }
}
