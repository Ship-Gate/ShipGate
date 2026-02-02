// Authentication: Password reset flow
domain AuthPasswordReset {
  version: "1.0.0"

  type Email = String { format: email, max_length: 254 }
  type Password = String { min_length: 8, max_length: 128 }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    password_hash: String [secret]
    created_at: Timestamp [immutable]
    updated_at: Timestamp
  }

  entity PasswordResetToken {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [secret]
    expires_at: Timestamp
    used: Boolean [default: false]
    used_at: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
      used implies used_at != null
    }
  }

  behavior RequestPasswordReset {
    description: "Request a password reset email"

    actors {
      Anonymous { }
    }

    input {
      email: Email
    }

    output {
      success: Boolean

      errors {
        RATE_LIMITED {
          when: "Too many reset requests"
          retriable: true
          retry_after: 1h
        }
      }
    }

    pre {
      email.is_valid_format
    }

    post success {
      - result == true
      // Note: We always return success to prevent email enumeration
    }

    invariants {
      - response time is constant regardless of email existence
      - no information leaked about email existence
    }

    temporal {
      - within 500ms (p99): response returned
      - eventually within 5m: reset email sent if user exists
    }

    security {
      - rate_limit 3 per hour per email
      - rate_limit 10 per hour per ip_address
    }
  }

  behavior ResetPassword {
    description: "Reset password with token"

    actors {
      Anonymous { }
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
          when: "Token is invalid or expired"
          retriable: false
        }
        TOKEN_ALREADY_USED {
          when: "Token has already been used"
          retriable: false
        }
        PASSWORDS_MISMATCH {
          when: "Password and confirmation do not match"
          retriable: true
        }
        WEAK_PASSWORD {
          when: "Password does not meet requirements"
          retriable: true
        }
      }
    }

    pre {
      new_password.length >= 8
      new_password == confirm_password
    }

    post success {
      - User.password_hash != old(User.password_hash)
      - User.password_hash != input.new_password
      - PasswordResetToken.used == true
      - PasswordResetToken.used_at != null
    }

    post failure {
      - User.password_hash == old(User.password_hash)
    }

    invariants {
      - token is single-use
      - old sessions are invalidated
      - password hashed with bcrypt or argon2
    }

    temporal {
      - immediately: old sessions invalidated
      - eventually within 5m: notification email sent
    }

    security {
      - token expires after 1 hour
      - rate_limit 5 per hour per ip_address
    }
  }

  scenarios RequestPasswordReset {
    scenario "request for existing user" {
      given {
        user = User.create(email: "user@example.com")
      }

      when {
        result = RequestPasswordReset(email: "user@example.com")
      }

      then {
        result is success
      }
    }

    scenario "request for non-existent user" {
      when {
        result = RequestPasswordReset(email: "nobody@example.com")
      }

      then {
        // Still returns success to prevent enumeration
        result is success
      }
    }
  }
}
