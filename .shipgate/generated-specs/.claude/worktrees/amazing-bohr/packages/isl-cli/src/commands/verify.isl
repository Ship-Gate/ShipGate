# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verify, printVerifyResult, printVerifyResultLegacy, VerifyOptions, VerifyCommandResult
# dependencies: fs/promises, path, chalk, ora, @isl-lang/isl-core, @isl-lang/cli-ux

domain Verify {
  version: "1.0.0"

  type VerifyOptions = String
  type VerifyCommandResult = String

  invariants exports_present {
    - true
  }
}
