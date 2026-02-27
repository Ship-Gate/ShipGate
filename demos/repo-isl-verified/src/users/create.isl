domain Users {
  version: "1.0.0"
  owner: "platform-team"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique, indexed]
    name: String
    password_hash: String [secret]
    created_at: Timestamp [immutable]

    invariants {
      email.length > 0
      name.length > 0
    }
  }

  behavior CreateUser {
    description: "Register a new user account with email, name, and password"

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
        created_at: Timestamp
      }
      errors {
        DUPLICATE_EMAIL {
          when: "A user with this email already exists"
          retriable: false
        }
        VALIDATION_ERROR {
          when: "Required fields missing or password too short"
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
      }

      DUPLICATE_EMAIL implies {
        User.count == old(User.count)
      }
    }

    invariants {
      // Password is hashed before storage — never stored as plaintext
      input.password never stored in plaintext
      User.password_hash != input.password
    }
  }

  scenarios CreateUser {
    scenario "create user with valid input" {
      when {
        result = CreateUser(
          email: "bob@example.com",
          name: "Bob Smith",
          password: "Str0ng!Pass"
        )
      }
      then {
        result is success
        result.email == "bob@example.com"
        result.name == "Bob Smith"
        User.exists(result.id)
      }
    }

    scenario "reject duplicate email" {
      given {
        existing = CreateUser(
          email: "taken@example.com",
          name: "First User",
          password: "Str0ng!Pass"
        )
      }
      when {
        result = CreateUser(
          email: "taken@example.com",
          name: "Second User",
          password: "An0ther!Pass"
        )
      }
      then {
        result is DUPLICATE_EMAIL
      }
    }

    scenario "reject short password" {
      when {
        result = CreateUser(
          email: "new@example.com",
          name: "New User",
          password: "short"
        )
      }
      then {
        result is VALIDATION_ERROR
      }
    }
  }
}
