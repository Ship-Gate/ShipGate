# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDatabaseConnectionLost, createDatabaseTimeout, createDeadlock, createRecoverableDatabaseFailure, createDatabaseUnavailable, DatabaseFailureType, DatabaseInjectorConfig, DatabaseInjectorState, DatabaseOperation, DatabaseHandler, DatabaseInjector
# dependencies: 

domain Database {
  version: "1.0.0"

  type DatabaseFailureType = String
  type DatabaseInjectorConfig = String
  type DatabaseInjectorState = String
  type DatabaseOperation = String
  type DatabaseHandler = String
  type DatabaseInjector = String

  invariants exports_present {
    - true
  }
}
