domain Auth {
  version: "1.0.0"

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    password_hash: String [secret]
    status: UserStatus
    created_at: Timestamp [immutable]
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    expires_at: Timestamp
    revoked: Boolean
  }

  behavior Login {
    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        USER_LOCKED {
          when: "Account is locked"
          retriable: false
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 8
    }

    post success {
      - Session.exists(result.id)
      - Session.user_id == User.lookup(email).id
    }
  }

  behavior Register {
    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS {
          when: "A user with this email already exists"
          retriable: false
        }
      }
    }

    pre {
      email.is_valid
      password.length >= 8
    }

    post success {
      - User.exists(result.id)
      - User.email == input.email
    }
  }
}
