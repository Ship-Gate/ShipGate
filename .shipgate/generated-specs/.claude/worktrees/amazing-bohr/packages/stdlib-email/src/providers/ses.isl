# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SesConfig, SesProvider
# dependencies: 

domain Ses {
  version: "1.0.0"

  type SesConfig = String
  type SesProvider = String

  invariants exports_present {
    - true
  }
}
