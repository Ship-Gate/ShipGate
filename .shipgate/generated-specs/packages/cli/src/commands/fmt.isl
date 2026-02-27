# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: fmt, printFmtResult, getFmtExitCode, FmtOptions, FmtResult
# dependencies: fs/promises, path, chalk, ora, @isl-lang/parser

domain Fmt {
  version: "1.0.0"

  type FmtOptions = String
  type FmtResult = String

  invariants exports_present {
    - true
  }
}
