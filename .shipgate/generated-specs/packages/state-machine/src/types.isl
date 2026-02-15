# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: StateMachine, StateNode, Transition, Guard, Action, GuardRef, ActionRef, EventObject, InvokeConfig, MachineInstance, StateTransitionRecord, VerificationResult, MachineError, MachineWarning, StateMachineSpec, StateSpec, EventSpec, TransitionSpec
# dependencies: 

domain Types {
  version: "1.0.0"

  type StateMachine = String
  type StateNode = String
  type Transition = String
  type Guard = String
  type Action = String
  type GuardRef = String
  type ActionRef = String
  type EventObject = String
  type InvokeConfig = String
  type MachineInstance = String
  type StateTransitionRecord = String
  type VerificationResult = String
  type MachineError = String
  type MachineWarning = String
  type StateMachineSpec = String
  type StateSpec = String
  type EventSpec = String
  type TransitionSpec = String

  invariants exports_present {
    - true
  }
}
