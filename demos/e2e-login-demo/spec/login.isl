// Generated from: "Write me a login"
// This ISL spec defines the complete contract for user authentication

domain Auth version "1.0.0"

entity Session {
  id: UUID
  user_id: UUID
  access_token: String
  expires_at: DateTime
  
  invariant expires_at > now()
  invariant access_token.length >= 32
}

entity User {
  id: UUID
  email: Email
  password_hash: String
  status: UserStatus
  failed_attempts: Int
  
  invariant password_hash != password  // Never store plain text
  invariant failed_attempts >= 0
}

enum UserStatus {
  ACTIVE
  LOCKED
  INACTIVE
}

behavior UserLogin {
  // Authenticate user with email and password
  
  input {
    email: Email
    password: String
  }
  
  output {
    success: Session
    errors {
      ValidationError when "email or password format invalid"
      RateLimited when "too many requests from this IP or email"
      InvalidCredentials when "email or password incorrect"
      AccountLocked when "too many failed attempts"
      AccountInactive when "account is deactivated"
    }
  }
  
  // Intent declarations - these MUST be enforced
  @intent rate-limit-required
  @intent audit-required
  @intent no-pii-logging
  
  // Preconditions
  pre email.isValidFormat()
  pre password.length >= 8
  pre rateLimitNotExceeded(email, ip)
  
  // Postconditions
  post success {
    session.isValid()
    session.user_id == user.id
    session.expires_at > now()
    user.failed_attempts == 0
    audit.recorded("login_success", user.id)
  }
  
  post InvalidCredentials {
    user.failed_attempts += 1
    audit.recorded("login_failed", email)
    response.timing == constant  // Prevent timing attacks
  }
  
  post AccountLocked {
    user.status == LOCKED
    audit.recorded("account_locked", user.id)
  }
  
  // Invariants - ALWAYS true
  invariant password.neverLogged()
  invariant email.redactedInLogs()
  invariant ip.redactedInLogs()
}
