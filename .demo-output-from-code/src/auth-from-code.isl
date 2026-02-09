domain Auth {
  version: "1.0.0"

  behavior CreateUser {
  input {
    email: String
    password: String
    name: String?
  }
  
  output {
    success: User
    errors {
      EMAIL_EXISTS { when: "Email already registered" }
      INVALID_EMAIL { when: "Invalid email format" }
      WEAK_PASSWORD { when: "Password does not meet requirements" }
    }
  }
  
  preconditions {
    - input.email.length > 0
    - input.password.length >= 8
  }
  
  postconditions {
    success implies {
      - result.email == input.email
    }
  }
  }
}