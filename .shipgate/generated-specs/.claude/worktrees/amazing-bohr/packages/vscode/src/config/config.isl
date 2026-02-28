# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getShipgateConfig, detectShipgateConfigFile, ShipgateConfig
# dependencies: vscode, fs, path

domain Config {
  version: "1.0.0"

  type ShipgateConfig = String

  invariants exports_present {
    - true
  }
}
