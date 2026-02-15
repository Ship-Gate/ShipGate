# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRBACService, StandardRoles, RBACStore, RBACService
# dependencies: 

domain Rbac {
  version: "1.0.0"

  type RBACStore = String
  type RBACService = String

  invariants exports_present {
    - true
  }
}
