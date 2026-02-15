# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isValidSlug, generateSlug, DEFAULT_PLAN_LIMITS, PlanType, TenantStatus, IsolationStrategy, TenantLimits, Tenant, TenantSettings, CreateTenantInput, UpdateTenantInput, TenantRepository, InMemoryTenantRepository, TenantManager, TenantErrorCode, TenantError
# dependencies: 

domain Tenant {
  version: "1.0.0"

  type PlanType = String
  type TenantStatus = String
  type IsolationStrategy = String
  type TenantLimits = String
  type Tenant = String
  type TenantSettings = String
  type CreateTenantInput = String
  type UpdateTenantInput = String
  type TenantRepository = String
  type InMemoryTenantRepository = String
  type TenantManager = String
  type TenantErrorCode = String
  type TenantError = String

  invariants exports_present {
    - true
  }
}
