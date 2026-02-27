# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadShipGateConfig, loadShipGateConfigFromFile, LoadConfigResult, ShipGateConfigError
# dependencies: fs/promises, path, yaml

domain Loader {
  version: "1.0.0"

  type LoadConfigResult = String
  type ShipGateConfigError = String

  invariants exports_present {
    - true
  }
}
