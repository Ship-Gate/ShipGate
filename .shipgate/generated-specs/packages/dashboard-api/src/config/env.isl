# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getEnvConfig, EnvConfig
# dependencies: zod

domain Env {
  version: "1.0.0"

  type EnvConfig = String

  invariants exports_present {
    - true
  }
}
