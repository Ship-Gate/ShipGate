# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RegistryChecker
# dependencies: node:fs/promises, node:path, node:crypto

domain Registry {
  version: "1.0.0"

  type RegistryChecker = String

  invariants exports_present {
    - true
  }
}
