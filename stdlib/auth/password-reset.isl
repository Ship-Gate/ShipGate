# Password Reset Module
# Provides secure password reset flow

module PasswordReset version "1.0.0"

# ============================================
# Types
# ============================================

type ResetToken = String { min_length: 64, max_length: 128, sensitive: true }

type Password = String { min_length: 8, max_length: 128, sensitive: true }

type PasswordStrength = enum { WEAK, FAIR, STRONG, VERY_STRONG }

# ============================================
# Entities
# ============================================

entity PasswordResetRequest {
  id: UUID [immutable, unique]
  user_id: UUID [immutable, indexed]
  token_hash: String [secret]
  created_at: Timestamp [immutable]
  expires_at: Timestamp
  used: Boolean [default: false]
  used_at: Timestamp?
  ip_address: String
  user_agent: String?

  invariants {
    expires_at > created_at
    used == true implies used_at != null
    expires_at <= created_at + 1h
  }
}

# ============================================
# Behaviors
# ============================================

behavior RequestPasswordReset {
  description: "Initiate password reset flow by sending reset email"

  input {
    email: String { format: "email" }
    ip_address: String
    user_agent: String?
  }

  output {
    success: {
      request_id: UUID
      expires_at: Timestamp
    }

    errors {
      USER_NOT_FOUND {
        when: "No user with this email"
        retriable: false
        # Note: In production, return success to prevent enumeration
      }
      TOO_MANY_REQUESTS {
        when: "Rate limit exceeded"
        retriable: true
        retry_after: 15m
      }
      USER_SUSPENDED {
        when: "User account is suspended"
        retriable: false
      }
    }
  }

  pre {
    email.is_valid_format
  }

  post success {
    PasswordResetRequest.exists(result.request_id)
    result.expires_at == now() + 1h
  }

  invariants {
    token cryptographically random (256 bits)
    token_hash uses bcrypt or argon2
    previous unused tokens invalidated
  }

  temporal {
    within 500ms (p99): response returned
    eventually within 2m: reset email sent
  }

  security {
    rate_limit 3 per hour per email
    rate_limit 10 per hour per ip_address
    prevent email enumeration
  }
}

behavior ValidateResetToken {
  description: "Validate a password reset token"

  input {
    token: ResetToken
  }

  output {
    success: {
      request_id: UUID
      user_id: UUID
      expires_at: Timestamp
    }

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
        when: "Token was already used"
        retriable: false
      }
    }
  }

  pre {
    token.length >= 64
  }

  post success {
    result.expires_at > now()
    PasswordResetRequest.lookup(result.request_id).used == false
  }

  temporal {
    within 100ms (p99): response returned
  }
}

behavior ResetPassword {
  description: "Reset user password with valid token"

  input {
    token: ResetToken
    new_password: Password
    confirm_password: Password
  }

  output {
    success: Boolean

    errors {
      INVALID_TOKEN {
        when: "Token is invalid or expired"
        retriable: false
      }
      PASSWORDS_DO_NOT_MATCH {
        when: "Password and confirmation do not match"
        retriable: true
      }
      PASSWORD_TOO_WEAK {
        when: "Password does not meet requirements"
        retriable: true
      }
      PASSWORD_PREVIOUSLY_USED {
        when: "Password was used recently"
        retriable: true
      }
    }
  }

  pre {
    token.length >= 64
    new_password == confirm_password
    new_password.length >= 8
    new_password.strength >= FAIR
  }

  post success {
    User.password_hash != old(User.password_hash)
    User.password_hash != new_password
    PasswordResetRequest.used == true
    PasswordResetRequest.used_at == now()
    all User sessions revoked
  }

  invariants {
    password hashed with bcrypt (cost >= 12) or argon2
    password never stored in plaintext
    password never logged
    token single use only
  }

  temporal {
    within 1s (p99): response returned
    immediately: all sessions invalidated
    eventually within 5m: confirmation email sent
  }

  security {
    rate_limit 5 per hour per ip_address
  }
}

behavior CheckPasswordStrength {
  description: "Evaluate password strength"

  input {
    password: Password
  }

  output {
    success: {
      strength: PasswordStrength
      score: Int { min: 0, max: 100 }
      suggestions: List<String>
    }
  }

  pre {
    password.length > 0
  }

  post success {
    result.score >= 0
    result.score <= 100
    result.strength == WEAK implies result.score < 25
    result.strength == FAIR implies result.score >= 25 and result.score < 50
    result.strength == STRONG implies result.score >= 50 and result.score < 75
    result.strength == VERY_STRONG implies result.score >= 75
  }

  invariants {
    password never logged
    password never stored
  }

  temporal {
    within 50ms (p99): response returned
  }
}
