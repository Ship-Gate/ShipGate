// Test spec using stdlib imports

domain AuthDemo {
  version: "1.0.0"

  imports {
    { User, Session } from "stdlib-auth"
    { Payment } from "stdlib-billing"
  }

  behavior Login {
    description: "Authenticate a user"

    input {
      email: String
      password: String
    }

    output {
      success: Session
    }

    preconditions {
      - input.email.length > 0
      - input.password.length >= 8
    }

    postconditions {
      success implies {
        - result.token.length > 0
      }
    }
  }
}
