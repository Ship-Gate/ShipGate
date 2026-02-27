# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: requireTenantContext, withTenantContext, withTenant, tenantKey, TenantContext, TenantContextData, ContextOptions, NoTenantContextError
# dependencies: async_hooks

domain Context {
  version: "1.0.0"

  type TenantContextData = String
  type ContextOptions = String
  type NoTenantContextError = String

  invariants exports_present {
    - true
  }
}
