# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: init, printInitResult, interactiveInit, printInteractiveInitResult, InitOptions, InitResult, InteractiveInitOptions, InteractiveInitResult
# dependencies: fs/promises, fs, path, chalk, ora

domain Init {
  version: "1.0.0"

  type InitOptions = String
  type InitResult = String
  type InteractiveInitOptions = String
  type InteractiveInitResult = String

  invariants exports_present {
    - true
  }
}
