# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: shipCommand, ShipCommandOptions, ShipCommandResult
# dependencies: fs/promises, path, chalk, ora

domain Ship {
  version: "1.0.0"

  type ShipCommandOptions = String
  type ShipCommandResult = String

  invariants exports_present {
    - true
  }
}
