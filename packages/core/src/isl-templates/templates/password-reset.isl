# Password Reset Domain
# Secure password reset flow with token management

domain PasswordReset {
  version: "1.0.0"
  
  # ============================================
  # Types
  # ============================================
  
  type ResetToken = String { min_length: 32, max_length: 64 }
  type Password = String { min_length: 8, max_length: 128 }
  
  enum TokenStatus {
    ACTIVE
    USED
    EXPIRED
    REVOKED
  }
  
  # ============================================
  # Entities
  # ============================================
  
  entity PasswordResetToken {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [indexed]  # Store hashed token
    status: TokenStatus [default: ACTIVE]
    ip_address: String?
    user_agent: String?
    expires_at: Timestamp
    used_at: Timestamp?
    created_at: Timestamp [immutable]
    
    invariants {
      expires_at > created_at
      used_at != null implies status == USED
      status == USED implies used_at != null
    }
    
    lifecycle {
      ACTIVE -> USED
      ACTIVE -> EXPIRED
      ACTIVE -> REVOKED
    }
  }
  
  entity PasswordHistory {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    password_hash: String [secret]
    created_at: Timestamp [immutable]
    
    invariants {
      password_hash.length > 0
    }
  }
  
  # ============================================
  # Behaviors
  # ============================================
  
  behavior RequestPasswordReset {
    description: "Request a password reset email"
    
    actors {
      Anonymous { }
    }
    
    input {
      email: String { format: "email" }
    }
    
    output {
      success: {
        message: String
        // Always return success to prevent email enumeration
      }
    }
    
    postconditions {
      // If user exists, token is created
      User.exists_by_email(input.email) implies {
        PasswordResetToken.exists(
          user_id: User.lookup_by_email(input.email).id,
          status: ACTIVE
        )
      }
    }
    
    invariants {
      // Timing attack prevention
      response_time constant regardless of user existence
      // No information leakage
      result does not reveal if email exists
    }
    
    temporal {
      response within 500ms
      eventually within 5m: email_sent (if user exists)
    }
    
    security {
      rate_limit 3 per hour per email
      rate_limit 10 per hour per ip
    }
    
    effects {
      Email { send_reset_email }
      AuditLog { log_reset_request }
    }
  }
  
  behavior ValidateResetToken {
    description: "Check if a reset token is valid"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: ResetToken
    }
    
    output {
      success: {
        valid: Boolean
        expires_in: Int?
        user_email_hint: String?  # e.g., "j***@example.com"
      }
      
      errors {
        INVALID_TOKEN {
          when: "Token is invalid, expired, or already used"
          retriable: false
        }
      }
    }
    
    preconditions {
      PasswordResetToken.exists_by_hash(hash(input.token))
    }
    
    postconditions {
      success implies {
        PasswordResetToken.lookup_by_hash(hash(input.token)).status == ACTIVE
        PasswordResetToken.lookup_by_hash(hash(input.token)).expires_at > now()
      }
    }
    
    temporal {
      response within 100ms
    }
  }
  
  behavior ResetPassword {
    description: "Reset password using a valid token"
    
    actors {
      Anonymous { }
    }
    
    input {
      token: ResetToken
      new_password: Password [sensitive]
      confirm_password: Password [sensitive]
    }
    
    output {
      success: Boolean
      
      errors {
        INVALID_TOKEN {
          when: "Token is invalid, expired, or already used"
          retriable: false
        }
        PASSWORDS_DO_NOT_MATCH {
          when: "Password and confirmation do not match"
          retriable: true
        }
        PASSWORD_TOO_WEAK {
          when: "Password does not meet strength requirements"
          retriable: true
        }
        PASSWORD_RECENTLY_USED {
          when: "Password was used recently"
          retriable: true
        }
      }
    }
    
    preconditions {
      PasswordResetToken.exists_by_hash(hash(input.token))
      PasswordResetToken.lookup_by_hash(hash(input.token)).status == ACTIVE
      PasswordResetToken.lookup_by_hash(hash(input.token)).expires_at > now()
      input.new_password == input.confirm_password
      password_strength(input.new_password) >= MEDIUM
    }
    
    postconditions {
      success implies {
        // Token is marked as used
        PasswordResetToken.lookup_by_hash(hash(input.token)).status == USED
        PasswordResetToken.lookup_by_hash(hash(input.token)).used_at == now()
        // User password is updated
        User.lookup(token.user_id).password_hash != old(User.lookup(token.user_id).password_hash)
        // Password added to history
        PasswordHistory.exists(user_id: token.user_id)
        // All other active tokens for user are revoked
        PasswordResetToken.count(user_id: token.user_id, status: ACTIVE) == 0
        // All existing sessions are invalidated
        Session.count(user_id: token.user_id, revoked: false) == 0
      }
      
      failure implies {
        User.lookup(token.user_id).password_hash == old(User.lookup(token.user_id).password_hash)
      }
    }
    
    invariants {
      input.new_password never_appears_in logs
      input.new_password hashed with bcrypt or argon2
      input.new_password never stored in plaintext
    }
    
    temporal {
      response within 1s
      immediately: all sessions invalidated
      eventually within 5m: confirmation_email_sent
    }
    
    security {
      rate_limit 5 per hour per ip
    }
    
    effects {
      Email { send_password_changed_notification }
      AuditLog { log_password_reset }
    }
  }
  
  behavior RevokeAllTokens {
    description: "Revoke all active reset tokens for a user"
    
    actors {
      User { must: authenticated }
      Admin { must: authenticated }
    }
    
    input {
      user_id: UUID
    }
    
    output {
      success: {
        revoked_count: Int
      }
    }
    
    postconditions {
      success implies {
        PasswordResetToken.count(user_id: input.user_id, status: ACTIVE) == 0
      }
    }
  }
  
  behavior CheckPasswordStrength {
    description: "Evaluate password strength"
    
    actors {
      Anonymous { }
    }
    
    input {
      password: Password [sensitive]
    }
    
    output {
      success: {
        score: Int  # 0-4
        strength: String  # weak, fair, medium, strong, very_strong
        feedback: List<String>
        crack_time_display: String
        meets_requirements: Boolean
      }
    }
    
    invariants {
      input.password never_appears_in logs
      input.password never stored
    }
    
    temporal {
      response within 50ms
    }
  }
  
  behavior CleanupExpiredTokens {
    description: "Clean up expired reset tokens"
    
    actors {
      System { }
    }
    
    output {
      success: {
        expired_count: Int
        deleted_count: Int
      }
    }
    
    temporal {
      runs every 1h
    }
  }
  
  # ============================================
  # Scenarios
  # ============================================
  
  scenarios RequestPasswordReset {
    scenario "valid email sends reset" {
      given {
        user = User.create(email: "test@example.com")
      }
      
      when {
        result = RequestPasswordReset(email: "test@example.com")
      }
      
      then {
        result is success
        PasswordResetToken.exists(user_id: user.id)
      }
    }
    
    scenario "invalid email still succeeds" {
      when {
        result = RequestPasswordReset(email: "nonexistent@example.com")
      }
      
      then {
        result is success
        // No token created, but same response
      }
    }
  }
  
  scenarios ResetPassword {
    scenario "successful reset" {
      given {
        token = PasswordResetToken.create(
          user_id: user.id,
          status: ACTIVE,
          expires_at: now() + 1h
        )
      }
      
      when {
        result = ResetPassword(
          token: token.token,
          new_password: "NewSecure123!",
          confirm_password: "NewSecure123!"
        )
      }
      
      then {
        result is success
        PasswordResetToken.lookup(token.id).status == USED
        Session.count(user_id: user.id, revoked: false) == 0
      }
    }
    
    scenario "expired token rejected" {
      given {
        token = PasswordResetToken.create(
          user_id: user.id,
          status: ACTIVE,
          expires_at: now() - 1h
        )
      }
      
      when {
        result = ResetPassword(
          token: token.token,
          new_password: "NewSecure123!",
          confirm_password: "NewSecure123!"
        )
      }
      
      then {
        result is INVALID_TOKEN
      }
    }
    
    scenario "password reuse rejected" {
      given {
        PasswordHistory.create(
          user_id: user.id,
          password_hash: hash("OldPassword123!")
        )
        token = PasswordResetToken.create(user_id: user.id)
      }
      
      when {
        result = ResetPassword(
          token: token.token,
          new_password: "OldPassword123!",
          confirm_password: "OldPassword123!"
        )
      }
      
      then {
        result is PASSWORD_RECENTLY_USED
      }
    }
  }
}
