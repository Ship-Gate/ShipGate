# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: INIT_COMMAND, VERIFY_COMMAND, TERMINAL_INIT_LINES, TERMINAL_VERIFY_LINES, ALL_TERMINAL_LINES, ISL_SPEC_EXAMPLE, VIOLATION_EXAMPLE, TerminalLine
# dependencies: 

domain TerminalContent {
  version: "1.0.0"

  type TerminalLine = String

  invariants exports_present {
    - true
  }
}
