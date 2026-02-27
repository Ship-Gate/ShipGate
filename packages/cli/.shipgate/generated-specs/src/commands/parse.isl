# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parse, printParseResult, getParseExitCode, ParseOptions, ParseResult
# dependencies: fs/promises, path, chalk, ora, @isl-lang/parser, @isl-lang/observability

domain Parse {
  version: "1.0.0"

  type ParseOptions = String
  type ParseResult = String

  invariants exports_present {
    - true
  }
}
