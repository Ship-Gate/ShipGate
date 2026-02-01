// Test spec with intentional errors

domain BadTypes {
  version: "1.0.0"

  entity User {
    id: UUID
    email: String
    profile: NonExistentType   // Should error - undefined type
  }

  behavior CreateUser {
    input {
      email: String
      role: UndefinedRole      // Should error - undefined type
    }

    output {
      success: FakeEntity      // Should error - undefined type
    }

    preconditions {
      - input.email.length > 0
    }

    postconditions {
      success implies {
        - Ghost.exists(result.id)   // Should error - undefined entity
      }
    }
  }
}
