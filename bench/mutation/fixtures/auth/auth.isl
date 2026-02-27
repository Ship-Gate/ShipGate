# Authentication Domain
# 
# Login behavior for mutation testing validation.

domain Authentication {
  version: "1.0.0"

  type Email = String { format: "email" }
  type Password = String { min_length: 8 }
  type SessionId = UUID

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    password_hash: String [secret]
    failed_attempts: Int [default: 0]
    locked_until: Timestamp?
    
    invariants {
      failed_attempts >= 0
      failed_attempts <= 5
    }
  }

  entity Session {
    id: SessionId [immutable, unique]
    user_id: UUID [immutable]
    created_at: Timestamp [immutable]
    expires_at: Timestamp
  }

  behavior Login {
    description: "Authenticate user with email and password"

    input {
      email: Email
      password: Password
    }

    output {
      success: Session

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password incorrect"
        }
        USER_LOCKED {
          when: "Too many failed attempts"
        }
        RATE_LIMITED {
          when: "Too many requests"
        }
      }
    }

    pre {
      - email.is_valid_format
      - password.length >= 8
      - not is_rate_limited(email)
    }

    post success {
      - Session.exists(result.id)
      - result.expires_at > now()
      - User.lookup(email).failed_attempts == 0
    }

    post INVALID_CREDENTIALS {
      - User.lookup(email).failed_attempts == old(User.lookup(email).failed_attempts) + 1
    }

    post USER_LOCKED {
      - User.lookup(email).locked_until > now()
    }

    invariants {
      - User.lookup(email).failed_attempts <= 5
    }
  }
}
