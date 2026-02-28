# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: bind, printBindResult, getBindExitCode, BindOptions, BindResult
# dependencies: @isl-lang/isl-discovery, node:path, node:fs, chalk

domain Bind {
  version: "1.0.0"

  type BindOptions = String
  type BindResult = String

  invariants exports_present {
    - true
  }
}
