# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createStateMachine, StateConfig, TransitionConfig, StateMachineConfig, StateMachineInstance, StateTransition, GuardFunction, ActionFunction, StateMachine
# dependencies: 

domain Machine {
  version: "1.0.0"

  type StateConfig = String
  type TransitionConfig = String
  type StateMachineConfig = String
  type StateMachineInstance = String
  type StateTransition = String
  type GuardFunction = String
  type ActionFunction = String
  type StateMachine = String

  invariants exports_present {
    - true
  }
}
