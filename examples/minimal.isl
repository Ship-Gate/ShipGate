domain Test {
  version: "1.0.0"
  
  entity User {
    id: UUID [immutable]
  }

  behavior CreateUser {
    output {
      success: User
      errors {
        INVALID_EMAIL {
          when: "test"
        }
      }
    }
  }
}
