# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: hashContent, generateFingerprint, scan, verifySpec, proofPack, proofVerify, gen, ISL_VERSION, DiagnosticItem, DomainInfo, ScanResult, ClauseItem, BlockerItem, VerifyResult, VerifyOptions, ProofArtifact, ProofManifest, ProofBundle, ProofVerifyResult, GenOptions, GenResult
# dependencies: @isl-lang/parser, @isl-lang/typechecker, @isl-lang/codegen-runtime, @isl-lang/isl-verify, crypto, fs/promises, path, fs

domain Core {
  version: "1.0.0"

  type DiagnosticItem = String
  type DomainInfo = String
  type ScanResult = String
  type ClauseItem = String
  type BlockerItem = String
  type VerifyResult = String
  type VerifyOptions = String
  type ProofArtifact = String
  type ProofManifest = String
  type ProofBundle = String
  type ProofVerifyResult = String
  type GenOptions = String
  type GenResult = String

  invariants exports_present {
    - true
  }
}
