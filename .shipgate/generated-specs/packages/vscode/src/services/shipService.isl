# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ship, ShipOptions, ShipResult
# dependencies: child_process

domain ShipService {
  version: "1.0.0"

  type ShipOptions = String
  type ShipResult = String

  invariants exports_present {
    - true
  }
}
