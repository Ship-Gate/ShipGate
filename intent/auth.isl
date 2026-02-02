// ============================================================================
// Auth Intent Declarations
// ============================================================================
// These intent blocks declare the expected behavior for auth endpoints.
// The gate enforces these intents against actual code.

domain Auth version "1.0.0"

// ============================================================================
// Entities
// ============================================================================

entity User {
  id: UUID
  email: Email
  passwordHash: String
  isActive: Boolean
  createdAt: DateTime
  lastLoginAt: DateTime?
  failedLoginAttempts: Int
  lockedUntil: DateTime?

  invariant passwordHash.length > 0
  invariant email.contains("@")
}

entity AuthToken {
  accessToken: String
  refreshToken: String?
  expiresAt: DateTime
  userId: UUID

  invariant expiresAt > now()
}

entity PasswordResetToken {
  token: String
  userId: UUID
  expiresAt: DateTime
  usedAt: DateTime?

  invariant token.length >= 32
}

// ============================================================================
// UserLogin
// ============================================================================

behavior UserLogin {
  // Authenticate user with email and password

  input {
    email: Email
    password: String
  }

  output {
    success: AuthToken
    errors {
      InvalidCredentials when "email or password incorrect"
      AccountLocked when "too many failed attempts"
      AccountDisabled when "account is deactivated"
    }
  }

  // Intent declarations - the gate enforces these
  @intent rate-limit-required    // Must have rate limiting
  @intent audit-required         // Must log auth events
  @intent no-pii-logging         // Must not log password

  pre email.isValidFormat()
  pre password.length >= 8
  pre rateLimitNotExceeded(email)

  post success {
    result.accessToken.isValidJWT()
    result.expiresAt > now()
    auditLog.contains(LoginEvent)
    user.lastLoginAt == now()
    user.failedLoginAttempts == 0
  }

  post InvalidCredentials {
    user.failedLoginAttempts == old(user.failedLoginAttempts) + 1
    auditLog.contains(FailedLoginEvent)
  }

  invariant password is never logged
  invariant response time is constant (prevent timing attacks)
}

// ============================================================================
// UserRegister
// ============================================================================

behavior UserRegister {
  // Create new user account

  input {
    email: Email
    password: String
    confirmPassword: String
  }

  output {
    success: User
    errors {
      EmailAlreadyExists when "email is taken"
      WeakPassword when "password does not meet requirements"
      PasswordMismatch when "passwords do not match"
    }
  }

  @intent rate-limit-required
  @intent audit-required
  @intent encrypt-at-rest
  @intent no-pii-logging

  pre email.isValidFormat()
  pre !emailExists(email)
  pre password.meetsComplexityRequirements()
  pre password == confirmPassword
  pre rateLimitNotExceeded(ip)

  post success {
    result.id.isValidUUID()
    result.email == input.email
    result.passwordHash != input.password  // never store plain
    result.isActive == true
    auditLog.contains(RegistrationEvent)
  }

  invariant password is hashed with bcrypt or argon2
  invariant email verification is required before full access
}

// ============================================================================
// RequestPasswordReset
// ============================================================================

behavior RequestPasswordReset {
  // Request password reset email

  input {
    email: Email
  }

  output {
    success: Void
    errors {}  // Never reveal if email exists
  }

  @intent rate-limit-required
  @intent audit-required
  @intent prevent-enumeration

  pre rateLimitNotExceeded(email)

  post success {
    // Response does not reveal if email exists
    responseTime.isConstant()
    if emailExists(email) {
      resetToken.isCreated()
      resetEmail.isSent()
    }
    auditLog.contains(PasswordResetRequestEvent)
  }

  invariant response is identical whether email exists or not
  invariant timing is constant to prevent enumeration
}

// ============================================================================
// ResetPassword
// ============================================================================

behavior ResetPassword {
  // Set new password using reset token

  input {
    token: String
    newPassword: String
    confirmPassword: String
  }

  output {
    success: Void
    errors {
      InvalidToken when "token is invalid or expired"
      WeakPassword when "password does not meet requirements"
      PasswordMismatch when "passwords do not match"
    }
  }

  @intent rate-limit-required
  @intent audit-required
  @intent session-invalidation

  pre token.isValid()
  pre token.notExpired()
  pre newPassword.meetsComplexityRequirements()
  pre newPassword == confirmPassword

  post success {
    user.passwordHash != old(user.passwordHash)
    resetToken.usedAt == now()
    allSessions(user).areInvalidated()
    notificationEmail.isSent()
    auditLog.contains(PasswordResetEvent)
  }

  invariant token can only be used once
  invariant all existing sessions are invalidated
}

// ============================================================================
// Logout
// ============================================================================

behavior Logout {
  // Invalidate current session

  input {
    accessToken: String
  }

  output {
    success: Void
    errors {
      InvalidToken when "token is invalid"
    }
  }

  @intent audit-required

  pre accessToken.isValid()

  post success {
    session(accessToken).isInvalidated()
    auditLog.contains(LogoutEvent)
  }
}
