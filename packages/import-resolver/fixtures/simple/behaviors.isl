# Shared behavior definitions

domain SimpleAppBehaviors {
  version: "1.0.0"

  imports {
    User, Email from "./types.isl"
  }

  behavior CreateUser {
    description: "Create a new user"

    input {
      email: Email
      name: String { max_length: 100 }
    }

    output {
      success: User
      errors {
        EMAIL_EXISTS { when: "Email already in use" }
        INVALID_EMAIL { when: "Email format invalid" }
      }
    }

    preconditions {
      - not User.exists(email: input.email)
    }

    postconditions {
      success implies {
        - User.exists(result.id)
        - result.email == input.email
      }
    }
  }
}
