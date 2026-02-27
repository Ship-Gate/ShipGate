# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRowLevelSecurityExtension, tenantWhere, tenantData, validateTenantOwnership, assertTenantOwnership, tenantSqlWhere, generateRLSPolicy, createQueryMiddleware, RowLevelSecurityConfig, QueryContext, QueryMiddleware, TenantOwnershipError
# dependencies: 

domain RowLevel {
  version: "1.0.0"

  type RowLevelSecurityConfig = String
  type QueryContext = String
  type QueryMiddleware = String
  type TenantOwnershipError = String

  invariants exports_present {
    - true
  }
}
