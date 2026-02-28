# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: compileToWat, compileWatToWasm, validateWat, WatModule, SourceMapping
# dependencies: ${imp.module}

domain WatEmitter {
  version: "1.0.0"

  type WatModule = String
  type SourceMapping = String

  invariants exports_present {
    - true
  }
}
