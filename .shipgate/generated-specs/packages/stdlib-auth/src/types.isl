# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: User, UserStatus, Session, Role, Permission, PermissionAction, OAuthConnection, OAuthProvider, MFADevice, MFAType, APIKey, AuthConfig, JWTConfig, PasswordPolicy, SessionPolicy, RateLimitPolicy, AuthResult, AuthError, LoginInput, RegisterInput, TokenPayload
# dependencies: 

domain Types {
  version: "1.0.0"

  type User = String
  type UserStatus = String
  type Session = String
  type Role = String
  type Permission = String
  type PermissionAction = String
  type OAuthConnection = String
  type OAuthProvider = String
  type MFADevice = String
  type MFAType = String
  type APIKey = String
  type AuthConfig = String
  type JWTConfig = String
  type PasswordPolicy = String
  type SessionPolicy = String
  type RateLimitPolicy = String
  type AuthResult = String
  type AuthError = String
  type LoginInput = String
  type RegisterInput = String
  type TokenPayload = String

  invariants exports_present {
    - true
  }
}
