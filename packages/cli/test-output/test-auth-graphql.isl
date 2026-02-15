
domain Auth v1.0.0 {
  entity User {
    id: UUID
    email: String
    name: String?
    createdAt: Timestamp
  }

  behavior Login {
    input {
      email: String
      password: String
    }
    output {
      success: User
      errors {
        InvalidCredentials
        AccountLocked
      }
    }
  }

  behavior Register {
    input {
      email: String
      password: String
      name: String?
    }
    output {
      success: User
      errors {
        EmailExists
      }
    }
  }
}
