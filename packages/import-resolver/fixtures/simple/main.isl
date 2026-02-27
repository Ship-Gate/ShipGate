# Simple multi-file test - main entry point

domain SimpleApp {
  version: "1.0.0"

  imports {
    User, Email from "./types.isl"
    CreateUser from "./behaviors.isl"
  }

  behavior GetUser {
    description: "Get a user by ID"

    input {
      id: UUID
    }

    output {
      success: User
      errors {
        NOT_FOUND { when: "User not found" }
      }
    }

    preconditions {
      - input.id != null
    }
  }
}
