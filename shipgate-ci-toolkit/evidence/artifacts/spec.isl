// ShipGate Demo — User Service Spec
// Run: shipgate gate specs/user-service.isl --impl src --threshold 90

domain UserService {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    name: String
    passwordHash: String
    role: String
    createdAt: Timestamp [immutable]
    updatedAt: Timestamp

    invariants {
      - email.contains("@")
      - name.length > 0
      - passwordHash.length > 0
    }
  }

  behavior RegisterUser {
    description: "Register a new user account"

    actors {
      Public {}
    }

    input {
      email: String
      name: String
      password: String
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
        WEAK_PASSWORD {
          when: "Password does not meet minimum requirements"
          retriable: false
        }
      }
    }

    preconditions {
      - input.email.contains("@")
      - input.name.length > 0
      - input.password.length >= 8
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - User.email == input.email
        - User.name == input.name
        - result.passwordHash != input.password
      }
    }

    temporal {
      - within 200ms (p99): response returned
    }
  }

  behavior GetUser {
    description: "Retrieve a user by ID"

    actors {
      AuthenticatedUser {
        must: authenticated
      }
    }

    input {
      id: UUID
    }

    output {
      success: User

      errors {
        NOT_FOUND {
          when: "No user with the given ID exists"
          retriable: false
        }
        FORBIDDEN {
          when: "Caller is not the user and is not an admin"
          retriable: false
        }
      }
    }

    preconditions {
      - input.id != null
    }

    postconditions {
      success implies {
        - result.id == input.id
      }
    }
  }

  scenario "Register with valid data" {
    given {
      User.count == 0
    }
    when {
      RegisterUser(email: "alice@example.com", name: "Alice", password: "secure1234")
    }
    then {
      User.count == 1
      User.email == "alice@example.com"
    }
  }

  scenario "Reject duplicate email" {
    given {
      User.exists(email: "alice@example.com")
    }
    when {
      RegisterUser(email: "alice@example.com", name: "Alice 2", password: "secure1234")
    }
    then {
      error == EMAIL_EXISTS
    }
  }

  scenario "Reject weak password" {
    given {}
    when {
      RegisterUser(email: "bob@example.com", name: "Bob", password: "short")
    }
    then {
      error == WEAK_PASSWORD
    }
  }
}
