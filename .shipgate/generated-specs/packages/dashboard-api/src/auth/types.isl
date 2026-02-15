# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ROLES, PERMISSIONS, Role, User, Permission, UserRow, ApiKeyRow, ApiKeyInfo
# dependencies: 

domain Types {
  version: "1.0.0"

  type Role = String
  type User = String
  type Permission = String
  type UserRow = String
  type ApiKeyRow = String
  type ApiKeyInfo = String

  invariants exports_present {
    - true
  }
}
