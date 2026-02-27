# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateProvisioningPlan, DatabaseConfig, TenantDatabaseInfo, DatabasePoolConfig, DatabaseManager, ConnectionPool, PooledConnection, DatabaseNotFoundError, ProvisioningConfig
# dependencies: 

domain Database {
  version: "1.0.0"

  type DatabaseConfig = String
  type TenantDatabaseInfo = String
  type DatabasePoolConfig = String
  type DatabaseManager = String
  type ConnectionPool = String
  type PooledConnection = String
  type DatabaseNotFoundError = String
  type ProvisioningConfig = String

  invariants exports_present {
    - true
  }
}
