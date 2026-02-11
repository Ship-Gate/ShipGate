
domain UserAuthentication {
  version: "1.0.0"

  behavior Login {
    input {
      email: String
      password: String [sensitive]
    }
    output {
      success: Session
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
        }
      }
    }
  }

  behavior Register {
    input {
      email: String
      password: String [sensitive]
    }
    output {
      success: User
      errors {
        EMAIL_ALREADY_EXISTS {
          when: "Email already exists"
        }
      }
    }
  }
}
