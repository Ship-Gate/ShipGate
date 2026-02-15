# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createInterpreter, InterpreterConfig, ISLInterpreter, InterpreterState
# dependencies: 

domain Interpreter {
  version: "1.0.0"

  type InterpreterConfig = String
  type ISLInterpreter = String
  type InterpreterState = String

  invariants exports_present {
    - true
  }
}
