// Minimal ISL specification for testing
// Now supports both // and # comment styles

domain TestDomain {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
  }

  behavior CreateUser {
    description: "Create a new user"

    input {
      email: String
      name: String
    }

    output {
      success: User
    }

    preconditions {
      - input.email.contains("@")
      - input.name.length > 0
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - result.email == input.email
      }
    }
  }
}
