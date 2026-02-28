# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AuditEventTypeSchema, AuditActorSchema, ListAuditQuerySchema, ExportAuditQuerySchema, AuditEventType, VerificationRunEvent, SpecCreatedEvent, SpecModifiedEvent, PolicyOverrideEvent, ConfigChangedEvent, GateBypassEvent, ApiKeyCreatedEvent, ApiKeyRevokedEvent, AuditEvent, AuditActor, AuditRecord, ListAuditQuery, ExportAuditQuery
# dependencies: zod

domain Types {
  version: "1.0.0"

  type AuditEventType = String
  type VerificationRunEvent = String
  type SpecCreatedEvent = String
  type SpecModifiedEvent = String
  type PolicyOverrideEvent = String
  type ConfigChangedEvent = String
  type GateBypassEvent = String
  type ApiKeyCreatedEvent = String
  type ApiKeyRevokedEvent = String
  type AuditEvent = String
  type AuditActor = String
  type AuditRecord = String
  type ListAuditQuery = String
  type ExportAuditQuery = String

  invariants exports_present {
    - true
  }
}
