# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateBindings, initialize, loadWasm, createSharedMemory, encodeString, decodeString, BindingsOptions, GeneratedBindings, DomainError
# dependencies: 

domain Bindings {
  version: "1.0.0"

  type BindingsOptions = String
  type GeneratedBindings = String
  type DomainError = String

  invariants exports_present {
    - true
  }
}
