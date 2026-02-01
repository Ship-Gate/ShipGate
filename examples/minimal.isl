domain Test {
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
