# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createProofBundleWriter, WriterOptions, SpecInput, GateInput, IterationInput, WriteResult, TraceSummary, ProofBundleWriter
# dependencies: fs/promises, path, crypto, @isl-lang/secrets-hygiene

domain Writer {
  version: "1.0.0"

  type WriterOptions = String
  type SpecInput = String
  type GateInput = String
  type IterationInput = String
  type WriteResult = String
  type TraceSummary = String
  type ProofBundleWriter = String

  invariants exports_present {
    - true
  }
}
