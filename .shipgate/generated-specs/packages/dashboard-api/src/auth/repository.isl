# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAuthRepository, CreateUserInput, AuthRepository
# dependencies: uuid, node:crypto

domain Repository {
  version: "1.0.0"

  type CreateUserInput = String
  type AuthRepository = String

  invariants exports_present {
    - true
  }
}
