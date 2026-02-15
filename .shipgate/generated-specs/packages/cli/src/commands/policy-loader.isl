# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadPolicy, loadPolicyFile, isExceptionValid, getActiveExceptions, matchesExceptionScope, LoadedPolicy, PolicyValidationError
# dependencies: fs/promises, fs, path, yaml

domain PolicyLoader {
  version: "1.0.0"

  type LoadedPolicy = String
  type PolicyValidationError = String

  invariants exports_present {
    - true
  }
}
