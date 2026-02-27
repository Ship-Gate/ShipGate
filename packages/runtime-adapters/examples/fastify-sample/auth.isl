domain Auth {
  version "1.0.0"

  behavior Login {
    inputs {
      email: Email
      password: String
    }
    outputs {
      success: Boolean
      token?: String
      error?: String
    }
    preconditions {
      email.length > 0
      password.length >= 8
    }
    postconditions {
      if (output.success) {
        output.token != null
      }
    }
  }

  behavior GetUser {
    inputs {
      id: String
    }
    outputs {
      id: String
      email: Email
      name: String
    }
    preconditions {
      id.length > 0
    }
    postconditions {
      output.id == input.id
    }
  }
}
