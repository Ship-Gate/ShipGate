# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SecretsMaskerOptions, MaskResult, EnvFilterOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type SecretsMaskerOptions = String
  type MaskResult = String
  type EnvFilterOptions = String

  invariants exports_present {
    - true
  }
}
