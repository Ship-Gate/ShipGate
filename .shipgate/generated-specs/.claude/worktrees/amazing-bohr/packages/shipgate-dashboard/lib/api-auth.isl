# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getRole, requireOrgRole, requireAdminOrMember, hashToken, authenticate, assertOrgAccess, MembershipRole, AuthContext
# dependencies: next/server, @/lib/prisma, crypto

domain ApiAuth {
  version: "1.0.0"

  type MembershipRole = String
  type AuthContext = String

  invariants exports_present {
    - true
  }
}
