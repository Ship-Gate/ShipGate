# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CertificateVersion, CertificateVerdict, FileTier, SecurityCheck, PipelineStage, GeneratedFileEntry, PromptInfo, IslSpecInfo, VerificationInfo, ModelInfo, PipelineInfo, ISLCertificate, CertificateInput
# dependencies: 

domain Types {
  version: "1.0.0"

  type CertificateVersion = String
  type CertificateVerdict = String
  type FileTier = String
  type SecurityCheck = String
  type PipelineStage = String
  type GeneratedFileEntry = String
  type PromptInfo = String
  type IslSpecInfo = String
  type VerificationInfo = String
  type ModelInfo = String
  type PipelineInfo = String
  type ISLCertificate = String
  type CertificateInput = String

  invariants exports_present {
    - true
  }
}
