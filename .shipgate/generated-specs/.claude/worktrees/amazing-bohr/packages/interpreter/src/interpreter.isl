# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verify, verifyWithTarget, ISLInterpreter
# dependencies: node:fs/promises, @isl-lang/runtime-interpreter

domain Interpreter {
  version: "1.0.0"

  type ISLInterpreter = String

  invariants exports_present {
    - true
  }
}
