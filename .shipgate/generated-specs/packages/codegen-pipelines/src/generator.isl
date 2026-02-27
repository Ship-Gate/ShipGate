# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: analyzeDomain, requiresSecurityScanning, generate, Platform, GeneratorOptions, GeneratedFile, DomainAnalysis, PipelineConfig
# dependencies: 

domain Generator {
  version: "1.0.0"

  type Platform = String
  type GeneratorOptions = String
  type GeneratedFile = String
  type DomainAnalysis = String
  type PipelineConfig = String

  invariants exports_present {
    - true
  }
}
