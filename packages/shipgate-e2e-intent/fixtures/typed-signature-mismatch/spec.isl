domain UserService {
  version: "1.0.0"

  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    name: String
    created_at: Timestamp [immutable]
  }

  behavior GetUser {
    input {
      id: UUID
    }

    output {
      success: User
      errors {
        USER_NOT_FOUND {
          when: "No user exists with this id"
          retriable: false
        }
      }
    }

    postconditions {
      success implies {
        - result.id == input.id
        - result.email.length > 0
        - result.name.length > 0
      }
    }
  }
}
