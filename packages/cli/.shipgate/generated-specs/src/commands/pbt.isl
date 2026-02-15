# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: pbt, printPBTResult, getPBTExitCode, PBTOptions, PBTResult, PBTVerifyResult
# dependencies: fs/promises, fs, path, chalk, ora, @isl-lang/parser, @isl-lang/import-resolver

domain Pbt {
  version: "1.0.0"

  type PBTOptions = String
  type PBTResult = String
  type PBTVerifyResult = String

  invariants exports_present {
    - true
  }
}
