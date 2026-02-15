# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SMTSort, DatatypeConstructor, SMTExpr, SMTDecl, VerificationGoal, VerificationResult, Counterexample, TraceStep, ProverConfig, SMTLogic, ISLProperty, ISLVerificationContext, EntitySchema, BehaviorSchema, TypeSchema, VerificationReport, PropertyResult, VerificationSummary
# dependencies: 

domain Types {
  version: "1.0.0"

  type SMTSort = String
  type DatatypeConstructor = String
  type SMTExpr = String
  type SMTDecl = String
  type VerificationGoal = String
  type VerificationResult = String
  type Counterexample = String
  type TraceStep = String
  type ProverConfig = String
  type SMTLogic = String
  type ISLProperty = String
  type ISLVerificationContext = String
  type EntitySchema = String
  type BehaviorSchema = String
  type TypeSchema = String
  type VerificationReport = String
  type PropertyResult = String
  type VerificationSummary = String

  invariants exports_present {
    - true
  }
}
