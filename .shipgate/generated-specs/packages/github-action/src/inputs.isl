# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseInputs, getInputWithDefault, getBooleanInputWithDefault, validateFilePath, resolvePath, ActionInputs
# dependencies: @actions/core, path

domain Inputs {
  version: "1.0.0"

  type ActionInputs = String

  invariants exports_present {
    - true
  }
}
