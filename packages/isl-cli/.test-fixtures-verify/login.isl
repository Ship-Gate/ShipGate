
domain AuthLogin {
  version: "1.0.0"

  type Email = String { format: email }
  type Password = String { min_length: 8 }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    failed_attempts: Int [default: 0]

    invariants {
      failed_attempts >= 0
      failed_attempts <= 10
    }
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID
    expires_at: Timestamp

    invariants {
      expires_at > created_at
    }
  }

  behavior Login {
    description: "Authenticate user"

    input {
      email: Email
      password: Password
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS { when: "Wrong password" }
      }
    }

    post success {
      - Session.exists(result.id)
      - Session.user_id == User.lookup(email).id
      - User.failed_attempts == 0
    }

    post INVALID_CREDENTIALS {
      - User.failed_attempts == old(User.failed_attempts) + 1
    }

    invariants {
      - password never_logged
    }

    temporal {
      - within 500ms (p99): response returned
    }
  }
}
