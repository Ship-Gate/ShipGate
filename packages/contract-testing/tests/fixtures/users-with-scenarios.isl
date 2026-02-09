domain UserManagement {
  version: "1.0.0"

  entity User {
    id: UUID
    email: String
    name: String
  }

  behavior CreateUser {
    input {
      email: String
      name: String
    }

    output {
      success: User
      errors {
        EMAIL_ALREADY_EXISTS {
          when: "A user with this email already exists"
        }
      }
    }

    pre {
      email.is_valid
      name.length > 0
    }

    post success {
      - User.exists(result.id)
      - User.email == email
      - User.name == name
    }
  }

  scenarios CreateUser {
    scenario "successful user creation" {
      given {
        email = "test@example.com"
        name = "Test User"
      }
      when {
        result = CreateUser(email: email, name: name)
      }
      then {
        result is success
        result.email == email
        result.name == name
      }
    }

    scenario "duplicate email" {
      given {
        email = "existing@example.com"
        name = "Test User"
      }
      when {
        result = CreateUser(email: email, name: name)
      }
      then {
        result is failure
        result.error == EMAIL_ALREADY_EXISTS
      }
    }
  }
}
