// Golden path demo spec

domain CreateUserDemo {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    password: String
  }

  behavior CreateUser {
    description: "Create a new user with email and password"

    input {
      email: String
      password: String
    }

    output {
      success: User
    }

    preconditions {
      - input.email.length > 0
      - input.password.length >= 8
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - result.email == input.email
      }
    }
  }
}
