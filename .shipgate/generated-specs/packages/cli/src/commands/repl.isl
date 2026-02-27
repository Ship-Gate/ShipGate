# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: repl, ReplOptions
# dependencies: readline, chalk, @isl-lang/parser, fs, path

domain Repl {
  version: "1.0.0"

  type ReplOptions = String

  invariants exports_present {
    - true
  }
}
