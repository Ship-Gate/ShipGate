// Example ISL specification
// Learn more at https://intentos.dev/docs

domain Example {
  version: "1.0.0"

  // Define an entity
  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    name: String
    created_at: Timestamp [immutable]
    updated_at: Timestamp

    invariants {
      - email.contains("@")
      - name.length > 0
    }
  }

  // Define a behavior
  behavior CreateUser {
    description: "Create a new user account"

    actors {
      Admin {
        must: authenticated
      }
    }

    input {
      email: String
      name: String
    }

    output {
      success: User

      errors {
        EMAIL_EXISTS {
          when: "Email already registered"
          retriable: false
        }
        INVALID_EMAIL {
          when: "Email format is invalid"
          retriable: false
        }
      }
    }

    preconditions {
      - input.email.contains("@")
      - input.name.length > 0
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
        - User.name == input.name
      }
    }

    temporal {
      - within 500ms (p99): response returned
    }
  }

  // Define a test scenario
  scenario "Create user with valid email" {
    given {
      User.count == 0
    }
    when {
      CreateUser(email: "test@example.com", name: "Test User")
    }
    then {
      User.email == "test@example.com"
    }
  }
}
