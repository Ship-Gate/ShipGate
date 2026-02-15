# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateBadge, generateAttestation, generatePRComment, printBadgeResult, printAttestationResult, printCommentResult, getBadgeExitCode, getAttestationExitCode, getCommentExitCode, ProofBadgeOptions, ProofAttestOptions, ProofCommentOptions, ProofBadgeResult, ProofAttestResult, ProofCommentResult
# dependencies: fs, fs/promises, path, chalk

domain ProofBadge {
  version: "1.0.0"

  type ProofBadgeOptions = String
  type ProofAttestOptions = String
  type ProofCommentOptions = String
  type ProofBadgeResult = String
  type ProofAttestResult = String
  type ProofCommentResult = String

  invariants exports_present {
    - true
  }
}
