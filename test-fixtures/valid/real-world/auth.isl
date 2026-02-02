// NOTE: simplified for parser compatibility (optional List types with annotations not supported).
// Real-world authentication domain
// Realistic spec for auth service

domain Auth {
  version: "1.0.0"
  owner: "Identity Team"
  
  // === TYPES ===
  
  type Email = String {
    format: email
    max_length: 254
  }
  
  type Password = String {
    min_length: 8
    max_length: 128
  }
  
  type Token = String {
    max_length: 512
  }
  
  type OTPCode = String {
    min_length: 6
    max_length: 6
  }
  
  enum UserStatus {
    PENDING_VERIFICATION
    ACTIVE
    SUSPENDED
    LOCKED
    DELETED
  }
  
  enum SessionType {
    WEB
    MOBILE
    API
  }
  
  enum MFAMethod {
    TOTP
    SMS
    EMAIL
    RECOVERY_CODE
  }
  
  type DeviceInfo = {
    device_id: String?
    device_type: String
    os: String?
    browser: String?
    ip_address: String
    location: String?
  }
  
  // === ENTITIES ===
  
  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    email_verified: Boolean
    password_hash: String [secret]
    
    name: String?
    avatar_url: String?
    
    status: UserStatus
    
    mfa_enabled: Boolean
    mfa_method: MFAMethod?
    mfa_secret: String? [secret]
    recovery_codes: List<String> [secret]
    
    failed_login_attempts: Int
    locked_until: Timestamp?
    
    last_login: Timestamp?
    last_password_change: Timestamp?
    
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    
    invariants {
      failed_login_attempts >= 0
      failed_login_attempts <= 10
      mfa_enabled implies mfa_method != null
      mfa_enabled implies mfa_secret != null
    }
    
    lifecycle {
      PENDING_VERIFICATION -> ACTIVE
      PENDING_VERIFICATION -> DELETED
      ACTIVE -> SUSPENDED
      ACTIVE -> LOCKED
      ACTIVE -> DELETED
      SUSPENDED -> ACTIVE
      LOCKED -> ACTIVE
    }
  }
  
  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    
    token_hash: String [secret]
    refresh_token_hash: String? [secret]
    
    type: SessionType
    device_info: DeviceInfo
    
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    last_active: Timestamp
    
    revoked: Boolean
    revoked_at: Timestamp?
    revoked_reason: String?
    
    invariants {
      expires_at > created_at
      revoked implies revoked_at != null
    }
  }
  
  entity PasswordResetToken {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [secret, unique]
    
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    used: Boolean
    used_at: Timestamp?
    
    invariants {
      expires_at > created_at
      used implies used_at != null
    }
  }
  
  entity EmailVerificationToken {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [secret, unique]
    
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    verified: Boolean
    verified_at: Timestamp?
  }
  
  entity AuditLog {
    id: UUID [immutable, unique]
    user_id: UUID? [indexed]
    action: String [indexed]
    resource_type: String?
    resource_id: UUID?
    
    ip_address: String? [pii]
    user_agent: String?
    
    success: Boolean
    failure_reason: String?
    
    metadata: Map<String, String>
    
    timestamp: Timestamp [immutable, indexed]
  }
  
  // === BEHAVIORS ===
  
  behavior Register {
    description: "Register a new user account"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String
      password: String [sensitive]
      name: String?
    }
    
    output {
      success: User
      
      errors {
        EMAIL_EXISTS {
          when: "Email is already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password does not meet requirements"
          retriable: true
        }
        RATE_LIMITED {
          when: "Too many registration attempts"
          retriable: true
          retry_after: 5.minutes
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length >= 8
      not User.exists(email: input.email)
    }
    
    postconditions {
      success implies {
        User.exists(result.id)
        User.lookup(result.id).email == input.email
        User.lookup(result.id).status == PENDING_VERIFICATION
        User.lookup(result.id).email_verified == false
        EmailVerificationToken.exists(user_id: result.id)
      }
      
      EMAIL_EXISTS implies {
        User.count == old(User.count)
      }
    }
    
    invariants {
      input.password never_appears_in logs
      input.password never_appears_in result
    }
    
    temporal {
      response within 1.seconds
      eventually within 5.minutes: verification_email_sent
    }
    
    security {
      rate_limit 5 per ip_address
      captcha_required
    }
  }
  
  behavior VerifyEmail {
    description: "Verify user email address"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: String
    }
    
    output {
      success: User
      
      errors {
        INVALID_TOKEN {
          when: "Token is invalid"
          retriable: false
        }
        TOKEN_EXPIRED {
          when: "Token has expired"
          retriable: false
        }
        ALREADY_VERIFIED {
          when: "Email is already verified"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        result.email_verified == true
        result.status == ACTIVE
      }
    }
  }
  
  behavior Login {
    description: "Authenticate user and create session"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String
      password: String [sensitive]
      device_info: DeviceInfo
      remember_me: Boolean?
    }
    
    output {
      success: {
        session: Session
        access_token: String
        refresh_token: String?
        requires_mfa: Boolean
      }
      
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        ACCOUNT_LOCKED {
          when: "Account is locked due to failed attempts"
          retriable: true
          retry_after: 15.minutes
        }
        ACCOUNT_SUSPENDED {
          when: "Account has been suspended"
          retriable: false
        }
        EMAIL_NOT_VERIFIED {
          when: "Email address not verified"
          retriable: false
        }
        RATE_LIMITED {
          when: "Too many login attempts"
          retriable: true
          retry_after: 5.minutes
        }
      }
    }
    
    preconditions {
      input.email.length > 0
      input.password.length > 0
    }
    
    postconditions {
      success implies {
        Session.exists(result.session.id)
        Session.lookup(result.session.id).revoked == false
        User.lookup(input.email).failed_login_attempts == 0
        User.lookup(input.email).last_login != null
      }
      
      INVALID_CREDENTIALS implies {
        AuditLog.count > old(AuditLog.count)
      }
    }
    
    invariants {
      input.password never_appears_in logs
    }
    
    temporal {
      response within 500ms
      eventually within 1.seconds: done
    }
    
    security {
      rate_limit 5 per input.email
      rate_limit 20 per input.device_info.ip_address
    }
  }
  
  behavior VerifyMFA {
    description: "Verify MFA code to complete login"
    
    actors {
      User { must: partial_auth }
    }
    
    input {
      session_id: UUID
      code: String [sensitive]
      method: MFAMethod
    }
    
    output {
      success: {
        session: Session
        access_token: String
      }
      
      errors {
        INVALID_CODE {
          when: "MFA code is invalid"
          retriable: true
        }
        CODE_EXPIRED {
          when: "MFA code has expired"
          retriable: true
        }
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        Session.lookup(result.session.id).last_active != null
      }
    }
    
    security {
      rate_limit 5 per input.session_id
    }
  }
  
  behavior Logout {
    description: "Revoke user session"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      session_id: UUID
      all_sessions: Boolean?
    }
    
    output {
      success: Boolean
      
      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        UNAUTHORIZED {
          when: "Cannot revoke other user's session"
          retriable: false
        }
      }
    }
    
    preconditions {
      Session.exists(input.session_id)
    }
    
    postconditions {
      success implies {
        Session.lookup(input.session_id).revoked == true
      }
    }
  }
  
  behavior RequestPasswordReset {
    description: "Request password reset email"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String
    }
    
    output {
      success: Boolean
      
      errors {
        RATE_LIMITED {
          when: "Too many reset requests"
          retriable: true
          retry_after: 5.minutes
        }
      }
    }
    
    // Note: Always returns success even if email doesn't exist (security)
    postconditions {
      success implies {
        PasswordResetToken.count >= old(PasswordResetToken.count)
      }
    }
    
    temporal {
      response within 1.seconds
      eventually within 5.minutes: reset_email_sent
    }
    
    security {
      rate_limit 3 per input.email
      rate_limit 10 per ip_address
    }
  }
  
  behavior ResetPassword {
    description: "Reset password using token"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: String
      new_password: String [sensitive]
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_TOKEN {
          when: "Token is invalid"
          retriable: false
        }
        TOKEN_EXPIRED {
          when: "Token has expired"
          retriable: false
        }
        TOKEN_USED {
          when: "Token has already been used"
          retriable: false
        }
        WEAK_PASSWORD {
          when: "Password does not meet requirements"
          retriable: true
        }
        SAME_PASSWORD {
          when: "Cannot use same password"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        // All existing sessions revoked
        AuditLog.exists(action: "PASSWORD_RESET")
      }
    }
    
    invariants {
      input.new_password never_appears_in logs
    }
  }
  
  behavior ChangePassword {
    description: "Change password for authenticated user"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      current_password: String [sensitive]
      new_password: String [sensitive]
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_PASSWORD {
          when: "Current password is incorrect"
          retriable: true
        }
        WEAK_PASSWORD {
          when: "New password does not meet requirements"
          retriable: true
        }
        SAME_PASSWORD {
          when: "Cannot use same password"
          retriable: true
        }
      }
    }
    
    postconditions {
      success implies {
        User.lookup(actor.id).last_password_change != null
      }
    }
    
    invariants {
      input.current_password never_appears_in logs
      input.new_password never_appears_in logs
    }
  }
  
  behavior EnableMFA {
    description: "Enable MFA for user account"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      method: MFAMethod
      verification_code: String [sensitive]
    }
    
    output {
      success: {
        recovery_codes: List<String>
      }
      
      errors {
        INVALID_CODE {
          when: "Verification code is invalid"
          retriable: true
        }
        MFA_ALREADY_ENABLED {
          when: "MFA is already enabled"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        User.lookup(actor.id).mfa_enabled == true
        User.lookup(actor.id).mfa_method == input.method
      }
    }
  }
  
  behavior DisableMFA {
    description: "Disable MFA for user account"
    
    actors {
      User { must: authenticated }
    }
    
    input {
      verification_code: String [sensitive]
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_CODE {
          when: "Verification code is invalid"
          retriable: true
        }
        MFA_NOT_ENABLED {
          when: "MFA is not enabled"
          retriable: false
        }
      }
    }
    
    postconditions {
      success implies {
        User.lookup(actor.id).mfa_enabled == false
      }
    }
  }
  
  // === SCENARIOS ===
  
  scenarios Register {
    scenario "successful registration" {
      when {
        result = Register(
          email: "newuser@example.com",
          password: "SecurePass123!",
          name: "New User"
        )
      }
      
      then {
        result is success
        result.status == PENDING_VERIFICATION
        result.email_verified == false
      }
    }
    
    scenario "duplicate email rejection" {
      given {
        existing = Register(
          email: "existing@example.com",
          password: "Password123!",
          name: "Existing User"
        )
      }
      
      when {
        result = Register(
          email: "existing@example.com",
          password: "Different123!",
          name: "Another User"
        )
      }
      
      then {
        result is EMAIL_EXISTS
      }
    }
  }
  
  scenarios Login {
    scenario "successful login without MFA" {
      given {
        user = Register(email: "login@example.com", password: "Password123!")
        verify_email(user)
      }
      
      when {
        result = Login(
          email: "login@example.com",
          password: "Password123!",
          device_info: {
            device_type: "desktop",
            ip_address: "192.168.1.1"
          }
        )
      }
      
      then {
        result is success
        result.requires_mfa == false
      }
    }
    
    scenario "login with MFA required" {
      given {
        user = Register(email: "mfa@example.com", password: "Password123!")
        verify_email(user)
        enable_mfa(user, TOTP)
      }
      
      when {
        result = Login(
          email: "mfa@example.com",
          password: "Password123!",
          device_info: {
            device_type: "desktop",
            ip_address: "192.168.1.1"
          }
        )
      }
      
      then {
        result is success
        result.requires_mfa == true
      }
    }
    
    // Scenario "account lockout after failed attempts" removed - repeat() syntax not supported
  }
}
