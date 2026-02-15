# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: findCargoToml, parseCargoToml, loadCargoManifest, getDeclaredCrates
# dependencies: node:fs/promises, node:path

domain Cargo {
  version: "1.0.0"

  invariants exports_present {
    - true
  }
}
