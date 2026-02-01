# User Authentication Domain
# 
# This ISL spec defines the complete behavioral contract for user authentication.
# Any implementation that satisfies these specs is correct by definition.

domain UserAuthentication {
  version: "1.0.0"

  # ============================================
  # Types
  # ============================================

  type Email = String { format: "email", max_length: 254 }

  type Password = String { min_length: 8, max_length: 128 }

  type UserId = UUID { immutable: true, unique: true }

  type SessionId = UUID { immutable: true, unique: true }

  # ============================================
  # Enums
  # ============================================

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
    PENDING_VERIFICATION
  }

  # ============================================
  # Entities
  # ============================================

  entity User {
    id: UserId [immutable, unique]
    email: Email [unique, indexed]
    password_hash: String [secret]
    status: UserStatus [indexed]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
    last_login: Timestamp?
    failed_attempts: Int [default: 0]
    locked_until: Timestamp?

    invariants {
      failed_attempts >= 0
      failed_attempts <= 10
      locked_until != null implies status == LOCKED
    }

    lifecycle {
      PENDING_VERIFICATION -> ACTIVE
      ACTIVE -> LOCKED
      LOCKED -> ACTIVE
      ACTIVE -> INACTIVE
      INACTIVE -> ACTIVE
    }
  }

  entity Session {
    id: SessionId [immutable, unique]
    user_id: UserId [immutable, indexed]
    created_at: Timestamp [immutable]
    expires_at: Timestamp
    revoked: Boolean [default: false]
    ip_address: String
    user_agent: String?

    invariants {
      expires_at > created_at
      revoked == true implies session is invalid
    }
  }

  # ============================================
  # Behaviors
  # ============================================

  behavior Login {
    description: "Authenticate a user with email and password"

    actors {
      Anonymous {
        for: authentication
      }
    }

    input {
      email: Email
      password: Password [sensitive]
      ip_address: String
      user_agent: String?
    }

    output {
      success: Session

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
          retry_after: 1s
        }
        USER_NOT_FOUND {
          when: "No user exists with this email"
          retriable: false
        }
        USER_LOCKED {
          when: "User account is locked due to failed attempts"
          retriable: true
          retry_after: 15m
        }
        USER_INACTIVE {
          when: "User account is inactive"
          retriable: false
        }
      }
    }

    preconditions {
      email.is_valid_format
      password.length >= 8
    }

    postconditions {
      success implies {
        - Session.exists(result.id)
        - Session.user_id == User.lookup(email).id
        - Session.expires_at > now()
        - Session.ip_address == input.ip_address
        - User.last_login == now()
        - User.failed_attempts == 0
      }

      INVALID_CREDENTIALS implies {
        - User.failed_attempts == old(User.failed_attempts)
        - User.status == LOCKED
      }

      failure implies {
        - no Session created
      }
    }

    invariants {
      - password never stored in plaintext
      - password never appears in logs
      - timing attack resistant
    }

    temporal {
      - within 500ms (p50): response returned
      - within 2s (p99): response returned
      - eventually within 5s: audit log updated
    }

    security {
      - rate_limit 100 per hour per ip_address
      - rate_limit 10 per hour per email
      - brute_force_protection enabled
    }
  }

  behavior Logout {
    description: "Invalidate a user session"

    actors {
      User {
        must: authenticated
        owns: session_id
      }
    }

    input {
      session_id: SessionId
    }

    output {
      success: Boolean

      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        SESSION_ALREADY_REVOKED {
          when: "Session was already revoked"
          retriable: false
        }
      }
    }

    preconditions {
      Session.exists(session_id)
    }

    postconditions {
      success implies {
        - Session.lookup(session_id).revoked == true
      }
    }

    temporal {
      - immediately: session invalid for new requests
      - eventually within 5s: session removed from all caches
    }
  }

  behavior Register {
    description: "Create a new user account"

    actors {
      Anonymous {
        for: registration
      }
    }

    input {
      email: Email
      password: Password [sensitive]
      confirm_password: Password [sensitive]
    }

    output {
      success: User { status: PENDING_VERIFICATION }

      errors {
        EMAIL_ALREADY_EXISTS {
          when: "A user with this email already exists"
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
      }
    }

    preconditions {
      email.is_valid_format
      password.length >= 8
      password == confirm_password
      not User.exists_by_email(email)
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
        - User.status == PENDING_VERIFICATION
        - User.password_hash != input.password
        - User.created_at == now()
      }

      EMAIL_ALREADY_EXISTS implies {
        - User.count == old(User.count)
      }

      failure implies {
        - no User created
      }
    }

    invariants {
      - password hashed with bcrypt or argon2
      - password never stored in plaintext
      - password never logged
    }

    temporal {
      - within 1s (p99): response returned
      - eventually within 5m: verification email sent
    }

    security {
      - rate_limit 10 per hour per ip_address
    }

    compliance {
      gdpr {
        - consent recorded for data collection
        - email verification required
      }
    }
  }

  behavior ResetPassword {
    description: "Reset a user password with a reset token"

    actors {
      Anonymous {
        for: password_reset
      }
    }

    input {
      token: String
      new_password: Password [sensitive]
      confirm_password: Password [sensitive]
    }

    output {
      success: Boolean

      errors {
        INVALID_TOKEN {
          when: "Reset token is invalid or expired"
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
      }
    }

    preconditions {
      token.is_valid
      new_password.length >= 8
      new_password == confirm_password
    }

    postconditions {
      success implies {
        - User.password_hash != old(User.password_hash)
        - User.password_hash != input.new_password
        - token is invalidated
        - all existing sessions revoked
      }

      failure implies {
        - User.password_hash == old(User.password_hash)
        - existing sessions unchanged
      }
    }

    invariants {
      - password hashed with bcrypt or argon2
      - password never stored in plaintext
      - token single use only
    }

    temporal {
      - immediately: old sessions invalidated on success
      - eventually within 5m: notification email sent
    }

    security {
      - token expires after 1 hour
      - rate_limit 3 per hour per ip_address
    }
  }

  behavior ValidateSession {
    description: "Check if a session is valid and not expired"

    actors {
      System {
        for: session_validation
      }
    }

    input {
      session_id: SessionId
    }

    output {
      success: User

      errors {
        SESSION_NOT_FOUND {
          when: "Session does not exist"
          retriable: false
        }
        SESSION_EXPIRED {
          when: "Session has expired"
          retriable: false
        }
        SESSION_REVOKED {
          when: "Session was revoked"
          retriable: false
        }
        USER_INACTIVE {
          when: "User account is inactive"
          retriable: false
        }
      }
    }

    preconditions {
      session_id.is_valid_format
    }

    postconditions {
      success implies {
        - Session.exists(session_id)
        - Session.revoked == false
        - Session.expires_at > now()
        - User.status == ACTIVE
      }
    }

    temporal {
      - within 10ms (p50): response returned
      - within 50ms (p99): response returned
    }
  }

  # ============================================
  # Global Invariants
  # ============================================

  invariants SecurityBoundaries {
    description: "Security invariants that must always hold"
    scope: global

    always {
      - passwords never stored in plaintext
      - passwords never appear in logs
      - session tokens cryptographically secure
      - all auth events logged
    }
  }
}
