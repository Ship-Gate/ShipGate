# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPostgresStore, CREATE_TABLE_SQL, PostgresClient, PostgresPoolClient, PostgresPool, PostgresStoreOptions, PostgresIdempotencyStore
# dependencies: 

domain Postgres {
  version: "1.0.0"

  type PostgresClient = String
  type PostgresPoolClient = String
  type PostgresPool = String
  type PostgresStoreOptions = String
  type PostgresIdempotencyStore = String

  invariants exports_present {
    - true
  }
}
