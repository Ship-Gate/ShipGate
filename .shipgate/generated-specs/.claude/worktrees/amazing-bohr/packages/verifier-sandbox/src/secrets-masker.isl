# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SecretsMaskerOptions, SecretsMasker
# dependencies: 

domain SecretsMasker {
  version: "1.0.0"

  type SecretsMaskerOptions = String
  type SecretsMasker = String

  invariants exports_present {
    - true
  }
}
