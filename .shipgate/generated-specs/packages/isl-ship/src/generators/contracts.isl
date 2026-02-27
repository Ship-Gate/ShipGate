# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateContracts, contractMiddleware, validateEntity, errorHandler, contracts, entityInvariants, ContractViolationError, ContractViolation, PreconditionCheck, PostconditionCheck, RouteContract, EntityInvariant
# dependencies: express

domain Contracts {
  version: "1.0.0"

  type ContractViolationError = String
  type ContractViolation = String
  type PreconditionCheck = String
  type PostconditionCheck = String
  type RouteContract = String
  type EntityInvariant = String

  invariants exports_present {
    - true
  }
}
