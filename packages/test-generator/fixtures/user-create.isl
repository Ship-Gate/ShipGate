// User management fixture: CreateUser behavior
domain UserManagement {
  version: "1.0.0"

  entity User {
    id: UUID [immutable]
    email: String [unique]
    name: String
    status: String
    created_at: Timestamp [immutable]

    lifecycle {
      PENDING -> ACTIVE
      ACTIVE -> SUSPENDED
      SUSPENDED -> ACTIVE
    }
  }

  behavior CreateUser {
    description: "Create a new user account"

    input {
      email: String
      name: String
      password: String [sensitive]
    }

    output {
      success: {
        id: UUID
        email: String
        name: String
        status: String
      }

      errors {
        EMAIL_ALREADY_EXISTS {
          when: "Email is already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
      }
    }

    preconditions {
      input.email.length > 0
      input.name.length > 0
      input.password.length >= 8
    }

    postconditions {
      success implies {
        User.exists(result.id)
        result.email == input.email
        result.name == input.name
        result.status == "ACTIVE"
      }

      EMAIL_ALREADY_EXISTS implies {
        User.count == old(User.count)
      }
    }

    invariants {
      input.password never_appears_in logs
    }
  }
}
