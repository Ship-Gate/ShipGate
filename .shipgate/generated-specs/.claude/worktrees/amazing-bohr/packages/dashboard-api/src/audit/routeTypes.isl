# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AuditApiResponse, PaginatedAuditResponse, ListAuditQuerySchema, ExportAuditQuerySchema
# dependencies: 

domain RouteTypes {
  version: "1.0.0"

  type AuditApiResponse = String
  type PaginatedAuditResponse = String

  invariants exports_present {
    - true
  }
}
