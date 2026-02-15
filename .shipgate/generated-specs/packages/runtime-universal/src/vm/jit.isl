# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createJIT, JITOptions, JITCompiler, JITStats
# dependencies: 

domain Jit {
  version: "1.0.0"

  type JITOptions = String
  type JITCompiler = String
  type JITStats = String

  invariants exports_present {
    - true
  }
}
