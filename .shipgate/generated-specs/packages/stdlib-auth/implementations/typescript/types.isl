# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: success, failure, DEFAULT_AUTH_CONFIG, UserId, SessionId, Email, IpAddress, User, Session, PasswordResetToken, RegisterInput, LoginInput, LogoutInput, RequestPasswordResetInput, PasswordResetInput, ChangePasswordInput, ValidateSessionInput, RegisterOutput, LoginOutput, LogoutOutput, RequestPasswordResetOutput, PasswordResetOutput, ChangePasswordOutput, ValidateSessionOutput, AuthError, AuthException, Result, AuthConfig, UserRepository, SessionRepository, PasswordResetTokenRepository, AuthEvent, UserRegisteredEvent, UserLoggedInEvent, UserLoggedOutEvent, PasswordResetRequestedEvent, PasswordResetCompletedEvent, PasswordChangedEvent, AccountLockedEvent, InvalidLoginAttemptEvent, AuthEventTypes, EventEmitter
# dependencies: 

domain Types {
  version: "1.0.0"

  type UserId = String
  type SessionId = String
  type Email = String
  type IpAddress = String
  type User = String
  type Session = String
  type PasswordResetToken = String
  type RegisterInput = String
  type LoginInput = String
  type LogoutInput = String
  type RequestPasswordResetInput = String
  type PasswordResetInput = String
  type ChangePasswordInput = String
  type ValidateSessionInput = String
  type RegisterOutput = String
  type LoginOutput = String
  type LogoutOutput = String
  type RequestPasswordResetOutput = String
  type PasswordResetOutput = String
  type ChangePasswordOutput = String
  type ValidateSessionOutput = String
  type AuthError = String
  type AuthException = String
  type Result = String
  type AuthConfig = String
  type UserRepository = String
  type SessionRepository = String
  type PasswordResetTokenRepository = String
  type AuthEvent = String
  type UserRegisteredEvent = String
  type UserLoggedInEvent = String
  type UserLoggedOutEvent = String
  type PasswordResetRequestedEvent = String
  type PasswordResetCompletedEvent = String
  type PasswordChangedEvent = String
  type AccountLockedEvent = String
  type InvalidLoginAttemptEvent = String
  type AuthEventTypes = String
  type EventEmitter = String

  invariants exports_present {
    - true
  }
}
