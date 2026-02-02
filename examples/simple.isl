# Simple test domain

domain SimpleAuth {
  version: "1.0.0"

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
  }

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    status: UserStatus
  }

  behavior Login {
    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: User
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
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

    invariants {
      - password never_logged
    }
  }
}
