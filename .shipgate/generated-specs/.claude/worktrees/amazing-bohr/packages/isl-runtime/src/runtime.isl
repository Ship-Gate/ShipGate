# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRuntime, RuntimeConfig, Logger, StateAdapter, DomainSpec, EntitySpec, FieldSpec, ConstraintSpec, TypeSpec, BehaviorSpec, ErrorSpec, PostconditionSpec, InvariantSpec, BehaviorHandler, Runtime
# dependencies: 

domain Runtime {
  version: "1.0.0"

  type RuntimeConfig = String
  type Logger = String
  type StateAdapter = String
  type DomainSpec = String
  type EntitySpec = String
  type FieldSpec = String
  type ConstraintSpec = String
  type TypeSpec = String
  type BehaviorSpec = String
  type ErrorSpec = String
  type PostconditionSpec = String
  type InvariantSpec = String
  type BehaviorHandler = String
  type Runtime = String

  invariants exports_present {
    - true
  }
}
