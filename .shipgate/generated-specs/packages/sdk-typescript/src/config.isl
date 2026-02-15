# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: defaultConfig, RetryConfig, ISLClientConfig
# dependencies: @isl-lang/generator-sdk/runtime

domain Config {
  version: "1.0.0"

  type RetryConfig = String
  type ISLClientConfig = String

  invariants exports_present {
    - true
  }
}
