// Authentication: Basic login behavior
domain AuthLogin {
  version: "1.0.0"

  type Email = String { format: email, max_length: 254 }
  type Password = String { min_length: 8, max_length: 128 }

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
    PENDING
  }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    password_hash: String [secret]
    status: UserStatus
    failed_attempts: Int [default: 0]
    locked_until: Timestamp?
    last_login: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      failed_attempts >= 0
      failed_attempts <= 10
      locked_until != null implies status == LOCKED
    }
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [secret]
    ip_address: String [pii]
    expires_at: Timestamp
    revoked: Boolean [default: false]
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
    }
  }

  behavior Login {
    description: "Authenticate user with email and password"

    actors {
      Anonymous { }
    }

    input {
      email: Email
      password: Password [sensitive]
      ip_address: String
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
          when: "Account is locked due to failed attempts"
          retriable: true
          retry_after: 15m
        }
        USER_INACTIVE {
          when: "Account is not active"
          retriable: false
        }
      }
    }

    pre {
      email.is_valid_format
      password.length >= 8
    }

    post success {
      - Session.exists(result.id)
      - Session.user_id == User.lookup(email).id
      - Session.expires_at > now()
      - User.failed_attempts == 0
      - User.last_login == now()
    }

    post INVALID_CREDENTIALS {
      - User.failed_attempts == old(User.failed_attempts) + 1
      - no Session created
    }

    post failure {
      - no Session created
    }

    invariants {
      - password never_logged
      - password never_stored_plaintext
    }

    temporal {
      - within 500ms (p99): response returned
    }

    security {
      - rate_limit 10 per hour per email
      - rate_limit 100 per hour per ip_address
    }
  }

  scenarios Login {
    scenario "successful login" {
      given {
        user = User.create(email: "test@example.com", status: ACTIVE)
      }

      when {
        result = Login(email: "test@example.com", password: "validPass123!", ip_address: "1.2.3.4")
      }

      then {
        result is success
        result.user_id == user.id
      }
    }

    scenario "invalid credentials" {
      given {
        user = User.create(email: "test@example.com", status: ACTIVE)
      }

      when {
        result = Login(email: "test@example.com", password: "wrongPass!", ip_address: "1.2.3.4")
      }

      then {
        result is INVALID_CREDENTIALS
      }
    }
  }
}
