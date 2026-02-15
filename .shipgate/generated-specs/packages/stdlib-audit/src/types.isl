# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Ok, Err, Result, AuditEntryId, ActorId, ResourceId, Actor, Resource, Source, Change, AuditEntry, RecordInput, AuditError, RecordError, QueryError, ComplianceError, RetentionError, AuditStore, StoreQueryFilters
# dependencies: 

domain Types {
  version: "1.0.0"

  type Result = String
  type AuditEntryId = String
  type ActorId = String
  type ResourceId = String
  type Actor = String
  type Resource = String
  type Source = String
  type Change = String
  type AuditEntry = String
  type RecordInput = String
  type AuditError = String
  type RecordError = String
  type QueryError = String
  type ComplianceError = String
  type RetentionError = String
  type AuditStore = String
  type StoreQueryFilters = String

  invariants exports_present {
    - true
  }
}
