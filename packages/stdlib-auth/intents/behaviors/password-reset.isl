# Password Reset Behavior Specification
#
# Request password reset and update password with token.

domain Auth.Behaviors {
  version: "0.1.0"

  import { User, UserStatus, UserId, Email, PasswordHash } from "../user.isl"
  import { Session, RevocationReason } from "../session.isl"

  # ============================================
  # Types
  # ============================================

  type ResetToken = String {
    min_length: 32
    max_length: 64
    secret: true
  }

  type ResetTokenHash = String {
    min_length: 64
    secret: true
  }

  # ============================================
  # Password Reset Token Entity
  # ============================================

  entity PasswordResetToken {
    id: UUID [immutable, unique]
    user_id: UserId [immutable, indexed]
    token_hash: ResetTokenHash [unique, secret]
    created_at: Timestamp [immutable]
    expires_at: Timestamp [indexed]
    used_at: Timestamp?
    ip_address: String
    
    invariants {
      expires_at > created_at
      expires_at <= created_at + 1h
      used_at == null or used_at >= created_at
      used_at == null or used_at <= expires_at
    }

    computed {
      is_valid: Boolean = used_at == null and expires_at > now()
      is_expired: Boolean = expires_at <= now()
      is_used: Boolean = used_at != null
    }
  }

  # ============================================
  # Request Password Reset Behavior
  # ============================================

  behavior RequestPasswordReset {
    description: "Request a password reset email for a user account"

    actors {
      Anonymous {
        for: password_reset_request
      }
    }

    input {
      email: Email
      ip_address: String
      user_agent: String?
    }

    output {
      success: {
        message: String
        # Always return success to prevent email enumeration
      }

      errors {
        RATE_LIMITED {
          when: "Too many password reset requests"
          retriable: true
          retry_after: 1h
          http_status: 429
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: true
          http_status: 400
        }
      }
    }

    preconditions {
      input.email.is_valid_format
      input.ip_address != null
    }

    postconditions {
      success implies {
        # Always return success (even if user doesn't exist - prevent enumeration)
        - result.message == "If an account exists with this email, a reset link has been sent"
        
        # If user exists, create token and send email
        - User.exists_by_email(input.email) implies {
            - PasswordResetToken.exists_for_user(User.lookup_by_email(input.email).id)
            - reset_email.queued_for(input.email)
            - audit_log.contains(PasswordResetRequested {
                user_id: User.lookup_by_email(input.email).id,
                ip_address: input.ip_address
              })
          }
        
        # Previous unused tokens for this user are invalidated
        - User.exists_by_email(input.email) implies
            all t in PasswordResetToken.where(
              user_id == User.lookup_by_email(input.email).id and 
              used_at == null and
              id != new_token.id
            ): t.expires_at <= now()
      }

      # Same response regardless of user existence
      any_error implies {
        - no email sent if rate_limited
      }
    }

    invariants {
      - same response time regardless of user existence (timing attack prevention)
      - token is cryptographically secure (256-bit minimum)
      - token hashed before storage (SHA-256)
      - only one active token per user at a time
      - previous tokens invalidated when new one created
    }

    temporal {
      - within 500ms (p50): response returned
      - within 2s (p99): response returned
      - eventually within 5m: reset email sent (if user exists)
    }

    security {
      - rate_limit 3 per hour per email
      - rate_limit 10 per hour per ip_address
      - token expires after 1 hour
      - response time constant regardless of user existence
    }

    observability {
      metrics {
        password_reset_requests: counter [has_user]
        password_reset_emails_sent: counter
      }

      logs {
        always: info {
          include: [ip_address, email_domain]
          exclude: [email, token]
        }
      }
    }
  }

  # ============================================
  # Password Reset Behavior
  # ============================================

  behavior PasswordReset {
    description: "Reset password using a valid reset token"

    actors {
      Anonymous {
        for: password_reset
        has: valid_reset_token
      }
    }

    input {
      token: ResetToken [sensitive]
      new_password: String [sensitive, min_length: 8, max_length: 128]
      confirm_password: String [sensitive]
      ip_address: String
    }

    output {
      success: {
        message: String
        sessions_revoked: Int
      }

      errors {
        INVALID_TOKEN {
          when: "Reset token is invalid, expired, or already used"
          retriable: false
          http_status: 400
        }
        PASSWORDS_DO_NOT_MATCH {
          when: "Password and confirmation do not match"
          retriable: true
          http_status: 400
        }
        PASSWORD_TOO_WEAK {
          when: "Password does not meet strength requirements"
          retriable: true
          http_status: 400
          returns: {
            requirements: List<String>
            missing: List<String>
          }
        }
        PASSWORD_SAME_AS_OLD {
          when: "New password cannot be the same as the current password"
          retriable: true
          http_status: 400
        }
        USER_SUSPENDED {
          when: "Cannot reset password for suspended account"
          retriable: false
          http_status: 403
        }
      }
    }

    preconditions {
      # Token validation
      input.token != null
      input.token.length >= 32
      
      # Password validation
      input.new_password.length >= 8
      input.new_password.length <= 128
      input.new_password == input.confirm_password
      
      # Password strength
      input.new_password.matches(".*[a-z].*")
      input.new_password.matches(".*[A-Z].*")
      input.new_password.matches(".*[0-9].*")
    }

    postconditions {
      success implies {
        # Token marked as used
        - token_record = PasswordResetToken.lookup_by_token_hash(hash(input.token))
        - token_record.used_at == now()
        
        # Password updated
        - user = User.lookup(token_record.user_id)
        - user.password_hash != old(user.password_hash)
        - user.password_hash != input.new_password
        - user.password_changed_at == now()
        - user.updated_at == now()
        
        # Account unlocked if locked
        - old(user.status) == LOCKED implies user.status == ACTIVE
        - user.failed_attempts == 0
        - user.locked_until == null
        
        # All existing sessions revoked
        - all s in Session.where(user_id == user.id and status == ACTIVE):
            s.status == REVOKED and s.revocation_reason == PASSWORD_CHANGE
        - result.sessions_revoked == count of revoked sessions
        
        # Notification sent
        - notification_email.sent_to(user.email, "password_changed")
        
        # Audit logged
        - audit_log.contains(PasswordReset {
            user_id: user.id,
            ip_address: input.ip_address
          })
      }

      INVALID_TOKEN implies {
        - no password changed
        - no sessions revoked
        - audit_log.contains(InvalidPasswordResetAttempt {
            ip_address: input.ip_address
          })
      }

      PASSWORDS_DO_NOT_MATCH implies {
        - no password changed
        - token still valid (not consumed)
      }

      PASSWORD_TOO_WEAK implies {
        - no password changed
        - token still valid (not consumed)
        - result.error.missing.length > 0
      }

      failure implies {
        - no password changed
        - no sessions revoked
      }
    }

    invariants {
      - password hashed using bcrypt (cost >= 12) or argon2id
      - password never stored in plaintext
      - password never logged
      - token is single-use only
      - token constant-time comparison
      - all sessions revoked on password change
    }

    temporal {
      - within 1s (p50): response returned
      - within 3s (p99): response returned
      - immediately: all existing sessions invalidated
      - eventually within 5m: password change notification sent
      - eventually within 30s: all session caches invalidated
    }

    security {
      - rate_limit 5 per hour per ip_address
      - token expires after 1 hour
      - token single-use
      - constant-time token comparison
      - all sessions revoked on success
    }

    compliance {
      pci_dss {
        - password history check (cannot reuse last 4 passwords)
        - password complexity enforced
        - password change logged
      }

      gdpr {
        - user notified of password change
        - audit trail maintained
      }
    }

    observability {
      metrics {
        password_resets: counter [status]
        password_reset_duration: histogram
        sessions_revoked_on_reset: histogram
      }

      traces {
        span: "auth.password_reset"
      }

      logs {
        success: info {
          include: [user_id, sessions_revoked]
          exclude: [token, new_password, confirm_password]
        }
        error: warn {
          include: [error_code, ip_address]
          exclude: [token, new_password, confirm_password]
        }
      }
    }
  }

  # ============================================
  # Change Password Behavior (Authenticated)
  # ============================================

  behavior ChangePassword {
    description: "Change password for authenticated user"

    actors {
      User {
        must: authenticated
      }
    }

    input {
      current_password: String [sensitive]
      new_password: String [sensitive, min_length: 8, max_length: 128]
      confirm_password: String [sensitive]
      revoke_other_sessions: Boolean [default: true]
    }

    output {
      success: {
        message: String
        sessions_revoked: Int
      }

      errors {
        INVALID_CURRENT_PASSWORD {
          when: "Current password is incorrect"
          retriable: true
          http_status: 400
        }
        PASSWORDS_DO_NOT_MATCH {
          when: "New password and confirmation do not match"
          retriable: true
          http_status: 400
        }
        PASSWORD_TOO_WEAK {
          when: "New password does not meet strength requirements"
          retriable: true
          http_status: 400
        }
        PASSWORD_SAME_AS_OLD {
          when: "New password cannot be the same as current password"
          retriable: true
          http_status: 400
        }
      }
    }

    preconditions {
      # Current password required
      input.current_password.length >= 8
      
      # New password validation
      input.new_password.length >= 8
      input.new_password == input.confirm_password
      input.new_password != input.current_password
      
      # Password strength
      input.new_password.matches(".*[a-z].*")
      input.new_password.matches(".*[A-Z].*")
      input.new_password.matches(".*[0-9].*")
    }

    postconditions {
      success implies {
        # Password updated
        - user = actor.user
        - user.password_hash != old(user.password_hash)
        - user.password_changed_at == now()
        
        # Other sessions revoked if requested
        - input.revoke_other_sessions == true implies
            all s in Session.where(
              user_id == user.id and 
              status == ACTIVE and 
              id != actor.session_id
            ): s.status == REVOKED
        
        # Notification sent
        - notification_email.sent_to(user.email, "password_changed")
      }

      INVALID_CURRENT_PASSWORD implies {
        - no password changed
        - actor.user.failed_attempts incremented
      }
    }

    temporal {
      - within 1s (p99): response returned
      - immediately: other sessions invalidated (if requested)
      - eventually within 5m: notification sent
    }

    security {
      - requires authentication
      - current password verification
      - rate_limit 5 per hour per user
    }
  }

  # ============================================
  # Scenarios
  # ============================================

  scenarios RequestPasswordReset {
    scenario "Successful password reset request for existing user" {
      given {
        user = User.create({ 
          email: "user@example.com", 
          status: ACTIVE 
        })
      }

      when {
        RequestPasswordReset({
          email: "user@example.com",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == true
        - PasswordResetToken.exists_for_user(user.id)
        - reset_email.queued_for("user@example.com")
      }
    }

    scenario "Password reset request for non-existent user returns success" {
      when {
        RequestPasswordReset({
          email: "nonexistent@example.com",
          ip_address: "192.168.1.1"
        })
      }

      then {
        # Returns success to prevent enumeration
        - result.success == true
        - no email sent
        - no token created
      }
    }
  }

  scenarios PasswordReset {
    scenario "Successful password reset with valid token" {
      given {
        user = User.create({ 
          email: "user@example.com", 
          status: ACTIVE,
          password_hash: hash("OldPassword123")
        })
        session = Session.create({ user_id: user.id, status: ACTIVE })
        token = PasswordResetToken.create({
          user_id: user.id,
          token_hash: hash("valid-token"),
          expires_at: now() + 1h
        })
      }

      when {
        PasswordReset({
          token: "valid-token",
          new_password: "NewSecurePass123",
          confirm_password: "NewSecurePass123",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == true
        - user.password_hash != hash("OldPassword123")
        - token.used_at != null
        - session.status == REVOKED
        - result.data.sessions_revoked == 1
      }
    }

    scenario "Password reset fails with expired token" {
      given {
        user = User.create({ email: "user@example.com", status: ACTIVE })
        token = PasswordResetToken.create({
          user_id: user.id,
          token_hash: hash("expired-token"),
          expires_at: now() - 1h  # Expired
        })
      }

      when {
        PasswordReset({
          token: "expired-token",
          new_password: "NewSecurePass123",
          confirm_password: "NewSecurePass123",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == false
        - result.error == INVALID_TOKEN
        - user.password_hash == old(user.password_hash)
      }
    }

    scenario "Password reset unlocks locked account" {
      given {
        user = User.create({ 
          email: "user@example.com", 
          status: LOCKED,
          failed_attempts: 5,
          locked_until: now() + 1h
        })
        token = PasswordResetToken.create({
          user_id: user.id,
          token_hash: hash("valid-token"),
          expires_at: now() + 1h
        })
      }

      when {
        PasswordReset({
          token: "valid-token",
          new_password: "NewSecurePass123",
          confirm_password: "NewSecurePass123",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == true
        - user.status == ACTIVE
        - user.failed_attempts == 0
        - user.locked_until == null
      }
    }
  }

  # ============================================
  # Chaos Engineering
  # ============================================

  chaos PasswordReset {
    scenario "Email service failure during reset request" {
      inject {
        service_unavailable(target: "email_service", probability: 1.0)
      }

      given {
        user = User.create({ email: "user@example.com", status: ACTIVE })
      }

      when {
        RequestPasswordReset({
          email: "user@example.com",
          ip_address: "192.168.1.1"
        })
      }

      then {
        # Request should still succeed
        - result.success == true
        # Token created
        - PasswordResetToken.exists_for_user(user.id)
        # Email queued for retry
        - email_queue.contains_pending("user@example.com")
      }
    }

    scenario "Database failure during password update" {
      inject {
        database_failure(target: "users", operation: "update", probability: 1.0)
      }

      given {
        user = User.create({ email: "user@example.com", status: ACTIVE })
        token = PasswordResetToken.create({
          user_id: user.id,
          token_hash: hash("valid-token"),
          expires_at: now() + 1h
        })
      }

      when {
        PasswordReset({
          token: "valid-token",
          new_password: "NewSecurePass123",
          confirm_password: "NewSecurePass123",
          ip_address: "192.168.1.1"
        })
      }

      then {
        - result.success == false
        - result.error.retriable == true
        # Token not consumed
        - token.used_at == null
        # Password unchanged
        - user.password_hash == old(user.password_hash)
      }
    }
  }
}
