# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ISLSymbol, CodeSymbol, Binding, Evidence, DiscoveryStrategy, DiscoveryResult, DiscoveryOptions, BindingsFile, BindingEntry
# dependencies: 

domain Types {
  version: "1.0.0"

  type ISLSymbol = String
  type CodeSymbol = String
  type Binding = String
  type Evidence = String
  type DiscoveryStrategy = String
  type DiscoveryResult = String
  type DiscoveryOptions = String
  type BindingsFile = String
  type BindingEntry = String

  invariants exports_present {
    - true
  }
}
