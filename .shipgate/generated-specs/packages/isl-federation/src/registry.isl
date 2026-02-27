# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RegistryOptions, RegistryStorage, FederationRegistry, InMemoryRegistryStorage
# dependencies: 

domain Registry {
  version: "1.0.0"

  type RegistryOptions = String
  type RegistryStorage = String
  type FederationRegistry = String
  type InMemoryRegistryStorage = String

  invariants exports_present {
    - true
  }
}
