# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createNetworkTimeout, createConnectionRefused, createRetryableNetworkFailure, NetworkInjectorConfig, NetworkInjectorState, NetworkInjector
# dependencies: 

domain Network {
  version: "1.0.0"

  type NetworkInjectorConfig = String
  type NetworkInjectorState = String
  type NetworkInjector = String

  invariants exports_present {
    - true
  }
}
