# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TenantStore, InMemoryTenantStore
# dependencies: 

domain Store {
  version: "1.0.0"

  type TenantStore = String
  type InMemoryTenantStore = String

  invariants exports_present {
    - true
  }
}
