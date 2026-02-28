# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createWASMGenerator, ISLBehavior, WASMGenerator
# dependencies: ${imp.module}

domain Generator {
  version: "1.0.0"

  type ISLBehavior = String
  type WASMGenerator = String

  invariants exports_present {
    - true
  }
}
