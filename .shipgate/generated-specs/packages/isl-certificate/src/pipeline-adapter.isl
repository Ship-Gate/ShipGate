# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildCertificateInputFromPipeline, CertificateOverrides
# dependencies: node:fs/promises, node:path

domain PipelineAdapter {
  version: "1.0.0"

  type CertificateOverrides = String

  invariants exports_present {
    - true
  }
}
