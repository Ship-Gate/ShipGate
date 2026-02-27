domain Auth {
  version: "1.0.0"
  
  type Email = String
  type Password = String
  
  entity User {
    id: UUID
    email: Email
    password_hash: Password
    created_at: Timestamp
    updated_at: Timestamp?
  }
  
  behavior Login {
    input {
      email: Email
      password: Password
    }
    output {
      success: {
        user: User
        token: String
      }
      errors {
        INVALID_CREDENTIALS {
          when: "Email or password incorrect"
        }
      }
    }
    preconditions {
      input.email != null
      input.password != null
    }
    postconditions {
      success implies {
        result.user != null
        result.token != null
      }
    }
  }
}
