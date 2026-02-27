# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createTestBinding, bindToImplementation, assertPostcondition, assertPrecondition, BoundImplementation, ExecutionResult, AssertionResult, ContractViolation, EntityContext, EntityProxy, StateCapture, PostconditionViolationError, PreconditionViolationError, InvariantViolationError
# dependencies: 

domain Runtime {
  version: "1.0.0"

  type BoundImplementation = String
  type ExecutionResult = String
  type AssertionResult = String
  type ContractViolation = String
  type EntityContext = String
  type EntityProxy = String
  type StateCapture = String
  type PostconditionViolationError = String
  type PreconditionViolationError = String
  type InvariantViolationError = String

  invariants exports_present {
    - true
  }
}
