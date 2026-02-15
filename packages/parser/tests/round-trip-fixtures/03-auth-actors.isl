domain AuthActors {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    password_hash: String
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID
    expires_at: Timestamp
  }

  behavior Login {
    description: "Authenticate user"
    actors {
      Anonymous { }
    }
    input {
      email: String
      password: String
    }
    output {
      success: Session
      errors {
        INVALID_CREDENTIALS { when: "Bad credentials" retriable: true }
      }
    }
    preconditions {
      - input.email.length > 0
      - input.password.length >= 8
    }
  }

  behavior Logout {
    actors {
      User { must: authenticated }
    }
    input {
      session_id: UUID
    }
    output {
      success: Boolean
    }
  }
}
