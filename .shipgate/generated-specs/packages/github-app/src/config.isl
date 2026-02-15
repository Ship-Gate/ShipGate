# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: config, Config
# dependencies: zod

domain Config {
  version: "1.0.0"

  type Config = String

  invariants exports_present {
    - true
  }
}
