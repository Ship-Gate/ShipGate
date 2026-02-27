# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: PostgresClient, PostgresAuditStorageOptions, PostgresAuditStorage
# dependencies: 

domain Postgres {
  version: "1.0.0"

  type PostgresClient = String
  type PostgresAuditStorageOptions = String
  type PostgresAuditStorage = String

  invariants exports_present {
    - true
  }
}
