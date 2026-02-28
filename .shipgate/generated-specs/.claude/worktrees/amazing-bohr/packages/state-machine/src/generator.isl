# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: create, send, can, generateStateMachine, GeneratorOptions, StateMachineGenerator
# dependencies: @isl-lang/state-machine

domain Generator {
  version: "1.0.0"

  type GeneratorOptions = String
  type StateMachineGenerator = String

  invariants exports_present {
    - true
  }
}
