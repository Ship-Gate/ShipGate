# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: provenanceInit, printProvenanceInitResult, ProvenanceInitOptions, ProvenanceInitResult
# dependencies: fs/promises, path, chalk, @isl-lang/proof

domain Provenance {
  version: "1.0.0"

  type ProvenanceInitOptions = String
  type ProvenanceInitResult = String

  invariants exports_present {
    - true
  }
}
