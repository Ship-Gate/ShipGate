# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TenantService
# dependencies: uuid

domain Tenant {
  version: "1.0.0"

  type TenantService = String

  invariants exports_present {
    - true
  }
}
