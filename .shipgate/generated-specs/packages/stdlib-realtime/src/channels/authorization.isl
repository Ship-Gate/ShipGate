# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultChannelAuthorizer, Role, User, RoleBasedAuthorizer, TokenPayload, TokenValidator, TokenBasedAuthorizer, CompositeAuthorizer, AuthorizationFactory
# dependencies: 

domain Authorization {
  version: "1.0.0"

  type DefaultChannelAuthorizer = String
  type Role = String
  type User = String
  type RoleBasedAuthorizer = String
  type TokenPayload = String
  type TokenValidator = String
  type TokenBasedAuthorizer = String
  type CompositeAuthorizer = String
  type AuthorizationFactory = String

  invariants exports_present {
    - true
  }
}
