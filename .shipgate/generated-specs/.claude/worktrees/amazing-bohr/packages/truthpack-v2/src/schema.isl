# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: computeTruthpackHash, createEmptyTruthpack, TruthpackRoute, TruthpackEnvVar, TruthpackDbSchema, TruthpackDbTable, TruthpackDbColumn, TruthpackAuthModel, TruthpackDependency, TruthpackRuntimeProbe, TruthpackProvenance, TruthpackV2
# dependencies: crypto

domain Schema {
  version: "1.0.0"

  type TruthpackRoute = String
  type TruthpackEnvVar = String
  type TruthpackDbSchema = String
  type TruthpackDbTable = String
  type TruthpackDbColumn = String
  type TruthpackAuthModel = String
  type TruthpackDependency = String
  type TruthpackRuntimeProbe = String
  type TruthpackProvenance = String
  type TruthpackV2 = String

  invariants exports_present {
    - true
  }
}
