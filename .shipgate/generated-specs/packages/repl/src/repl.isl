# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: startREPL, REPLOptions, ISLREPL
# dependencies: readline, @isl-lang/parser

domain Repl {
  version: "1.0.0"

  type REPLOptions = String
  type ISLREPL = String

  invariants exports_present {
    - true
  }
}
