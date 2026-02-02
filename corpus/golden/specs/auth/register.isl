// Authentication: User registration
domain AuthRegister {
  version: "1.0.0"

  type Email = String { format: email, max_length: 254 }
  type Password = String { min_length: 8, max_length: 128 }

  enum UserStatus {
    PENDING_VERIFICATION
    ACTIVE
    INACTIVE
  }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    password_hash: String [secret]
    name: String
    status: UserStatus
    email_verified: Boolean [default: false]
    verification_token: String?
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      email.length > 0
      name.length > 0
      status == ACTIVE implies email_verified == true
    }

    lifecycle {
      PENDING_VERIFICATION -> ACTIVE
      ACTIVE -> INACTIVE
      INACTIVE -> ACTIVE
    }
  }

  behavior Register {
    description: "Create a new user account"

    actors {
      Anonymous { }
    }

    input {
      email: Email
      password: Password [sensitive]
      confirm_password: Password [sensitive]
      name: String
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email is already registered"
          retriable: false
        }
        PASSWORDS_MISMATCH {
          when: "Password and confirmation do not match"
          retriable: true
        }
        WEAK_PASSWORD {
          when: "Password does not meet strength requirements"
          retriable: true
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: true
        }
      }
    }

    pre {
      email.is_valid_format
      password.length >= 8
      password == confirm_password
      not User.exists_by_email(email)
    }

    post success {
      - User.exists(result.id)
      - result.email == input.email
      - result.name == input.name
      - result.status == PENDING_VERIFICATION
      - result.password_hash != input.password
      - result.email_verified == false
    }

    post EMAIL_EXISTS {
      - User.count == old(User.count)
    }

    post failure {
      - no User created
    }

    invariants {
      - password hashed with bcrypt or argon2
      - password never_logged
      - password never_stored_plaintext
    }

    temporal {
      - within 1s (p99): response returned
      - eventually within 5m: verification email sent
    }

    security {
      - rate_limit 5 per hour per ip_address
    }

    compliance {
      gdpr {
        - consent recorded
        - email verification required
      }
    }
  }

  behavior VerifyEmail {
    description: "Verify user email with token"

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
          when: "Token is invalid or expired"
          retriable: false
        }
        ALREADY_VERIFIED {
          when: "Email is already verified"
          retriable: false
        }
      }
    }

    post success {
      - result.email_verified == true
      - result.status == ACTIVE
      - result.verification_token == null
    }
  }

  scenarios Register {
    scenario "successful registration" {
      when {
        result = Register(
          email: "new@example.com",
          password: "SecurePass123!",
          confirm_password: "SecurePass123!",
          name: "New User"
        )
      }

      then {
        result is success
        result.status == PENDING_VERIFICATION
        result.email_verified == false
      }
    }

    scenario "duplicate email" {
      given {
        existing = User.create(email: "taken@example.com")
      }

      when {
        result = Register(
          email: "taken@example.com",
          password: "SecurePass123!",
          confirm_password: "SecurePass123!",
          name: "Duplicate"
        )
      }

      then {
        result is EMAIL_EXISTS
      }
    }
  }
}
