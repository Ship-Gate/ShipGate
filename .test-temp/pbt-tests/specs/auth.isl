
isl 1.0

domain AuthDomain {
  entity User {
    id: UUID
    email: String
    passwordHash: String
  }

  behavior Login {
    input {
      email: String
      password: String
    }
    output {
      success: User
      error: { code: String, message: String }
    }
    preconditions {
      "Email must be valid" => input.email.contains("@")
      "Password must be 8-128 chars" => input.password.length >= 8 && input.password.length <= 128
    }
    postconditions {
      "Session created on success" => result.success implies session.exists
    }
  }
}
